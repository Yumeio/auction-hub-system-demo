"""
Date and Time Utilities
Common date/time operations
"""
from datetime import datetime, timedelta, date
from typing import Optional
import pytz


def get_current_datetime(timezone: str = "UTC") -> datetime:
    """
    Get current datetime in specified timezone
    
    Args:
        timezone: Timezone name (default: UTC)
    
    Returns:
        Current datetime in specified timezone
    
    Example:
        now_vn = get_current_datetime("Asia/Ho_Chi_Minh")
        now_utc = get_current_datetime()
    """
    tz = pytz.timezone(timezone)
    return datetime.now(tz)


def convert_timezone(dt: datetime, from_tz: str, to_tz: str) -> datetime:
    """
    Convert datetime from one timezone to another
    
    Args:
        dt: Datetime to convert
        from_tz: Source timezone
        to_tz: Target timezone
    
    Returns:
        Converted datetime
    
    Example:
        utc_time = datetime.utcnow()
        vn_time = convert_timezone(utc_time, "UTC", "Asia/Ho_Chi_Minh")
    """
    if dt.tzinfo is None:
        # Assume it's in from_tz
        from_zone = pytz.timezone(from_tz)
        dt = from_zone.localize(dt)
    
    to_zone = pytz.timezone(to_tz)
    return dt.astimezone(to_zone)


def format_datetime(
    dt: datetime,
    format_type: str = "full",
    locale: str = "vi_VN"
) -> str:
    """
    Format datetime for display
    
    Args:
        dt: Datetime to format
        format_type: Type of format ("full", "date", "time", "short")
        locale: Locale for formatting
    
    Returns:
        Formatted datetime string
    
    Example:
        formatted = format_datetime(auction.endDate, "full")
        # Output: "2025-12-10 15:30:00"
    """
    if format_type == "full":
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    elif format_type == "date":
        return dt.strftime("%Y-%m-%d")
    elif format_type == "time":
        return dt.strftime("%H:%M:%S")
    elif format_type == "short":
        return dt.strftime("%d/%m/%Y %H:%M")
    elif format_type == "readable":
        if locale == "vi_VN":
            return dt.strftime("%d tháng %m, %Y lúc %H:%M")
        else:
            return dt.strftime("%B %d, %Y at %H:%M")
    else:
        return dt.isoformat()


def get_time_difference(dt1: datetime, dt2: datetime) -> timedelta:
    """
    Calculate time difference between two datetimes
    
    Args:
        dt1: First datetime
        dt2: Second datetime
    
    Returns:
        Timedelta representing difference
    
    Example:
        diff = get_time_difference(auction.endDate, datetime.utcnow())
        hours_remaining = diff.total_seconds() / 3600
    """
    return dt1 - dt2


def format_time_remaining(dt: datetime, now: Optional[datetime] = None) -> str:
    """
    Format remaining time in human-readable format
    
    Args:
        dt: Target datetime
        now: Current datetime (default: now)
    
    Returns:
        Formatted string like "2 hours 30 minutes" or "Ended"
    
    Example:
        remaining = format_time_remaining(auction.endDate)
        # Output: "2 days 5 hours"
    """
    if now is None:
        now = datetime.now()
    
    diff = dt - now
    
    if diff.total_seconds() <= 0:
        return "Ended"
    
    days = diff.days
    hours = diff.seconds // 3600
    minutes = (diff.seconds % 3600) // 60
    
    parts = []
    if days > 0:
        parts.append(f"{days} day{'s' if days != 1 else ''}")
    if hours > 0:
        parts.append(f"{hours} hour{'s' if hours != 1 else ''}")
    if minutes > 0 and days == 0:  # Only show minutes if less than a day
        parts.append(f"{minutes} minute{'s' if minutes != 1 else ''}")
    
    if not parts:
        return "Less than a minute"
    
    return " ".join(parts[:2])  # Show at most 2 units


