"""
Validation Utilities
Common validation functions
"""
import re
from typing import Optional
from datetime import datetime, date


def validate_email(email: str) -> tuple[bool, Optional[str]]:
    """
    Validate email format
    
    Args:
        email: Email address to validate
    
    Returns:
        Tuple of (is_valid, error_message)
    
    Example:
        is_valid, error = validate_email("user@example.com")
        if not is_valid:
            raise HTTPException(400, error)
    """
    if not email:
        return False, "Email is required"
    
    # Basic email regex pattern
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    
    if not re.match(pattern, email):
        return False, "Invalid email format"
    
    if len(email) > 254:  # RFC 5321
        return False, "Email address is too long"
    
    return True, None


def validate_username(username: str, min_length: int = 3, max_length: int = 30) -> tuple[bool, Optional[str]]:
    """
    Validate username format
    
    Args:
        username: Username to validate
        min_length: Minimum username length
        max_length: Maximum username length
    
    Returns:
        Tuple of (is_valid, error_message)
    
    Example:
        is_valid, error = validate_username("john_doe")
        if not is_valid:
            raise HTTPException(400, error)
    """
    if not username:
        return False, "Username is required"
    
    if len(username) < min_length:
        return False, f"Username must be at least {min_length} characters"
    
    if len(username) > max_length:
        return False, f"Username must not exceed {max_length} characters"
    
    # Only alphanumeric and underscore
    if not re.match(r'^[a-zA-Z0-9_]+$', username):
        return False, "Username can only contain letters, numbers, and underscores"
    
    # Must start with letter
    if not username[0].isalpha():
        return False, "Username must start with a letter"
    
    return True, None


def validate_phone_number(phone: str, country_code: str = "VN") -> tuple[bool, Optional[str]]:
    """
    Validate phone number format
    
    Args:
        phone: Phone number to validate
        country_code: Country code (default: VN for Vietnam)
    
    Returns:
        Tuple of (is_valid, error_message)
    
    Example:
        is_valid, error = validate_phone_number("0123456789")
        if not is_valid:
            raise HTTPException(400, error)
    """
    if not phone:
        return False, "Phone number is required"
    
    # Remove spaces, hyphens, parentheses
    cleaned = re.sub(r'[\s\-\(\)]', '', phone)
    
    if country_code == "VN":
        # Vietnam phone number: 10 digits starting with 0
        pattern = r'^0\d{9}$'
        if not re.match(pattern, cleaned):
            return False, "Invalid Vietnamese phone number format (must be 10 digits starting with 0)"
    else:
        # Generic international format
        if not re.match(r'^\+?\d{8,15}$', cleaned):
            return False, "Invalid phone number format"
    
    return True, None


def validate_price(price: int, min_price: int = 0, max_price: int = None) -> tuple[bool, Optional[str]]:
    """
    Validate price value
    
    Args:
        price: Price to validate
        min_price: Minimum allowed price
        max_price: Maximum allowed price (None for no limit)
    
    Returns:
        Tuple of (is_valid, error_message)
    
    Example:
        is_valid, error = validate_price(1000000, min_price=0)
        if not is_valid:
            raise HTTPException(400, error)
    """
    if price < min_price:
        return False, f"Price must be at least {min_price:,} VND"
    
    if max_price and price > max_price:
        return False, f"Price must not exceed {max_price:,} VND"
    
    return True, None


def validate_date_range(
    start_date: datetime,
    end_date: datetime,
    min_duration_hours: int = None,
    max_duration_days: int = None
) -> tuple[bool, Optional[str]]:
    """
    Validate date range
    
    Args:
        start_date: Start datetime
        end_date: End datetime
        min_duration_hours: Minimum duration in hours
        max_duration_days: Maximum duration in days
    
    Returns:
        Tuple of (is_valid, error_message)
    
    Example:
        is_valid, error = validate_date_range(
            auction.startDate,
            auction.endDate,
            min_duration_hours=24,
            max_duration_days=30
        )
    """
    if end_date <= start_date:
        return False, "End date must be after start date"
    
    duration = end_date - start_date
    
    if min_duration_hours:
        if duration.total_seconds() < min_duration_hours * 3600:
            return False, f"Duration must be at least {min_duration_hours} hours"
    
    if max_duration_days:
        if duration.days > max_duration_days:
            return False, f"Duration must not exceed {max_duration_days} days"
    
    return True, None


