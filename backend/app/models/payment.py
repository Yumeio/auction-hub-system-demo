"""
Payment models - Payment transactions and QR tokens
"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Enum as SqlEnum
from sqlalchemy.orm import relationship, Mapped, mapped_column
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING

from ..database import BaseEngine
from .enums import PaymentStatus, PaymentType, PaymentMethod

if TYPE_CHECKING:
    from .auction import Auction
    from .account import Account


class Payment(BaseEngine):
    """
    Payment model representing payment transactions.
    
    Attributes:
        paymentID: Primary key
        auctionID: Foreign key to Auction
        userID: Foreign key to Account
        firstName: Payer's first name
        lastName: Payer's last name
        userAddress: Delivery/shipping address
        userReceivingOption: Receiving preference
        userPaymentMethod: Payment method used
        paymentStatus: Current payment status
        paymentType: Type of payment (deposit/final)
        amount: Payment amount in VND
        createdAt: Payment creation timestamp
    """
    __tablename__ = "payment"

    paymentID: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    auctionID: Mapped[int] = mapped_column(
        ForeignKey("auction.auctionID"), 
        nullable=False, 
        index=True
    )
    userID: Mapped[int] = mapped_column(
        ForeignKey("account.accountID"), 
        nullable=False, 
        index=True
    )

    # User information
    firstName: Mapped[Optional[str]] = mapped_column(String(100))
    lastName: Mapped[Optional[str]] = mapped_column(String(100))
    userAddress: Mapped[Optional[str]] = mapped_column(String(256))
    userReceivingOption: Mapped[Optional[str]] = mapped_column(String(256))
    
    # Payment details
    userPaymentMethod: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default=PaymentMethod.QR_CODE.value
    )
    paymentStatus: Mapped[PaymentStatus] = mapped_column(
        SqlEnum(PaymentStatus),
        nullable=False,
        default=PaymentStatus.PENDING
    )
    paymentType: Mapped[PaymentType] = mapped_column(
        SqlEnum(PaymentType),
        nullable=False, 
        default=PaymentType.FINAL_PAYMENT
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    createdAt: Mapped[datetime] = mapped_column(
        DateTime, 
        nullable=False, 
        default=datetime.utcnow
    )

    # Relationships
    auction: Mapped["Auction"] = relationship(back_populates="payments")
    user: Mapped["Account"] = relationship(back_populates="payments")
    tokens: Mapped[List["PaymentToken"]] = relationship(
        back_populates="payment", 
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Payment(id={self.paymentID}, type='{self.paymentType}', amount={self.amount}, status='{self.paymentStatus}')>"

    @property
    def full_name(self) -> str:
        """Get payer's full name"""
        if self.firstName and self.lastName:
            return f"{self.firstName} {self.lastName}"
        return ""

    @property
    def is_pending(self) -> bool:
        """Check if payment is pending"""
        return self.paymentStatus == PaymentStatus.PENDING

    @property
    def is_completed(self) -> bool:
        """Check if payment is completed"""
        return self.paymentStatus == PaymentStatus.COMPLETED

    @property
    def is_failed(self) -> bool:
        """Check if payment failed"""
        return self.paymentStatus == PaymentStatus.FAILED

    @property
    def is_deposit(self) -> bool:
        """Check if this is a deposit payment"""
        return self.paymentType == PaymentType.DEPOSIT

    @property
    def is_final_payment(self) -> bool:
        """Check if this is a final payment"""
        return self.paymentType == PaymentType.FINAL_PAYMENT

    def mark_as_completed(self) -> None:
        """Mark payment as completed"""
        self.paymentStatus = PaymentStatus.COMPLETED

    def mark_as_failed(self) -> None:
        """Mark payment as failed"""
        self.paymentStatus = PaymentStatus.FAILED

    def mark_as_processing(self) -> None:
        """Mark payment as processing"""
        self.paymentStatus = PaymentStatus.PROCESSING


class PaymentToken(BaseEngine):
    """
    PaymentToken model for QR code payment system.
    
    Attributes:
        tokenID: Primary key
        token: Unique token string for QR code
        paymentID: Foreign key to Payment
        userID: Foreign key to Account
        amount: Token amount in VND
        expiresAt: Token expiration timestamp
        isUsed: Whether token has been used
        usedAt: Timestamp when token was used
        createdAt: Token creation timestamp
    """
    __tablename__ = "payment_token"

    tokenID: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    token: Mapped[str] = mapped_column(
        String(512), 
        unique=True, 
        nullable=False, 
        index=True
    )
    paymentID: Mapped[int] = mapped_column(
        ForeignKey("payment.paymentID"), 
        nullable=False, 
        index=True
    )
    userID: Mapped[int] = mapped_column(
        ForeignKey("account.accountID"), 
        nullable=False,
        index=True
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    expiresAt: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    isUsed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    usedAt: Mapped[Optional[datetime]] = mapped_column(DateTime)
    createdAt: Mapped[datetime] = mapped_column(
        DateTime, 
        nullable=False, 
        default=datetime.utcnow
    )

    # Relationships
    payment: Mapped["Payment"] = relationship(back_populates="tokens")
    user: Mapped["Account"] = relationship()

    def __repr__(self):
        return f"<PaymentToken(id={self.tokenID}, used={self.isUsed}, expires={self.expiresAt})>"

    @property
    def is_expired(self) -> bool:
        """Check if token is expired"""
        return datetime.utcnow() > self.expiresAt

    @property
    def is_valid(self) -> bool:
        """Check if token is valid (not used and not expired)"""
        return not self.isUsed and not self.is_expired

    def mark_as_used(self) -> None:
        """Mark token as used"""
        self.isUsed = True
        self.usedAt = datetime.utcnow()

    @property
    def time_remaining(self) -> Optional[int]:
        """Get remaining time in seconds. Returns None if expired."""
        if self.is_expired:
            return None
        return int((self.expiresAt - datetime.utcnow()).total_seconds())