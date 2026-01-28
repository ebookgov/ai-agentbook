from datetime import datetime
from typing import Dict, Optional, Any
from pydantic import BaseModel
import logging
import redis.asyncio as redis
import os

class CallContext(BaseModel):
    """Per-call context storage"""
    state: str
    context: Dict[str, Any]
    timestamp: datetime
    last_activity: datetime

class StateManager:
    """
    Redis-backed state manager for Vapi calls.
    Uses Redis for state persistence across workers/restarts.
    """

    VALID_STATES = {"QUALIFICATION", "BOOKING", "CONFIRMATION"}
    
    # State transition graph
    TRANSITIONS = {
        "QUALIFICATION": {"BOOKING"},
        "BOOKING": {"CONFIRMATION"},
        "CONFIRMATION": set()  # Terminal state
    }
    
    def __init__(self, redis_url: Optional[str] = None):
        self.redis_url = redis_url or os.getenv("REDIS_URL", "redis://localhost:6379/0")
        self.redis_client: Optional[redis.Redis] = None
        self.ttl_seconds = 3600 # 1 hour TTL
        
    async def connect(self):
        """Initialize Redis connection."""
        if not self.redis_client:
            self.redis_client = await redis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True,
                health_check_interval=30
            )

    async def disconnect(self):
        """Close Redis connection."""
        if self.redis_client:
            await self.redis_client.close()

    def _get_key(self, call_id: str) -> str:
        return f"vapi:call:{call_id}"

    async def init_call(self, call_id: str, initial_state: str = "QUALIFICATION") -> CallContext:
        """Initialize call state in Redis."""
        if not self.redis_client:
            await self.connect()

        key = self._get_key(call_id)
        
        # Check if exists
        existing = await self.redis_client.get(key)
        if existing:
            return CallContext.model_validate_json(existing)

        # Create new
        ctx = CallContext(
            state=initial_state,
            context={},
            timestamp=datetime.utcnow(),
            last_activity=datetime.utcnow()
        )
        
        await self.redis_client.set(
            key, 
            ctx.model_dump_json(),
            ex=self.ttl_seconds
        )
        return ctx
    
    async def get_state(self, call_id: str) -> Optional[CallContext]:
        """Retrieve state from Redis."""
        if not self.redis_client:
            await self.connect()

        key = self._get_key(call_id)
        data = await self.redis_client.get(key)
        
        if data:
            ctx = CallContext.model_validate_json(data)
            return ctx
        return None
    
    async def transition_state(self, call_id: str, new_state: str, 
                        context_update: Optional[Dict] = None) -> bool:
        """
        Validate and execute state transition.
        """
        if not self.redis_client:
            await self.connect()

        key = self._get_key(call_id)
        
        data = await self.redis_client.get(key)
        if not data:
            return False
            
        current_ctx = CallContext.model_validate_json(data)
        
        # Validate logic
        if new_state not in self.VALID_STATES:
            logging.warning(f"Invalid state: {new_state}")
            return False
            
        if new_state not in self.TRANSITIONS.get(current_ctx.state, set()):
             logging.warning(f"Invalid transition: {current_ctx.state} -> {new_state}")
             return False
        
        # Update
        current_ctx.state = new_state
        if context_update:
            current_ctx.context.update(context_update)
        current_ctx.last_activity = datetime.utcnow()
        
        await self.redis_client.set(
            key,
            current_ctx.model_dump_json(),
            ex=self.ttl_seconds
        )
        return True
    
    async def cleanup_call(self, call_id: str):
        """Remove call state."""
        if not self.redis_client:
            await self.connect()
        await self.redis_client.delete(self._get_key(call_id))

# Singleton instance
state_manager = StateManager()
