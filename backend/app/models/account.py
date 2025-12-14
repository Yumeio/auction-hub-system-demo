from sqlalchemy import Column, Integer, String, DateTime, Boolean, Enum as SqlEnum
from sqlalchemy.orm import relationship, Mapped, mapped_column
from datetime import datetime, date
from typing import Optional, List, TYPE_CHECKING

from ..database import BaseEngine
from .enums import UserRole, AccountStatus

if TYPE_CHECKING:
    from .bid import Bid
    from .payment import Payment
    from .auction import Auction
    from .product import Product

class Account(BaseEngine):
    """
    Account model representing user accounts in the system.
    
    Attributes:
        accountID: Primary key
        username: Unique username for login
        password: Hashed password
        firstName: User's first name
        lastName: User's last name
        email: Unique email address
        dateOfBirth: User's date of birth
        phoneNumber: Contact phone number
        address: Physical address
        role: User role (USER, ADMIN)
        status: Account status (ACTIVE, INACTIVE, SUSPENDED)
        lastLoginAt: Last login timestamp
        isAuthenticated: Authentication status
        createdAt: Account creation timestamp
    """
    __tablename__ = "account"

    accountID: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    password: Mapped[str] = mapped_column(String(255), nullable=False)
    firstName: Mapped[str] = mapped_column(String(100), nullable=False)
    lastName: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    dateOfBirth: Mapped[Optional[date]] = mapped_column(DateTime)
    phoneNumber: Mapped[Optional[str]] = mapped_column(String(12))
    address: Mapped[Optional[str]] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(
        SqlEnum(UserRole), 
        nullable=False, 
        default=UserRole.USER
    )
    status: Mapped[AccountStatus] = mapped_column(
        SqlEnum(AccountStatus), 
        nullable=False, 
        default=AccountStatus.ACTIVE
    )
    lastLoginAt: Mapped[Optional[datetime]] = mapped_column(DateTime)
    isAuthenticated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    createdAt: Mapped[datetime] = mapped_column(
        DateTime, 
        nullable=False, 
        default=datetime.utcnow
    )

    # Relationships
    bids: Mapped[List["Bid"]] = relationship(
        back_populates="user", 
        cascade="all, delete-orphan"
    )
    payments: Mapped[List["Payment"]] = relationship(
        back_populates="user", 
        cascade="all, delete-orphan"
    )
    wonAuctions: Mapped[List["Auction"]] = relationship(
        back_populates="winner", 
        foreign_keys="Auction.bidWinnerID"
    )
    submittedProducts: Mapped[List["Product"]] = relationship(
        back_populates="suggestedBy", 
        foreign_keys="Product.suggestedByUserID"
    )

    def __repr__(self):
        return f"<Account(id={self.accountID}, username='{self.username}', role='{self.role}')>"

    @property
    def full_name(self) -> str:
        """Get user's full name"""
        return f"{self.firstName} {self.lastName}"

    @property
    def is_admin(self) -> bool:
        """Check if user is admin"""
        return self.role == UserRole.ADMIN

    @property
    def is_active(self) -> bool:
        """Check if account is active"""
        return self.status == AccountStatus.ACTIVE