def format_time_ago(dt: datetime, now: Optional[datetime] = None) -> str:
    """
    Format datetime as "X time ago"
    
    Args:
        dt: Past datetime
        now: Current datetime (default: now)
    
    Returns:
        Formatted string like "2 hours ago"
    
    Example:
        ago = format_time_ago(bid.createdAt)
        # Output: "5 minutes ago"
    """
    if now is None:
        now = datetime.now()
    
    diff = now - dt
    
    if diff.total_seconds() < 0:
        return "just now"
    
    seconds = diff.total_seconds()
    
    if seconds < 60:
        return "just now"
    elif seconds < 3600:
        minutes = int(seconds / 60)
        return f"{minutes} minute{'s' if minutes != 1 else ''} ago"
    elif seconds < 86400:
        hours = int(seconds / 3600)
        return f"{hours} hour{'s' if hours != 1 else ''} ago"
    elif diff.days < 30:
        days = diff.days
        return f"{days} day{'s' if days != 1 else ''} ago"
    elif diff.days < 365:
        months = diff.days // 30
        return f"{months} month{'s' if months != 1 else ''} ago"
    else:
        years = diff.days // 365
        return f"{years} year{'s' if years != 1 else ''} ago"


def is_within_time_window(
    target_dt: datetime,
    window_start: datetime,
    window_end: datetime
) -> bool:
    """
    Check if datetime is within time window
    
    Args:
        target_dt: Datetime to check
        window_start: Start of window
        window_end: End of window
    
    Returns:
        True if within window, False otherwise
    
    Example:
        is_ongoing = is_within_time_window(
            datetime.utcnow(),
            auction.startDate,
            auction.endDate
        )
    """
    return window_start <= target_dt <= window_end


def add_business_days(start_date: date, days: int) -> date:
    """
    Add business days (excluding weekends)
    
    Args:
        start_date: Starting date
        days: Number of business days to add
    
    Returns:
        Resulting date
    
    Example:
        delivery_date = add_business_days(date.today(), 5)
    """
    current = start_date
    added = 0
    
    while added < days:
        current += timedelta(days=1)
        # Skip weekends (Saturday=5, Sunday=6)
        if current.weekday() < 5:
            added += 1
    
    return current


def get_date_range(start: date, end: date) -> list[date]:
    """
    Get list of dates in range
    
    Args:
        start: Start date
        end: End date
    
    Returns:
        List of dates from start to end (inclusive)
    
    Example:
        dates = get_date_range(date(2025, 12, 1), date(2025, 12, 5))
        # [date(2025, 12, 1), date(2025, 12, 2), ...]
    """
    dates = []
    current = start
    while current <= end:
        dates.append(current)
        current += timedelta(days=1)
    return dates


def calculate_age(birthdate: date) -> int:
    """
    Calculate age from birthdate
    
    Args:
        birthdate: Date of birth
    
    Returns:
        Age in years
    
    Example:
        age = calculate_age(user.dateOfBirth)
        if age < 18:
            print("User is a minor")
    """
    today = date.today()
    age = today.year - birthdate.year
    
    # Adjust if birthday hasn't occurred this year
    if (today.month, today.day) < (birthdate.month, birthdate.day):
        age -= 1
    
    return age


def is_expired(expiry_dt: datetime, now: Optional[datetime] = None) -> bool:
    """
    Check if datetime has expired
    
    Args:
        expiry_dt: Expiry datetime
        now: Current datetime (default: now)
    
    Returns:
        True if expired, False otherwise
    
    Example:
        if is_expired(auction.endDate):
            print("Auction has ended")
    """
    if now is None:
        now = datetime.now()
    return expiry_dt < now


def get_start_of_day(dt: Optional[datetime] = None) -> datetime:
    """
    Get start of day (00:00:00)
    
    Args:
        dt: Datetime (default: now)
    
    Returns:
        Datetime at start of day
    
    Example:
        today_start = get_start_of_day()
    """
    if dt is None:
        dt = datetime.now()
    return dt.replace(hour=0, minute=0, second=0, microsecond=0)


def get_end_of_day(dt: Optional[datetime] = None) -> datetime:
    """
    Get end of day (23:59:59)
    
    Args:
        dt: Datetime (default: now)
    
    Returns:
        Datetime at end of day
    
    Example:
        today_end = get_end_of_day()
    """
    if dt is None:
        dt = datetime.now()
    return dt.replace(hour=23, minute=59, second=59, microsecond=999999)


# Common timezone constants
VIETNAM_TZ = "Asia/Ho_Chi_Minh"
UTC_TZ = "UTC"
US_EASTERN_TZ = "America/New_York"
US_PACIFIC_TZ = "America/Los_Angeles"