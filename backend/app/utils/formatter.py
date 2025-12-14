"""
Formatter Utilities
Format data for display
"""
from typing import Any, Optional
from datetime import datetime



def get_full_image_url(image_path: Optional[str]) -> Optional[str]:
    """
    Convert relative image path to full URL
    
    Args:
        image_path: Relative path to image
        
    Returns:
        Full URL to access image
    """
    if not image_path:
        return None
    if image_path.startswith("http"):
        return image_path
    
    # In production, this should come from settings.BASE_URL
    base_url = "http://localhost:8000/api/v1"
    
    # Remove leading slash if present to avoid double slashes
    clean_path = image_path.lstrip("/")
    
    # If path already contains "images/view", just prepend base
    if "images/view" in clean_path:
        return f"{base_url}/{clean_path}"
        
    # Otherwise assume it needs the view endpoint
    return f"{base_url}/images/view/{clean_path}"


def format_currency(
    amount: int,
    currency: str = "VND",
    show_symbol: bool = True,
    locale: str = "vi_VN"
) -> str:
    """
    Format currency amount
    
    Args:
        amount: Amount to format
        currency: Currency code (default: VND)
        show_symbol: Whether to show currency symbol
        locale: Locale for formatting
    
    Returns:
        Formatted currency string
    
    Example:
        price = format_currency(1500000)
        # Output: "1,500,000 VND"
        
        price_usd = format_currency(1500, "USD", locale="en_US")
        # Output: "$1,500"
    """
    # Format with thousand separators
    formatted = f"{amount:,}"
    
    if show_symbol:
        if currency == "VND":
            if locale == "vi_VN":
                return f"{formatted} ₫"
            else:
                return f"{formatted} VND"
        elif currency == "USD":
            return f"${formatted}"
        elif currency == "EUR":
            return f"€{formatted}"
        else:
            return f"{formatted} {currency}"
    
    return formatted


def format_number(
    number: float,
    decimal_places: int = 2,
    thousand_separator: bool = True
) -> str:
    """
    Format number with decimal places
    
    Args:
        number: Number to format
        decimal_places: Number of decimal places
        thousand_separator: Whether to use thousand separator
    
    Returns:
        Formatted number string
    
    Example:
        formatted = format_number(12345.6789, decimal_places=2)
        # Output: "12,345.68"
    """
    if thousand_separator:
        return f"{number:,.{decimal_places}f}"
    else:
        return f"{number:.{decimal_places}f}"


def format_percentage(
    value: float,
    decimal_places: int = 1,
    show_sign: bool = True
) -> str:
    """
    Format percentage value
    
    Args:
        value: Value to format (e.g., 0.25 for 25%)
        decimal_places: Number of decimal places
        show_sign: Whether to show % sign
    
    Returns:
        Formatted percentage string
    
    Example:
        percent = format_percentage(0.1234, decimal_places=2)
        # Output: "12.34%"
    """
    percentage = value * 100
    formatted = f"{percentage:.{decimal_places}f}"
    
    if show_sign:
        return f"{formatted}%"
    return formatted


def format_file_size(size_bytes: float) -> str:
    """
    Format file size in human-readable format
    
    Args:
        size_bytes: Size in bytes
    
    Returns:
        Formatted size string
    
    Example:
        size = format_file_size(1536000)
        # Output: "1.46 MB"
    """
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.2f} PB"


def format_phone_number(phone: str, country_code: str = "VN") -> str:
    """
    Format phone number for display
    
    Args:
        phone: Phone number
        country_code: Country code
    
    Returns:
        Formatted phone number
    
    Example:
        formatted = format_phone_number("0123456789")
        # Output: "012 345 6789"
    """
    # Remove non-digits
    import re
    digits = re.sub(r'\D', '', phone)
    
    if country_code == "VN" and len(digits) == 10:
        # Format as: 012 345 6789
        return f"{digits[:3]} {digits[3:6]} {digits[6:]}"
    elif country_code == "US" and len(digits) == 10:
        # Format as: (012) 345-6789
        return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
    else:
        return phone


