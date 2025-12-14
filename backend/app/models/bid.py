"""
Bid model - Bidding records
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum as SqlEnum
from sqlalchemy.orm import relationship, Mapped, mapped_column
from datetime import datetime
from typing import Optional, TYPE_CHECKING

from ..database import BaseEngine
from .enums import BidStatus

if TYPE_CHECKING:
    from .auction import Auction
    from .account import Account


class Bid(BaseEngine):
    """
    Bid model representing bidding records.
    
    Attributes:
        bidID: Primary key
        auctionID: Foreign key to Auction
        userID: Foreign key to Account (bidder)
        bidPrice: Bid amount
        bidStatus: Current status of bid
        createdAt: Bid creation timestamp
    """
    __tablename__ = "bid"

    bidID: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
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
    bidPrice: Mapped[int] = mapped_column(Integer, nullable=False)
    bidStatus: Mapped[BidStatus] = mapped_column(
        SqlEnum(BidStatus),
        nullable=False,
        default=BidStatus.ACTIVE
    )
    createdAt: Mapped[datetime] = mapped_column(
        DateTime, 
        nullable=False,
        default=datetime.utcnow
    )

    # Relationships
    auction: Mapped["Auction"] = relationship(back_populates="bids")
    user: Mapped["Account"] = relationship(back_populates="bids")

    def __repr__(self):
        return f"<Bid(id={self.bidID}, auction={self.auctionID}, price={self.bidPrice}, status='{self.bidStatus}')>"

    @property
    def is_active(self) -> bool:
        """Check if bid is currently active"""
        return self.bidStatus == BidStatus.ACTIVE

    @property
    def is_winning(self) -> bool:
        """Check if bid is currently winning"""
        return self.bidStatus == BidStatus.WINNING

    @property
    def is_outbid(self) -> bool:
        """Check if bid has been outbid"""
        return self.bidStatus == BidStatus.OUTBID

    @property
    def is_won(self) -> bool:
        """Check if this bid won the auction"""
        return self.bidStatus == BidStatus.WON

    @property
    def is_lost(self) -> bool:
        """Check if this bid lost the auction"""
        return self.bidStatus == BidStatus.LOST

    @property
    def is_cancelled(self) -> bool:
        """Check if bid is cancelled"""
        return self.bidStatus == BidStatus.CANCELLED

    def mark_as_outbid(self) -> None:
        """Mark this bid as outbid"""
        self.bidStatus = BidStatus.OUTBID

    def mark_as_winning(self) -> None:
        """Mark this bid as currently winning"""
        self.bidStatus = BidStatus.WINNING

    def mark_as_won(self) -> None:
        """Mark this bid as won the auction"""
        self.bidStatus = BidStatus.WON

    def mark_as_lost(self) -> None:
        """Mark this bid as lost the auction"""
        self.bidStatus = BidStatus.LOST

    def cancel(self) -> None:
        """Cancel this bid"""
        self.bidStatus = BidStatus.CANCELLED

    @property
    def age_seconds(self) -> int:
        """Get bid age in seconds"""
        return int((datetime.utcnow() - self.createdAt).total_seconds())

    @property
    def is_recent(self) -> bool:
        """Check if bid was placed within last 5 minutes"""
        return self.age_seconds < 300