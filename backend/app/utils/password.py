"""
Password Utilities
Handle password hashing and verification
"""
import hmac 
import hashlib
import binascii
import string
from typing import Optional
from app.config import settings

def hash_password(password: str) -> str:
    
    pwd_bytes = password.encode('utf-8')
    salt_bytes = settings.SALT.encode('utf-8')
    
    dk = hashlib.pbkdf2_hmac(
        'sha256',
        pwd_bytes,
        salt_bytes,
        100000
    )
    
    hashed_password = binascii.hexlify(dk).decode('utf-8')
    return hashed_password

    
def verify_password(plain_password: str, hashed_password: str) -> bool:
    new_hashed = hash_password(plain_password)
    return hmac.compare_digest(new_hashed, hashed_password)
    

def generate_random_password(length: int = 12) -> str:
    """
    Generate a random secure password
    
    Args:
        length: Length of password (default: 12)
    
    Returns:
        Random password string
    
    Example:
        temp_password = generate_random_password(16)
        # Send to user's email for password reset
    """
    alphabet = string.ascii_letters + string.digits + string.punctuation
    password = ''.join(secrets.choice(alphabet) for _ in range(length))
    return password


def is_password_strong(password: str, min_length: int = 8) -> tuple[bool, Optional[str]]:
    """
    Check if password meets strength requirements
    
    Args:
        password: Password to check
        min_length: Minimum password length
    
    Returns:
        Tuple of (is_strong, error_message)
        - is_strong: True if password is strong
        - error_message: None if strong, otherwise error description
    
    Example:
        is_strong, error = is_password_strong(password)
        if not is_strong:
            raise HTTPException(400, error)
    """
    if len(password) < min_length:
        return False, f"Password must be at least {min_length} characters long"
    
    has_upper = any(c.isupper() for c in password)
    has_lower = any(c.islower() for c in password)
    has_digit = any(c.isdigit() for c in password)
    has_special = any(c in string.punctuation for c in password)
    
    if not has_upper:
        return False, "Password must contain at least one uppercase letter"
    
    if not has_lower:
        return False, "Password must contain at least one lowercase letter"
    
    if not has_digit:
        return False, "Password must contain at least one digit"
    
    if not has_special:
        return False, "Password must contain at least one special character"
    
    return True, None


def validate_password_change(
    old_password: str,
    new_password: str,
    hashed_old_password: str
) -> tuple[bool, Optional[str]]:
    """
    Validate password change request
    
    Args:
        old_password: Current password (plain text)
        new_password: New password (plain text)
        hashed_old_password: Current hashed password from database
    
    Returns:
        Tuple of (is_valid, error_message)
    
    Example:
        is_valid, error = validate_password_change(
            old_password, new_password, user.password
        )
        if not is_valid:
            raise HTTPException(400, error)
    """
    # Verify old password
    if not verify_password(old_password, hashed_old_password):
        return False, "Current password is incorrect"
    
    # Check if new password is different
    if old_password == new_password:
        return False, "New password must be different from current password"
    
    # Check new password strength
    is_strong, error = is_password_strong(new_password)
    if not is_strong:
        return False, error
    
    return True, None


def generate_password_reset_token(length: int = 32) -> str:
    """
    Generate a secure token for password reset
    
    Args:
        length: Token length
    
    Returns:
        Random secure token
    
    Example:
        reset_token = generate_password_reset_token()
        # Store in database with expiration time
        # Send to user's email
    """
    return secrets.token_urlsafe(length)


def get_password_strength_score(password: str) -> int:
    """
    Calculate password strength score (0-5)
    
    Args:
        password: Password to evaluate
    
    Returns:
        Score from 0 (very weak) to 5 (very strong)
    
    Example:
        score = get_password_strength_score(password)
        if score < 3:
            print("Weak password, consider using a stronger one")
    """
    score = 0
    
    # Length check
    if len(password) >= 8:
        score += 1
    if len(password) >= 12:
        score += 1
    
    # Character variety
    if any(c.isupper() for c in password):
        score += 1
    if any(c.islower() for c in password):
        score += 1
    if any(c.isdigit() for c in password):
        score += 1
    if any(c in string.punctuation for c in password):
        score += 1
    
    # Cap at 5
    return min(score, 5)