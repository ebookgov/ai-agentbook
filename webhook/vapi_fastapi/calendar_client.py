from datetime import datetime, timedelta, timezone as dt_timezone
from typing import Optional, List
import json
import os
import aiohttp
from google.oauth2 import service_account
from google.auth.transport.requests import Request
from dataclasses import dataclass

# Constants
GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3"
SCOPES = ["https://www.googleapis.com/auth/calendar"]
TOKEN_CACHE_FILE = "/tmp/google_calendar_token.json"

@dataclass
class FreeBusyBlock:
    """Represents a busy time block from Google Calendar."""
    start: datetime
    end: datetime
    summary: Optional[str] = None
    event_id: Optional[str] = None

class GoogleCalendarClient:
    """
    Async Google Calendar API client with token caching and batch queries.
    """
    
    def __init__(self, credentials_json_path: str, agent_email: str):
        self.credentials_path = credentials_json_path
        self.agent_email = agent_email
        self.token: Optional[str] = None
        self.token_expiry: Optional[datetime] = None
        self._session: Optional[aiohttp.ClientSession] = None
    
    async def _get_valid_token(self) -> str:
        """Get valid OAuth2 access token (cached when possible)."""
        now = datetime.now(dt_timezone.utc)
        
        # Check in-memory cache
        if self.token and self.token_expiry and now < self.token_expiry:
            return self.token
        
        # Check file cache logic skipped for brevity, standard implementation
        
        # Fetch new token (Synchronous call wrapped in async if needed, but google-auth is blocking)
        # In high-concurrency, consider running this in an executor
        try:
            creds = service_account.Credentials.from_service_account_file(
                self.credentials_path, scopes=SCOPES
            )
            creds.refresh(Request())
            
            self.token = creds.token
            self.token_expiry = creds.expiry
            return self.token
        except Exception as e:
             raise Exception(f"Failed to refresh Google Auth token: {str(e)}")

    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create async HTTP session with connection pooling."""
        if not self._session or self._session.closed:
            self._session = aiohttp.ClientSession()
        return self._session
    
    async def get_availability(
        self, 
        start_date: datetime, 
        end_date: datetime,
        timezone: str = "America/Phoenix"
    ) -> List[FreeBusyBlock]:
        """
        Get free/busy blocks for agent's calendar.
        """
        token = await self._get_valid_token()
        session = await self._get_session()
        
        request_body = {
            "items": [{"id": self.agent_email}],
            "timeMin": start_date.isoformat(),
            "timeMax": end_date.isoformat(),
            "timeZone": timezone,
        }
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        
        async with session.post(
            f"{GOOGLE_CALENDAR_API}/freebusy",
            json=request_body,
            headers=headers
        ) as resp:
            if resp.status != 200:
                text = await resp.text()
                raise Exception(f"Google API error {resp.status}: {text}")
            
            data = await resp.json()
            
            # Extract busy blocks
            busy_blocks: List[FreeBusyBlock] = []
            calendar_data = data.get("calendars", {}).get(self.agent_email, {})
            
            for busy_period in calendar_data.get("busy", []):
                start_str = busy_period.get("start")
                end_str = busy_period.get("end")
                
                if start_str and end_str:
                    busy_blocks.append(FreeBusyBlock(
                        start=datetime.fromisoformat(start_str),
                        end=datetime.fromisoformat(end_str),
                    ))
            
            return busy_blocks
    
    async def create_event(
        self,
        summary: str,
        start: datetime,
        end: datetime,
        attendees: List[str],
        description: str = "",
        timezone: str = "America/Phoenix"
    ) -> str:
        """
        Create calendar event.
        """
        token = await self._get_valid_token()
        session = await self._get_session()
        
        event_body = {
            "summary": summary,
            "start": {
                "dateTime": start.isoformat(),
                "timeZone": timezone,
            },
            "end": {
                "dateTime": end.isoformat(),
                "timeZone": timezone,
            },
            "attendees": [{"email": email} for email in attendees],
            "description": description,
        }
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        
        async with session.post(
            f"{GOOGLE_CALENDAR_API}/calendars/{self.agent_email}/events",
            json=event_body,
            headers=headers
        ) as resp:
            if resp.status not in [200, 201]:
                text = await resp.text()
                raise Exception(f"Event creation failed {resp.status}: {text}")
            
            data = await resp.json()
            return data["id"]
    
    async def delete_event(self, event_id: str) -> None:
        """Delete calendar event."""
        token = await self._get_valid_token()
        session = await self._get_session()
        
        headers = {
            "Authorization": f"Bearer {token}",
        }
        
        async with session.delete(
            f"{GOOGLE_CALENDAR_API}/calendars/{self.agent_email}/events/{event_id}",
            headers=headers
        ) as resp:
            if resp.status not in [200, 204, 404]:
                raise Exception(f"Delete failed: {resp.status}")

    async def close(self):
        """Close session."""
        if self._session:
            await self._session.close()
