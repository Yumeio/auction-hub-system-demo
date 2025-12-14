"""
OTP (One-Time Password) Utilities
Generate and validate OTP codes
"""
import secrets
import string
from typing import Optional, Dict
from datetime import datetime, timedelta
import hashlib


def generate_otp(length: int = 6, digits_only: bool = True) -> str:
    """
    Generate OTP code
    
    Args:
        length: Length of OTP code
        digits_only: If True, use only digits. Otherwise use alphanumeric.
    
    Returns:
        OTP code string
    
    Example:
        otp = generate_otp(6)
        # Output: "123456"
    """
    if digits_only:
        return ''.join(secrets.choice(string.digits) for _ in range(length))
    else:
        alphabet = string.ascii_uppercase + string.digits
        return ''.join(secrets.choice(alphabet) for _ in range(length))


def generate_otp_token(user_id: int, purpose: str = "verification") -> str:
    """
    Generate secure OTP token for tracking
    
    Args:
        user_id: User ID
        purpose: Purpose of OTP (verification, password_reset, etc.)
    
    Returns:
        Unique OTP token
    
    Example:
        token = generate_otp_token(user.accountID, "email_verification")
        # Store in database with OTP code and expiry
    """
    timestamp = datetime.utcnow().isoformat()
    data = f"{user_id}:{purpose}:{timestamp}:{secrets.token_hex(16)}"
    return hashlib.sha256(data.encode()).hexdigest()


