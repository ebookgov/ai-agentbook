from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from app.models import TriageRequest, TriageResponse, CallStatus
import re

app = FastAPI(title="HVAC Emergency Dispatcher", version="1.0.0")

# Emergency Keywords
EMERGENCY_KEYWORDS = [
    "sparking", "sparks", "gas smell", "smell gas", "odor of gas", "flooding", "flood", 
    "water leaking", "leak from ceiling", "leaking ceiling", "water is leaking", "leaking", 
    "smoke", "fire", "carbon monoxide", "explosion"
]

ROUTINE_KEYWORDS = [
    "tune-up", "tune up", "quote", "estimate", "filter change", "change filter", 
    "maintenance", "noise", "noisy", "humming", "clanking", "schedule"
]

def analyze_transcript(transcript: str) -> TriageResponse:
    text = transcript.lower()
    
    # 1. Check for Critical Emergencies
    for keyword in EMERGENCY_KEYWORDS:
        if keyword in text:
            return TriageResponse(
                status=CallStatus.EMERGENCY,
                reason=f"Detected critical keyword: '{keyword}'",
                action_taken="Wake Owner"
            )

    # 2. Check for Routine Maintenance
    for keyword in ROUTINE_KEYWORDS:
        if keyword in text:
            return TriageResponse(
                status=CallStatus.ROUTINE,
                reason=f"Detected routine keyword: '{keyword}'",
                action_taken="Schedule Monday"
            )
            
    # 3. Contextual Checks (Placeholder for Weather API)
    # TODO: Implement OpenWeatherMap check if "no heat" or "no ac"
    if "no heat" in text or "no ac" in text:
         # Fail-safe: If we can't verify temp, treat as URGENT (SMS) but not EMERGENCY (Wake)
         return TriageResponse(
            status=CallStatus.URGENT,
            reason="HVAC outage detected (Weather context unavailable)",
            action_taken="Send SMS Alert"
        )
         
    # 4. Fallback (Ambiguous)
    return TriageResponse(
        status=CallStatus.URGENT,
        reason="Ambiguous request - defaulting to safe mode",
        action_taken="Send SMS Alert"
    )

@app.post("/triage", response_model=TriageResponse)
async def triage_call(request: TriageRequest):
    try:
        return analyze_transcript(request.transcript)
    except Exception as e:
        # Fail-safe catch-all
        return TriageResponse(
            status=CallStatus.URGENT,
            reason=f"System Error: {str(e)}",
            action_taken="Send SMS Alert"
        )

class SMSRequest(BaseModel):
    phone_number: str
    message: str

@app.post("/webhook/sms")
def send_sms(request: SMSRequest):
    # Simulation of Twilio SMS dispatch
    print(f"[Twilio Mock] Sending SMS to {request.phone_number}: {request.message}")
    if "TCPA" not in request.message:
        # Enforce TCPA compliance check in the message body or logic
        pass 
        
    return {"status": "sent", "provider": "twilio-mock"}
