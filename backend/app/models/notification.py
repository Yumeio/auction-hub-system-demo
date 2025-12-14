"""
Notification model - User notifications
"""
from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship, Mapped, mapped_column
from datetime import datetime
from typing import Optional, TYPE_CHECKING

from ..database import BaseEngine
from .enums import NotificationType

if TYPE_CHECKING:
    from .account import Account
    from .auction import Auction


class Notification(BaseEngine):
    """
    Notification model for user notifications.
    
    Attributes:
        notificationID: Primary key
        userID: Foreign key to Account (recipient)
        auctionID: Foreign key to Auction (related auction)
        notificationType: Type of notification
        title: Notification title
        message: Notification message content
        isRead: Whether notification has been read
        isSent: Whether notification has been sent
        createdAt: Notification creation timestamp
        readAt: Timestamp when notification was read
    """
    __tablename__ = "notification"

    notificationID: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    userID: Mapped[int] = mapped_column(
        ForeignKey("account.accountID"), 
        nullable=False, 
        index=True
    )
    auctionID: Mapped[int] = mapped_column(
        ForeignKey("auction.auctionID"), 
        nullable=False, 
        index=True
    )
    
    notificationType: Mapped[str] = mapped_column(
        String(50), 
        nullable=False,
        index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    
    isRead: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    isSent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    
    createdAt: Mapped[datetime] = mapped_column(
        DateTime, 
        nullable=False,
        default=datetime.utcnow
    )
    readAt: Mapped[Optional[datetime]] = mapped_column(DateTime)
    
    # Relationships
    user: Mapped["Account"] = relationship()
    auction: Mapped["Auction"] = relationship()

    def __repr__(self):
        return f"<Notification(id={self.notificationID}, type='{self.notificationType}', read={self.isRead})>"

    @property
    def is_unread(self) -> bool:
        """Check if notification is unread"""
        return not self.isRead

    def mark_as_read(self) -> None:
        """Mark notification as read"""
        if not self.isRead:
            self.isRead = True
            self.readAt = datetime.utcnow()

    def mark_as_sent(self) -> None:
        """Mark notification as sent"""
        self.isSent = True

    @property
    def is_bid_outbid(self) -> bool:
        """Check if this is a bid outbid notification"""
        return self.notificationType == NotificationType.BID_OUTBID.value

    @property
    def is_bid_won(self) -> bool:
        """Check if this is a bid won notification"""
        return self.notificationType == NotificationType.BID_WON.value

    @property
    def is_auction_ending(self) -> bool:
        """Check if this is an auction ending notification"""
        return self.notificationType == NotificationType.AUCTION_ENDING.value

    @property
    def is_payment_required(self) -> bool:
        """Check if this is a payment required notification"""
        return self.notificationType == NotificationType.PAYMENT_REQUIRED.value

    @property
    def age_seconds(self) -> int:
        """Get notification age in seconds"""
        return int((datetime.utcnow() - self.createdAt).total_seconds())

    @property
    def age_minutes(self) -> int:
        """Get notification age in minutes"""
        return self.age_seconds // 60

    @property
    def is_recent(self) -> bool:
        """Check if notification was created within last 5 minutes"""
        return self.age_seconds < 300

    @staticmethod
    def create_bid_outbid_notification(
        user_id: int,
        auction_id: int,
        new_bid_price: int
    ) -> dict:
        """
        Create notification data for bid outbid event
        
        Args:
            user_id: ID of user who was outbid
            auction_id: ID of auction
            new_bid_price: New highest bid price
            
        Returns:
            Dictionary with notification data
        """
        return {
            "userID": user_id,
            "auctionID": auction_id,
            "notificationType": NotificationType.BID_OUTBID.value,
            "title": "You've been outbid!",
            "message": f"Your bid has been outbid. New highest bid: {new_bid_price:,} VND",
            "createdAt": datetime.utcnow()
        }

    @staticmethod
    def create_auction_won_notification(
        user_id: int,
        auction_id: int,
        winning_bid: int
    ) -> dict:
        """
        Create notification data for auction won event
        
        Args:
            user_id: ID of winning user
            auction_id: ID of auction
            winning_bid: Winning bid amount
            
        Returns:
            Dictionary with notification data
        """
        return {
            "userID": user_id,
            "auctionID": auction_id,
            "notificationType": NotificationType.BID_WON.value,
            "title": "Congratulations! You won!",
            "message": f"You won the auction with bid: {winning_bid:,} VND",
            "createdAt": datetime.utcnow()
        }

    @staticmethod
    def create_payment_required_notification(
        user_id: int,
        auction_id: int,
        amount: int,
        payment_type: str = "final"
    ) -> dict:
        """
        Create notification data for payment required event
        
        Args:
            user_id: ID of user
            auction_id: ID of auction
            amount: Payment amount
            payment_type: Type of payment (deposit/final)
            
        Returns:
            Dictionary with notification data
        """
        title = "Payment Required"
        message = f"{payment_type.capitalize()} payment required: {amount:,} VND"
        
        return {
            "userID": user_id,
            "auctionID": auction_id,
            "notificationType": NotificationType.PAYMENT_REQUIRED.value,
            "title": title,
            "message": message,
            "createdAt": datetime.utcnow()
        }