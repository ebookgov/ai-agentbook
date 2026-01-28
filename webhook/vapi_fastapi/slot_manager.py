import uuid
import asyncio
from datetime import datetime, timedelta, timezone as dt_timezone
from typing import Optional, Tuple
import logging
import redis.asyncio as redis

class SlotManager:
    """
    Manages temporary slot holds using Redis SETNX (atomic SET if Not eXists).
    """
    
    def __init__(self, redis_url: str = "redis://localhost:6379/0"):
        """
        Args:
            redis_url: Redis connection string
        """
        self.redis_url = redis_url
        self.redis_client: Optional[redis.Redis] = None
        self.hold_ttl_seconds = 60  # 60-second hold window for voice confirmation
    
    async def connect(self):
        """Initialize Redis connection pool."""
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
    
    def _get_slot_key(self, slot_id: str) -> str:
        """Redis key naming: slot:SLOTID"""
        return f"slot:{slot_id}"
    
    async def acquire_hold(
        self, 
        slot_id: str, 
        call_id: str,
        user_email: str = ""
    ) -> Tuple[bool, Optional[str]]:
        """
        Attempt to hold a slot during voice booking.
        """
        if not self.redis_client:
             await self.connect()

        key = self._get_slot_key(slot_id)
        
        # Create unique hold identifier
        hold_id = str(uuid.uuid4())
        hold_metadata = f"{call_id}|{user_email}|{int(datetime.now(dt_timezone.utc).timestamp())}"
        
        try:
            # Atomic: SET slot_id hold_metadata NX PX 60000
            result = await self.redis_client.set(
                key,
                f"{hold_id}:{hold_metadata}",
                nx=True,  # Only if not exists
                px=self.hold_ttl_seconds * 1000  # TTL in milliseconds
            )
            
            if result:
                # Success: acquired the hold
                return True, hold_id
            else:
                # Failed: slot already held
                existing = await self.redis_client.get(key)
                existing_call = existing.split("|")[0] if existing else "unknown"
                return False, f"Slot already held by other caller"
        
        except Exception as e:
            return False, f"Redis error: {str(e)}"
    
    async def release_hold(self, slot_id: str, hold_id: str) -> bool:
        """
        Release a hold after booking succeeds.
        """
        if not self.redis_client:
             await self.connect()

        key = self._get_slot_key(slot_id)
        
        try:
            existing = await self.redis_client.get(key)
            
            if not existing:
                return False
            
            # Verify hold_id matches
            stored_hold_id = existing.split(":")[0]
            if stored_hold_id != hold_id:
                return False
            
            # Delete the key
            await self.redis_client.delete(key)
            return True
        
        except Exception as e:
            logging.error(f"Error releasing hold: {str(e)}", exc_info=True)
            return False
    
    async def extend_hold(
        self, 
        slot_id: str, 
        hold_id: str,
        extra_seconds: int = 30
    ) -> bool:
        """
        Extend a hold if user is still on call.
        """
        if not self.redis_client:
             await self.connect()

        key = self._get_slot_key(slot_id)
        max_extend_seconds = 30
        extend_seconds = min(extra_seconds, max_extend_seconds)
        
        try:
            existing = await self.redis_client.get(key)
            
            if not existing:
                return False
            
            stored_hold_id = existing.split(":")[0]
            if stored_hold_id != hold_id:
                return False
            
            # Extend TTL
            await self.redis_client.pexpire(
                key, 
                self.hold_ttl_seconds * 1000 + extend_seconds * 1000
            )
            return True
        
        except Exception as e:
            logging.error(f"Error extending hold: {str(e)}", exc_info=True)
            return False
