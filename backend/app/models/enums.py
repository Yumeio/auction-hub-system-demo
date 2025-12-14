from enum import Enum

class UserRole(str, Enum):
    """User role enumeration"""
    USER = "user"
    ADMIN = "admin"


class AccountStatus(str, Enum):
    """Account status enumeration"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"


class ProductApprovalStatus(str, Enum):
    """Product approval status enumeration"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class AuctionStatus(str, Enum):
    """Auction status enumeration"""
    DRAFT = "DRAFT"
    SCHEDULED = "SCHEDULED"
    ONGOING = "ONGOING" 
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class BidStatus(str, Enum):
    """Bid status enumeration"""
    ACTIVE = "active"
    OUTBID = "outbid"
    WINNING = "winning"
    WON = "won"
    LOST = "lost"
    CANCELLED = "cancelled"


class PaymentStatus(str, Enum):
    """Payment status enumeration"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"
    CANCELLED = "cancelled"


class PaymentType(str, Enum):
    """Payment type enumeration"""
    DEPOSIT = "deposit"
    FINAL_PAYMENT = "final_payment"


class PaymentMethod(str, Enum):
    """Payment method enumeration"""
    BANK_TRANSFER = "bank_transfer"
    QR_CODE = "qr_code"
    CASH = "cash"


class NotificationType(str, Enum):
    """Notification type enumeration"""
    BID_OUTBID = "bid_outbid"
    BID_WON = "bid_won"
    BID_LOST = "bid_lost"
    AUCTION_STARTING = "auction_starting"
    AUCTION_ENDING = "auction_ending"
    AUCTION_COMPLETED = "auction_completed"
    AUCTION_CANCELLED = "auction_cancelled"
    PAYMENT_REQUIRED = "payment_required"
    PAYMENT_CONFIRMED = "payment_confirmed"
    PRODUCT_APPROVED = "product_approved"
    PRODUCT_REJECTED = "product_rejected"