from enum import Enum
from pydantic import BaseModel, Field
from typing import Optional

class CallStatus(str, Enum):
    EMERGENCY = "EMERGENCY"
    URGENT = "URGENT"
    ROUTINE = "ROUTINE"

class TriageRequest(BaseModel):
    transcript: str = Field(..., description="The full transcript of the caller's query")
    caller_id: Optional[str] = Field(None, description="Caller's phone number")

class TriageResponse(BaseModel):
    status: CallStatus
    reason: str
    action_taken: str