def format_list(items: list, separator: str = ", ", last_separator: str = " and ") -> str:
    """
    Format list into readable string
    
    Args:
        items: List of items
        separator: Separator between items
        last_separator: Separator before last item
    
    Returns:
        Formatted string
    
    Example:
        names = ["Alice", "Bob", "Charlie"]
        formatted = format_list(names)
        # Output: "Alice, Bob and Charlie"
    """
    if not items:
        return ""
    if len(items) == 1:
        return str(items[0])
    if len(items) == 2:
        return f"{items[0]}{last_separator}{items[1]}"
    
    return f"{separator.join(str(i) for i in items[:-1])}{last_separator}{items[-1]}"


def truncate_text(
    text: str,
    max_length: int = 100,
    suffix: str = "..."
) -> str:
    """
    Truncate text to maximum length
    
    Args:
        text: Text to truncate
        max_length: Maximum length
        suffix: Suffix to add when truncated
    
    Returns:
        Truncated text
    
    Example:
        short = truncate_text("Very long description...", max_length=20)
        # Output: "Very long descrip..."
    """
    if len(text) <= max_length:
        return text
    
    return text[:max_length - len(suffix)] + suffix


def format_json_response(
    data: Any,
    success: bool = True,
    message: Optional[str] = None,
    metadata: Optional[dict] = None
) -> dict:
    """
    Format standardized JSON response
    
    Args:
        data: Response data
        success: Success status
        message: Optional message
        metadata: Optional metadata (pagination, etc.)
    
    Returns:
        Standardized response dict
    
    Example:
        response = format_json_response(
            data=auctions,
            message="Auctions retrieved successfully",
            metadata={"page": 1, "total": 100}
        )
    """
    response = {
        "success": success,
        "data": data
    }
    
    if message:
        response["message"] = message
    
    if metadata:
        response["metadata"] = metadata
    
    return response


def format_pagination_response(
    items: list,
    page: int,
    page_size: int,
    total_items: int
) -> dict:
    """
    Format paginated response
    
    Args:
        items: List of items for current page
        page: Current page number
        page_size: Items per page
        total_items: Total number of items
    
    Returns:
        Paginated response dict
    
    Example:
        response = format_pagination_response(
            items=auctions,
            page=1,
            page_size=20,
            total_items=156
        )
    """
    total_pages = (total_items + page_size - 1) // page_size
    
    return {
        "success": True,
        "data": items,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total_items": total_items,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_previous": page > 1
        }
    }


def format_error_response(
    error_type: str,
    message: str,
    details: Optional[dict] = None,
    status_code: int = 400
) -> dict:
    """
    Format error response
    
    Args:
        error_type: Type of error
        message: Error message
        details: Optional error details
        status_code: HTTP status code
    
    Returns:
        Error response dict
    
    Example:
        error = format_error_response(
            error_type="ValidationError",
            message="Invalid input data",
            details={"field": "email", "error": "Invalid format"}
        )
    """
    response = {
        "success": False,
        "error": {
            "type": error_type,
            "message": message,
            "status_code": status_code
        }
    }
    
    if details:
        response["error"]["details"] = details
    
    return response


def snake_to_camel(snake_str: str) -> str:
    """
    Convert snake_case to camelCase
    
    Args:
        snake_str: String in snake_case
    
    Returns:
        String in camelCase
    
    Example:
        camel = snake_to_camel("user_name")
        # Output: "userName"
    """
    components = snake_str.split('_')
    return components[0] + ''.join(x.title() for x in components[1:])


def camel_to_snake(camel_str: str) -> str:
    """
    Convert camelCase to snake_case
    
    Args:
        camel_str: String in camelCase
    
    Returns:
        String in snake_case
    
    Example:
        snake = camel_to_snake("userName")
        # Output: "user_name"
    """
    import re
    return re.sub(r'(?<!^)(?=[A-Z])', '_', camel_str).lower()