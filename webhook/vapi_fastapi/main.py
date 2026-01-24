from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel, EmailStr
from typing import List, Dict, Any, Optional
import json
import os
import aiohttp
from .state_manager import state_manager
from .calendar_client import GoogleCalendarClient
from .slot_manager import SlotManager
from .timezone_utils import (
    TimeSlot, parse_caller_time, validate_business_hours, 
    get_next_available_slots, ARIZONA_TZ, UTC_TZ
)

# Config
GOOGLE_CREDS_PATH = os.getenv("GOOGLE_CREDS_PATH", "google-creds.json")
AGENT_EMAIL = os.getenv("AGENT_EMAIL", "agent@example.com")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Global Clients
calendar_client: Optional[GoogleCalendarClient] = None
slot_manager: Optional[SlotManager] = None

# Lifespan manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global calendar_client, slot_manager
    state_manager.start_cleanup_task()
    
    # Initialize implementation clients
    try:
        if os.path.exists(GOOGLE_CREDS_PATH):
            calendar_client = GoogleCalendarClient(GOOGLE_CREDS_PATH, AGENT_EMAIL)
        
        slot_manager = SlotManager(REDIS_URL)
        # await slot_manager.connect() # Connect on first use or here
        
        print("✅ Services initialized")
    except Exception as e:
        print(f"⚠️ Service initialization warning: {e}")

    yield
    
    # Shutdown
    if calendar_client:
        await calendar_client.close()
    if slot_manager:
        await slot_manager.disconnect()

app = FastAPI(title="Vapi State Manager & Calendar", lifespan=lifespan)

# --- Calendar Models ---

class CheckAvailabilityRequest(BaseModel):
    date_start: str # ISO 8601 UTC
    date_end: str   # ISO 8601 UTC
    caller_timezone: str = "EST"

class BookAppointmentRequest(BaseModel):
    slot_time: str # ISO 8601 Arizona TZ
    call_id: str
    lead_name: str
    lead_email: EmailStr
    lead_phone: str
    confirmation_sms: str = ""

# --- Calendar Endpoints ---

@app.post("/check-availability")
async def check_availability(req: CheckAvailabilityRequest):
    if not calendar_client:
        raise HTTPException(503, "Calendar service not configured")
        
    try:
        start_utc = datetime.fromisoformat(req.date_start.replace('Z', '+00:00'))
        end_utc = datetime.fromisoformat(req.date_end.replace('Z', '+00:00'))
        
        # Get busy blocks
        busy_blocks = await calendar_client.get_availability(start_utc, end_utc)
        
        # Convert busy blocks to Arizona TimeSlots for logic
        busy_slots = [
            TimeSlot(block.start.astimezone(ARIZONA_TZ), duration_minutes=1) 
            for block in busy_blocks
        ]
        
        # Calculate available slots
        available = get_next_available_slots(busy_slots, count=3)
        
        return {
            "available_slots": [
                {
                    "start_iso": slot.to_iso(),
                    "voice_string": slot.to_voice_string()
                } for slot in available
            ]
        }
    except Exception as e:
        print(f"Availability error: {e}")
        raise HTTPException(500, str(e))

@app.post("/book-appointment")
async def book_appointment(req: BookAppointmentRequest, background_tasks: BackgroundTasks):
    if not calendar_client or not slot_manager:
        raise HTTPException(503, "Booking services not configured")

    try:
        # 1. Parse slot
        slot_dt = datetime.fromisoformat(req.slot_time)
        slot = TimeSlot(slot_dt)
        
        # 2. Acquire Redis Hold
        slot_id = f"{AGENT_EMAIL}_{slot_dt.strftime('%Y%m%d_%H%M')}"
        acquired, hold_id = await slot_manager.acquire_hold(slot_id, req.call_id, req.lead_email)
        
        if not acquired:
            return {"success": False, "error": f"Slot unavailable: {hold_id}"}
            
        # 3. Create Calendar Event
        try:
            event_id = await calendar_client.create_event(
                summary=f"Tour: {req.lead_name}",
                start=slot.start.astimezone(UTC_TZ),
                end=slot.end.astimezone(UTC_TZ),
                attendees=[req.lead_email],
                description=f"Phone: {req.lead_phone}\n\n{req.confirmation_sms}"
            )
        except Exception as e:
            await slot_manager.release_hold(slot_id, hold_id)
            raise e
            
        # 4. Release Hold (Booking confirmed)
        await slot_manager.release_hold(slot_id, hold_id)
        
        return {"success": True, "event_id": event_id, "message": f"Confirmed for {slot.to_voice_string()}"}

    except Exception as e:
        print(f"Booking error: {e}")
        return {"success": False, "error": str(e)}

