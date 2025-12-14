"""
QR Payment Token System
Generates secure tokens for payment QR codes
"""
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Tuple, Optional
from sqlalchemy.orm import Session


class QRTokenStorage:
    """
    In-memory storage for QR tokens
    In production, use Redis or database
    """
    def __init__(self):
        self.tokens = {}
    
    def store(self, token: str, data: dict, expires_at: datetime):
        """Store token with expiry"""
        self.tokens[token] = {
            "data": data,
            "expires_at": expires_at,
            "created_at": datetime.utcnow()
        }
    
    def get(self, token: str) -> Optional[dict]:
        """Get token data if valid"""
        if token not in self.tokens:
            return None
        
        token_data = self.tokens[token]
        
        # Check expiry
        if datetime.utcnow() > token_data["expires_at"]:
            del self.tokens[token]
            return None
        
        return token_data["data"]
    
    def invalidate(self, token: str) -> bool:
        """Invalidate/delete token"""
        if token in self.tokens:
            del self.tokens[token]
            return True
        return False
    
    def cleanup_expired(self):
        """Remove expired tokens"""
        now = datetime.utcnow()
        expired = [
            token for token, data in self.tokens.items()
            if now > data["expires_at"]
        ]
        for token in expired:
            del self.tokens[token]


# Global token storage
_token_storage = QRTokenStorage()


def generate_payment_token(
    payment_id: int,
    user_id: int,
    amount: int,
    payment_type: str = "payment",
    db: Session = None,
    expire_minutes: int = 30
) -> Tuple[str, datetime]:
    """
    Generate secure payment token for QR code
    
    Args:
        payment_id: Payment ID
        user_id: User ID
        amount: Payment amount
        payment_type: Type of payment (payment, deposit)
        db: Database session (optional, for future DB storage)
        expire_minutes: Token expiry in minutes
        
    Returns:
        (token, expires_at)
    """
    # Generate random token
    random_bytes = secrets.token_bytes(32)
    
    # Create data string to hash
    data_string = f"{payment_id}:{user_id}:{amount}:{payment_type}:{datetime.utcnow().isoformat()}"
    data_hash = hashlib.sha256(data_string.encode()).hexdigest()
    
    # Combine random token with data hash
    combined = random_bytes.hex() + data_hash
    
    # Create final token (64 chars from random + first 16 from hash)
    token = combined[:80]
    
    # Calculate expiry
    expires_at = datetime.utcnow() + timedelta(minutes=expire_minutes)
    
    # Store token data
    token_data = {
        "payment_id": payment_id,
        "user_id": user_id,
        "amount": amount,
        "payment_type": payment_type,
        "created_at": datetime.utcnow()
    }
    
    _token_storage.store(token, token_data, expires_at)
    
    return token, expires_at


def verify_payment_token(token: str) -> Optional[dict]:
    """
    Verify and retrieve payment token data
    
    Args:
        token: Payment token to verify
        
    Returns:
        Token data dict or None if invalid/expired
    """
    return _token_storage.get(token)


def invalidate_token(token: str) -> bool:
    """
    Invalidate/delete token after use
    
    Args:
        token: Token to invalidate
        
    Returns:
        True if invalidated, False if not found
    """
    return _token_storage.invalidate(token)


from app.config import settings

def generate_qr_url(token: str, base_url: str = "http://localhost:8000") -> str:
    """
    Generate QR payment URL from token
    
    Args:
        token: Payment token
        base_url: Base URL for the application
        
    Returns:
        Full payment URL for QR code
    """
    return f"{base_url}/{settings.API_PREFIX}/payments/qr-callback/{token}"


def cleanup_expired_tokens():
    """
    Cleanup expired tokens
    Should be called periodically (e.g., via background task)
    """
    _token_storage.cleanup_expired()


def get_token_status(token: str) -> dict:
    """
    Get token status information
    
    Args:
        token: Token to check
        
    Returns:
        Status information
    """
    token_data = _token_storage.get(token)
    
    if not token_data:
        return {
            "valid": False,
            "status": "invalid_or_expired",
            "message": "Token not found or expired"
        }
    
    return {
        "valid": True,
        "status": "active",
        "payment_id": token_data["payment_id"],
        "user_id": token_data["user_id"],
        "amount": token_data["amount"],
        "payment_type": token_data["payment_type"],
        "created_at": token_data["created_at"].isoformat()
    }


# Export functions
__all__ = [
    "generate_payment_token",
    "verify_payment_token",
    "invalidate_token",
    "generate_qr_url",
    "cleanup_expired_tokens",
    "get_token_status"
]