class OTPManager:
    """
    In-memory OTP manager
    For production, use Redis or database storage
    """
    
    def __init__(self, default_expiry_minutes: int = 5, max_attempts: int = 3):
        self.default_expiry_minutes = default_expiry_minutes
        self.max_attempts = max_attempts
        # Storage: {token: {code, user_id, purpose, expires_at, attempts}}
        self.otps: Dict[str, dict] = {}
    
    def create_otp(
        self,
        user_id: int,
        purpose: str = "verification",
        expiry_minutes: Optional[int] = None
    ) -> tuple[str, str]:
        """
        Create OTP code and token
        
        Args:
            user_id: User ID
            purpose: Purpose of OTP
            expiry_minutes: Expiry time in minutes (default: 5)
        
        Returns:
            Tuple of (otp_code, otp_token)
        
        Example:
            otp_code, otp_token = otp_manager.create_otp(user.accountID)
            # Send otp_code to user's email
            # Store otp_token in response
        """
        otp_code = generate_otp()
        otp_token = generate_otp_token(user_id, purpose)
        
        expiry = expiry_minutes or self.default_expiry_minutes
        expires_at = datetime.utcnow() + timedelta(minutes=expiry)
        
        self.otps[otp_token] = {
            "code": otp_code,
            "user_id": user_id,
            "purpose": purpose,
            "expires_at": expires_at,
            "attempts": 0,
            "created_at": datetime.utcnow()
        }
        
        return otp_code, otp_token
    
    def verify_otp(
        self,
        otp_token: str,
        otp_code: str,
        user_id: int
    ) -> tuple[bool, Optional[str]]:
        """
        Verify OTP code
        
        Args:
            otp_token: OTP token
            otp_code: OTP code from user
            user_id: User ID
        
        Returns:
            Tuple of (is_valid, error_message)
        
        Example:
            is_valid, error = otp_manager.verify_otp(token, code, user.accountID)
            if not is_valid:
                raise HTTPException(400, error)
        """
        # Check if token exists
        if otp_token not in self.otps:
            return False, "Invalid or expired OTP token"
        
        otp_data = self.otps[otp_token]
        
        # Check expiry
        if datetime.utcnow() > otp_data["expires_at"]:
            del self.otps[otp_token]
            return False, "OTP code has expired"
        
        # Check attempts
        if otp_data["attempts"] >= self.max_attempts:
            del self.otps[otp_token]
            return False, "Maximum verification attempts exceeded"
        
        # Check user ID
        if otp_data["user_id"] != user_id:
            return False, "Invalid OTP token"
        
        # Verify code
        if otp_data["code"] != otp_code:
            otp_data["attempts"] += 1
            remaining = self.max_attempts - otp_data["attempts"]
            return False, f"Invalid OTP code. {remaining} attempts remaining"
        
        # Valid - remove from storage
        del self.otps[otp_token]
        return True, None
    
    def get_otp_info(self, otp_token: str) -> Optional[dict]:
        """
        Get OTP information
        
        Args:
            otp_token: OTP token
        
        Returns:
            OTP info dict or None if not found
        
        Example:
            info = otp_manager.get_otp_info(token)
            if info:
                print(f"Expires at: {info['expires_at']}")
                print(f"Attempts: {info['attempts']}")
        """
        return self.otps.get(otp_token)
    
    def invalidate_otp(self, otp_token: str) -> bool:
        """
        Invalidate OTP token
        
        Args:
            otp_token: OTP token
        
        Returns:
            True if invalidated, False if not found
        
        Example:
            otp_manager.invalidate_otp(token)
        """
        if otp_token in self.otps:
            del self.otps[otp_token]
            return True
        return False
    
    def cleanup_expired(self):
        """
        Remove expired OTP tokens
        Should be called periodically
        
        Example:
            # In background task
            otp_manager.cleanup_expired()
        """
        now = datetime.utcnow()
        expired_tokens = [
            token for token, data in self.otps.items()
            if data["expires_at"] < now
        ]
        for token in expired_tokens:
            del self.otps[token]
    
    def get_remaining_attempts(self, otp_token: str) -> int:
        """
        Get remaining verification attempts
        
        Args:
            otp_token: OTP token
        
        Returns:
            Number of remaining attempts
        
        Example:
            remaining = otp_manager.get_remaining_attempts(token)
            print(f"{remaining} attempts left")
        """
        if otp_token not in self.otps:
            return 0
        
        attempts = self.otps[otp_token]["attempts"]
        return max(0, self.max_attempts - attempts)
    
    def get_time_remaining(self, otp_token: str) -> Optional[int]:
        """
        Get remaining time in seconds
        
        Args:
            otp_token: OTP token
        
        Returns:
            Remaining seconds or None if expired/not found
        
        Example:
            seconds = otp_manager.get_time_remaining(token)
            if seconds:
                print(f"OTP expires in {seconds} seconds")
        """
        if otp_token not in self.otps:
            return None
        
        expires_at = self.otps[otp_token]["expires_at"]
        remaining = (expires_at - datetime.utcnow()).total_seconds()
        return int(remaining) if remaining > 0 else 0


def format_otp_for_display(otp: str) -> str:
    """
    Format OTP code for display
    
    Args:
        otp: OTP code
    
    Returns:
        Formatted OTP code
    
    Example:
        formatted = format_otp_for_display("123456")
        # Output: "123 456"
    """
    if len(otp) == 6:
        return f"{otp[:3]} {otp[3:]}"
    elif len(otp) == 4:
        return f"{otp[:2]} {otp[2:]}"
    else:
        return otp


def validate_otp_format(otp: str, expected_length: int = 6) -> tuple[bool, Optional[str]]:
    """
    Validate OTP format
    
    Args:
        otp: OTP code to validate
        expected_length: Expected length
    
    Returns:
        Tuple of (is_valid, error_message)
    
    Example:
        is_valid, error = validate_otp_format("123456")
        if not is_valid:
            raise HTTPException(400, error)
    """
    if not otp:
        return False, "OTP code is required"
    
    if len(otp) != expected_length:
        return False, f"OTP code must be {expected_length} digits"
    
    if not otp.isdigit():
        return False, "OTP code must contain only digits"
    
    return True, None


# Global OTP manager instance
otp_manager = OTPManager()