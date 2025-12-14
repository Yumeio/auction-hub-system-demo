"""
Auction model - Auction sessions
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum as SqlEnum
from sqlalchemy.orm import relationship, Mapped, mapped_column
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING

from ..database import BaseEngine
from .enums import AuctionStatus

if TYPE_CHECKING:
    from .product import Product
    from .bid import Bid
    from .payment import Payment
    from .account import Account


class Auction(BaseEngine):
    """
    Auction model representing auction sessions.
    
    Attributes:
        auctionID: Primary key
        auctionName: Name/title of the auction
        productID: Foreign key to Product
        createdAt: Creation timestamp
        updatedAt: Last update timestamp
        startDate: Auction start time
        endDate: Auction end time
        priceStep: Minimum bid increment
        auctionStatus: Current status of auction
        bidWinnerID: Foreign key to winning Account
    """
    __tablename__ = "auction"

    auctionID: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    auctionName: Mapped[str] = mapped_column(String(255), nullable=False)
    productID: Mapped[int] = mapped_column(
        ForeignKey("product.productID"), 
        nullable=False,
        index=True
    )
    createdAt: Mapped[datetime] = mapped_column(
        DateTime, 
        nullable=False,
        default=datetime.utcnow
    )
    updatedAt: Mapped[Optional[datetime]] = mapped_column(DateTime)
    startDate: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    endDate: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    priceStep: Mapped[int] = mapped_column(Integer, nullable=False)
    auctionStatus: Mapped[AuctionStatus] = mapped_column(
        SqlEnum(AuctionStatus),
        nullable=False,
        default=AuctionStatus.SCHEDULED.value
    )
    bidWinnerID: Mapped[Optional[int]] = mapped_column(
        ForeignKey("account.accountID"),
        index=True
    )

    # Relationships
    product: Mapped["Product"] = relationship(back_populates="auctions")
    bids: Mapped[List["Bid"]] = relationship(
        back_populates="auction", 
        cascade="all, delete-orphan",
        order_by="Bid.bidPrice.desc()"  # Order bids by price descending
    )
    payments: Mapped[List["Payment"]] = relationship(
        back_populates="auction", 
        cascade="all, delete-orphan"
    )
    winner: Mapped[Optional["Account"]] = relationship(
        back_populates="wonAuctions",
        foreign_keys=[bidWinnerID]
    )

    def __repr__(self):
        return f"<Auction(id={self.auctionID}, name='{self.auctionName}', status='{self.auctionStatus}')>"

    @property
    def is_active(self) -> bool:
        """Check if auction is currently active/ongoing"""
        return self.auctionStatus == AuctionStatus.ONGOING.value

    @property
    def is_completed(self) -> bool:
        """Check if auction is completed"""
        return self.auctionStatus == AuctionStatus.COMPLETED.value

    @property
    def is_scheduled(self) -> bool:
        """Check if auction is scheduled"""
        return self.auctionStatus == AuctionStatus.SCHEDULED.value

    @property
    def is_cancelled(self) -> bool:
        """Check if auction is cancelled"""
        return self.auctionStatus == AuctionStatus.CANCELLED.value

    @property
    def has_started(self) -> bool:
        """Check if auction has started"""
        return datetime.utcnow() >= self.startDate

    @property
    def has_ended(self) -> bool:
        """Check if auction has ended"""
        return datetime.utcnow() >= self.endDate

    @property
    def time_remaining(self) -> Optional[int]:
        """
        Get remaining time in seconds.
        Returns None if auction hasn't started or has ended.
        """
        if not self.has_started:
            return None
        if self.has_ended:
            return 0
        return int((self.endDate - datetime.utcnow()).total_seconds())

    @property
    def highest_bid(self) -> Optional["Bid"]:
        """Get the highest bid for this auction"""
        return self.bids[0] if self.bids else None

    @property
    def current_price(self) -> int:
        """Get current highest bid price"""
        highest = self.highest_bid
        return highest.bidPrice if highest else 0

    @property
    def next_min_bid(self) -> int:
        """Get next minimum bid amount"""
        return self.current_price + self.priceStep

    @property
    def total_bids(self) -> int:
        """Get total number of bids"""
        return len(self.bids)

    def can_place_bid(self, amount: int) -> tuple[bool, str]:
        """
        Check if a bid amount is valid
        
        Args:
            amount: Bid amount to validate
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        if not self.is_active:
            return False, "Auction is not active"
        
        if self.has_ended:
            return False, "Auction has ended"
        
        if amount < self.next_min_bid:
            return False, f"Bid must be at least {self.next_min_bid}"
        
        return True, ""