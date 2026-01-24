from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from typing import Optional, Tuple
import re

# Constants
ARIZONA_TZ = ZoneInfo("America/Phoenix")  # MST, no DST
UTC_TZ = ZoneInfo("UTC")

# Business hours: 8am-6pm MST
BUSINESS_START_HOUR = 8
BUSINESS_END_HOUR = 18
SLOT_DURATION_MINUTES = 30
MIN_ADVANCE_MINUTES = 15  # Can't book in past or <15min away

# Timezone mappings (common US zones)
COMMON_TIMEZONES = {
    "EST": ZoneInfo("America/New_York"),      # -5
    "EDT": ZoneInfo("America/New_York"),      # EDT variant (same zone)
    "CST": ZoneInfo("America/Chicago"),       # -6
    "CDT": ZoneInfo("America/Chicago"),       # CDT variant
    "MST": ZoneInfo("America/Denver"),        # Mountain (NOT Arizona)
    "MDT": ZoneInfo("America/Denver"),        # MDT variant
    "PST": ZoneInfo("America/Los_Angeles"),   # -8
    "PDT": ZoneInfo("America/Los_Angeles"),   # -7
    "Arizona": ARIZONA_TZ,
}


class TimeSlot:
    """Represents a bookable time slot in Arizona (MST)."""
    
    def __init__(self, start: datetime, duration_minutes: int = SLOT_DURATION_MINUTES):
        """
        Args:
            start: Datetime in Arizona TZ
            duration_minutes: Length of slot (default 30)
        """
        self.start = start.astimezone(ARIZONA_TZ) if start.tzinfo else start.replace(tzinfo=ARIZONA_TZ)
        self.end = self.start + timedelta(minutes=duration_minutes)
    
    def to_voice_string(self) -> str:
        """Convert to voice-friendly format: 'Tuesday, Jan 23rd at 3pm'"""
        day_name = self.start.strftime("%A")
        day_num = self.start.day
        month_abbr = self.start.strftime("%b")
        
        # Ordinal suffix
        if day_num in [1, 21, 31]:
            suffix = "st"
        elif day_num in [2, 22]:
            suffix = "nd"
        elif day_num in [3, 23]:
            suffix = "rd"
        else:
            suffix = "th"
        
        hour = self.start.hour
        am_pm = "am" if hour < 12 else "pm"
        if hour > 12:
            hour -= 12
        elif hour == 0:
            hour = 12
        
        # Add 'today' or 'tomorrow' if applicable
        now = datetime.now(ARIZONA_TZ)
        if self.start.date() == now.date():
            relative_day = "Today, "
        elif self.start.date() == (now + timedelta(days=1)).date():
            relative_day = "Tomorrow, "
        else:
            relative_day = ""

        return f"{relative_day}{day_name}, {month_abbr} {day_num}{suffix} at {hour}{am_pm}"
    
    def to_iso(self) -> str:
        """ISO 8601 in Arizona TZ"""
        return self.start.isoformat()
    
    def overlaps(self, other: "TimeSlot") -> bool:
        """Check if two slots overlap"""
        return self.start < other.end and other.start < self.end


def parse_caller_time(user_input: str, caller_timezone_abbr: str = "EST") -> datetime:
    """
    Parse user voice input like "3pm" and convert to Arizona time.
    """
    # Extract hour from voice input
    time_patterns = [
        r"(\d{1,2})\s*(?:am|a\.m\.)",
        r"(\d{1,2})\s*(?:pm|p\.m\.)",
        r"(?:at\s+)?(\d{1,2})\s*(?:o'clock)?",
    ]
    
    hour = None
    is_pm = "pm" in user_input.lower()
    
    for pattern in time_patterns:
        match = re.search(pattern, user_input.lower())
        if match:
            hour = int(match.group(1))
            if is_pm and hour != 12:
                hour += 12
            elif not is_pm and hour == 12:
                hour = 0
            break
    
    if hour is None:
        raise ValueError(f"Could not parse time from: {user_input}")
    
    # Get caller's timezone
    caller_tz = COMMON_TIMEZONES.get(caller_timezone_abbr.upper(), ZoneInfo("America/New_York"))
    
    # Create time in caller's timezone (today)
    now_utc = datetime.now(UTC_TZ)
    caller_now = now_utc.astimezone(caller_tz)
    
    # Build time for today at requested hour in caller's TZ
    caller_time = caller_now.replace(hour=hour, minute=0, second=0, microsecond=0)
    
    # If time is in past today, assume next day
    if caller_time < caller_now:
        caller_time += timedelta(days=1)
    
    # Convert to Arizona TZ
    arizona_time = caller_time.astimezone(ARIZONA_TZ)
    
    return arizona_time


def validate_business_hours(slot: TimeSlot) -> Tuple[bool, Optional[str]]:
    """
    Validate slot is within business hours (8am-6pm MST).
    """
    hour_start = slot.start.hour
    hour_end = slot.end.hour
    
    # Check day of week (0=Monday, 6=Sunday)
    # Optional: Disallow weekends if needed
    
    if hour_start < BUSINESS_START_HOUR:
        return False, f"Slot starts before {BUSINESS_START_HOUR}am MST"
    if hour_end > BUSINESS_END_HOUR or (hour_end == BUSINESS_END_HOUR and slot.end.minute > 0):
        return False, f"Slot ends after {BUSINESS_END_HOUR}:00 MST"
    
    return True, None


def get_next_available_slots(blocked_times: list[TimeSlot], count: int = 3) -> list[TimeSlot]:
    """
    Generate next available 30-minute slots, excluding blocked times.
    """
    slots: list[TimeSlot] = []
    current_time = datetime.now(ARIZONA_TZ)
    search_time = current_time + timedelta(minutes=MIN_ADVANCE_MINUTES)
    
    # Ensure within business hours
    if search_time.hour < BUSINESS_START_HOUR:
        search_time = search_time.replace(hour=BUSINESS_START_HOUR, minute=0)
    elif search_time.hour >= BUSINESS_END_HOUR:
        search_time = (search_time + timedelta(days=1)).replace(
            hour=BUSINESS_START_HOUR, minute=0
        )
    
    # Align to slot boundary (nearest 30-min)
    minute_block = (search_time.minute // SLOT_DURATION_MINUTES) * SLOT_DURATION_MINUTES
    if search_time.minute % SLOT_DURATION_MINUTES != 0:
         minute_block += SLOT_DURATION_MINUTES # Round up to next slot
    
    if minute_block >= 60:
        search_time = search_time.replace(hour=search_time.hour + 1, minute=0, second=0, microsecond=0)
    else:
        search_time = search_time.replace(minute=minute_block, second=0, microsecond=0)

    
    max_search_days = 14  # Search up to 2 weeks ahead
    days_searched = 0
    
    while len(slots) < count and days_searched < max_search_days:
        # Generate slots for this day
        current_slot_time = search_time
        
        # Iterate through the day until end of business hours
        while (current_slot_time.hour < BUSINESS_END_HOUR and 
               len(slots) < count):
            
            # Additional check: Don't schedule exactly at closing time if duration pushes past it
            
            slot = TimeSlot(current_slot_time)
            
            # Check if slot conflicts with any blocked time
            conflicts = any(slot.overlaps(blocked) for blocked in blocked_times)
            
            if not conflicts:
                slots.append(slot)
            
            current_slot_time += timedelta(minutes=SLOT_DURATION_MINUTES)
        
        # Move to next day start
        search_time = (search_time + timedelta(days=1)).replace(
            hour=BUSINESS_START_HOUR, minute=0
        )
        days_searched += 1
    
    return slots