# System prompts for each state
STATE_PROMPTS = {
    "QUALIFICATION": """You are a real estate lead qualifier. Your goal is to extract:

- Budget range (convert to number)
- Timeline ("3 months", "6 months", etc.)
- Property type preference (house, condo, etc.)
- Location preference

Ask ONE question at a time. When you have budget AND timeline, call update_system_prompt(new_state="BOOKING").

Current context: {{CONTEXT}}""",

    "BOOKING": """You are a real estate appointment scheduler. Offer 3 specific time slots:

- Tuesday 3pm, Wednesday 10am, Thursday 2pm (or similar)
- Confirm availability before booking

When user confirms a time, call update_system_prompt(new_state="CONFIRMATION") with {selected_time: "Tuesday 3pm"}.

Lead context: Budget ${{budget}}, Timeline: {{timeline}}""",

    "CONFIRMATION": """You are confirming a real estate showing appointment. Read back:

- Date and time
- Property preferences
- Contact information

Be concise and professional. Do not transition to other states.

Appointment: {{selected_time}}
Lead details: {{CONTEXT}}"""
}

async def handle_assistant_request(call_id: str) -> Dict:
    """Initialize call state and return starting prompt"""
    # Initialize state
    state_manager.init_call(call_id, initial_state="QUALIFICATION")

    # Return initial assistant config
    return {
        "assistant": {
            "firstMessage": "Hello! I'm excited to help you find your perfect home. To get started, what's your budget range?",
            "model": {
                "provider": "openai",
                "model": "gpt-4o",
                "messages": [
                    {
                        "role": "system",
                        "content": STATE_PROMPTS["QUALIFICATION"].replace(
                            "{{CONTEXT}}", 
                            "No data collected yet."
                        )
                    }
                ]
            }
        }
    }

async def handle_tool_calls(call_id: str, tool_calls: List[Dict]) -> Dict:
    """Process state transition tool calls"""
    if not tool_calls:
        return {"results": []}

    results = []
    
    for tool_call in tool_calls:
        tool_name = tool_call.get("name")
        tool_id = tool_call.get("id")
        parameters = tool_call.get("parameters", {})
        
        if tool_name == "update_system_prompt":
            # Extract parameters
            new_state = parameters.get("new_state")
            context_update = parameters.get("context", {})
            
            # Attempt state transition
            success = state_manager.transition_state(call_id, new_state, context_update)
            
            if success:
                # Get updated state
                call_state = state_manager.get_state(call_id)
                
                # Generate new system prompt with injected context
                prompt_template = STATE_PROMPTS[new_state]
                context_str = json.dumps(call_state.context) if call_state else "{}"
                new_prompt = prompt_template.replace("{{CONTEXT}}", context_str)
                
                # Replace placeholders for specific keys if they exist in context (simple templating)
                if call_state:
                     for key, value in call_state.context.items():
                         placeholder = f"{{{{{key}}}}}" # {{key}}
                         if placeholder in new_prompt:
                             new_prompt = new_prompt.replace(placeholder, str(value))
                
                # Return success with prompt override
                results.append({
                    "toolCallId": tool_id,
                    "result": json.dumps({"status": "success", "new_state": new_state}),
                    "assistantOverride": {
                        "model": {
                            "messages": [
                                {
                                    "role": "system",
                                    "content": new_prompt
                                }
                            ]
                        }
                    }
                })
            else:
                # Invalid transition
                results.append({
                    "toolCallId": tool_id,
                    "result": json.dumps({
                        "status": "error", 
                        "message": f"Invalid transition to {new_state}"
                    })
                })
        else:
            # Unknown tool
            results.append({
                "toolCallId": tool_id,
                "result": json.dumps({
                    "status": "error",
                    "message": f"Unknown tool: {tool_name}"
                })
            })
    
    return {"results": results}

async def handle_end_of_call(call_id: str):
    """Cleanup call state when call ends"""
    state_manager.cleanup_call(call_id)

@app.post("/vapi/state-webhook")
async def handle_vapi_webhook(request: VapiWebhookRequest):
    """
    Main webhook endpoint for Vapi
    Handles assistant-request, tool-calls, and end-of-call-report
    """
    message_type = request.message.get("type")
    call_id = request.message.get("call", {}).get("id")

    if not call_id:
        raise HTTPException(status_code=400, detail="Missing call.id")
    
    # Route to appropriate handler
    if message_type == "assistant-request":
        return await handle_assistant_request(call_id)
    
    elif message_type == "tool-calls":
        tool_calls = request.message.get("toolCallList", [])
        return await handle_tool_calls(call_id, tool_calls)
    
    elif message_type == "end-of-call-report":
        await handle_end_of_call(call_id)
        return {"status": "processed"}
    
    else:
        # Other message types don't require responses
        return {"status": "ignored"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
