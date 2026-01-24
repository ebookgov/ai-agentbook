from datetime import datetime, timedelta
from typing import Dict, Optional, Any
from pydantic import BaseModel
import asyncio

class CallContext(BaseModel):
    """Per-call context storage"""
    state: str
    context: Dict[str, Any]
    timestamp: datetime
    last_activity: datetime

class StateManager:
    """
    Transient state manager with TTL cleanup
    Stores state in-memory for <10ms access latency
    """

    VALID_STATES = {"QUALIFICATION", "BOOKING", "CONFIRMATION"}
    
    # State transition graph: which states can transition to which
    TRANSITIONS = {
        "QUALIFICATION": {"BOOKING"},
        "BOOKING": {"CONFIRMATION"},
        "CONFIRMATION": set()  # Terminal state
    }
    
    def __init__(self, ttl_minutes: int = 60):
        self.states: Dict[str, CallContext] = {}
        self.ttl_minutes = ttl_minutes
        self.cleanup_task = None
        
    def start_cleanup_task(self):
        """Start background TTL cleanup"""
        if not self.cleanup_task:
            self.cleanup_task = asyncio.create_task(self._cleanup_expired())
    
    async def _cleanup_expired(self):
        """Remove expired call states every 5 minutes"""
        while True:
            await asyncio.sleep(300)  # 5 minutes
            now = datetime.utcnow()
            expired = [
                call_id for call_id, state in self.states.items()
                if now - state.last_activity > timedelta(minutes=self.ttl_minutes)
            ]
            for call_id in expired:
                del self.states[call_id]
    
    def init_call(self, call_id: str, initial_state: str = "QUALIFICATION") -> CallContext:
        """Initialize call state on first webhook hit"""
        if call_id not in self.states:
            self.states[call_id] = CallContext(
                state=initial_state,
                context={},
                timestamp=datetime.utcnow(),
                last_activity=datetime.utcnow()
            )
        return self.states[call_id]
    
    def get_state(self, call_id: str) -> Optional[CallContext]:
        """Retrieve state with O(1) lookup"""
        state = self.states.get(call_id)
        if state:
            state.last_activity = datetime.utcnow()
        return state
    
    def transition_state(self, call_id: str, new_state: str, 
                        context_update: Optional[Dict] = None) -> bool:
        """
        Validate and execute state transition
        Returns True if successful, False if invalid
        """
        if call_id not in self.states:
            return False
        
        current_state = self.states[call_id]
        
        # Validate state exists
        if new_state not in self.VALID_STATES:
            return False
        
        # Validate transition is allowed
        if new_state not in self.TRANSITIONS.get(current_state.state, set()):
            return False
        
        # Update state
        current_state.state = new_state
        if context_update:
            current_state.context.update(context_update)
        current_state.last_activity = datetime.utcnow()
        
        return True
    
    def cleanup_call(self, call_id: str):
        """Explicitly remove call state (call ended)"""
        if call_id in self.states:
            del self.states[call_id]

# Singleton instance
state_manager = StateManager()