def validate_age(birthdate: date, min_age: int = 18) -> tuple[bool, Optional[str]]:
    """
    Validate age from birthdate
    
    Args:
        birthdate: Date of birth
        min_age: Minimum required age
    
    Returns:
        Tuple of (is_valid, error_message)
    
    Example:
        is_valid, error = validate_age(user.dateOfBirth, min_age=18)
        if not is_valid:
            raise HTTPException(400, error)
    """
    if birthdate > date.today():
        return False, "Birthdate cannot be in the future"
    
    today = date.today()
    age = today.year - birthdate.year
    
    # Adjust if birthday hasn't occurred this year
    if (today.month, today.day) < (birthdate.month, birthdate.day):
        age -= 1
    
    if age < min_age:
        return False, f"Must be at least {min_age} years old"
    
    if age > 150:
        return False, "Invalid birthdate"
    
    return True, None


def validate_url(url: str) -> tuple[bool, Optional[str]]:
    """
    Validate URL format
    
    Args:
        url: URL to validate
    
    Returns:
        Tuple of (is_valid, error_message)
    
    Example:
        is_valid, error = validate_url("https://example.com/image.jpg")
        if not is_valid:
            raise HTTPException(400, error)
    """
    if not url:
        return False, "URL is required"
    
    # URL regex pattern
    pattern = r'^https?://[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,}(/\S*)?$'
    
    if not re.match(pattern, url):
        return False, "Invalid URL format"
    
    if len(url) > 2048:
        return False, "URL is too long"
    
    return True, None


def validate_file_size(file_size: int, max_size_mb: int = 5) -> tuple[bool, Optional[str]]:
    """
    Validate file size
    
    Args:
        file_size: File size in bytes
        max_size_mb: Maximum size in MB
    
    Returns:
        Tuple of (is_valid, error_message)
    
    Example:
        is_valid, error = validate_file_size(file.size, max_size_mb=5)
        if not is_valid:
            raise HTTPException(400, error)
    """
    max_size_bytes = max_size_mb * 1024 * 1024
    
    if file_size > max_size_bytes:
        return False, f"File size must not exceed {max_size_mb}MB"
    
    if file_size <= 0:
        return False, "File is empty"
    
    return True, None


def validate_image_extension(filename: str) -> tuple[bool, Optional[str]]:
    """
    Validate image file extension
    
    Args:
        filename: Name of file
    
    Returns:
        Tuple of (is_valid, error_message)
    
    Example:
        is_valid, error = validate_image_extension("product.jpg")
        if not is_valid:
            raise HTTPException(400, error)
    """
    allowed_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
    
    extension = filename.lower().split('.')[-1] if '.' in filename else ''
    extension = f'.{extension}'
    
    if extension not in allowed_extensions:
        return False, f"Invalid image format. Allowed: {', '.join(allowed_extensions)}"
    
    return True, None


def sanitize_string(text: str, max_length: int = None) -> str:
    """
    Sanitize user input string
    
    Args:
        text: Text to sanitize
        max_length: Maximum length (truncate if longer)
    
    Returns:
        Sanitized string
    
    Example:
        clean_text = sanitize_string(user_input, max_length=500)
    """
    if not text:
        return ""
    
    # Remove leading/trailing whitespace
    text = text.strip()
    
    # Remove multiple spaces
    text = re.sub(r'\s+', ' ', text)
    
    # Remove potentially dangerous characters
    text = re.sub(r'[<>]', '', text)
    
    # Truncate if needed
    if max_length and len(text) > max_length:
        text = text[:max_length]
    
    return text