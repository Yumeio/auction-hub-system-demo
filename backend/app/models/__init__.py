from .enums import (
    UserRole,
    AccountStatus,
    ProductApprovalStatus,
    AuctionStatus,
    BidStatus,
    PaymentStatus,
    PaymentType,
    PaymentMethod,
    NotificationType
)

from .account import Account
from .product import Product
from .auction import Auction
from .bid import Bid
from .payment import Payment, PaymentToken
from .notification import Notification

__all__ = [
    # Enums
    "UserRole",
    "AccountStatus",
    "ProductApprovalStatus",
    "AuctionStatus",
    "BidStatus",
    "PaymentStatus",
    "PaymentType",
    "PaymentMethod",
    "NotificationType",
    
    # Models
    "Account",
    "Product",
    "Auction",
    "Bid",
    "Payment",
    "PaymentToken",
    "Notification",
]

MODEL_REGISTRY = {
    "account": Account,
    "product": Product,
    "auction": Auction,
    "bid": Bid,
    "payment": Payment,
    "payment_token": PaymentToken,
    "notification": Notification,
}

def get_model(model_name: str):
    """
    Get model class by name.
    
    Args:
        model_name: Name of the model (lowercase)
        
    Returns:
        Model class or None if not found
        
    Example:
        >>> account_model = get_model("account")
        >>> user = account_model(username="john")
    """
    return MODEL_REGISTRY.get(model_name.lower())

def get_all_models():
    """
    Get list of all model classes.
    
    Returns:
        List of model classes
    """
    return list(MODEL_REGISTRY.values())

def get_model_names():
    """
    Get list of all model names.
    
    Returns:
        List of model names
    """
    return list(MODEL_REGISTRY.keys())