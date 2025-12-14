from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime

from .. import models, schemas
from ..models.enums import NotificationType
from .account import get_account_by_id
from .auction import get_auction


def get_notification(db: Session, notification_id: int) -> Optional[models.Notification]:
    """Get notification by ID"""
    return db.query(models.Notification)\
        .filter(models.Notification.notificationID == notification_id)\
        .first()


def get_notifications_by_user(db: Session, user_id: int, skip: int = 0, limit: int = 100) -> List[models.Notification]:
    """Get all notifications for a user, ordered by creation date (newest first)"""
    return db.query(models.Notification)\
        .filter(models.Notification.userID == user_id)\
        .order_by(models.Notification.createdAt.desc())\
        .offset(skip)\
        .limit(limit)\
        .all()


def get_unread_notifications_by_user(db: Session, user_id: int, skip: int = 0, limit: int = 100) -> List[models.Notification]:
    """Get unread notifications for a user"""
    return db.query(models.Notification)\
        .filter(
            models.Notification.userID == user_id,
            models.Notification.isRead == False
        )\
        .order_by(models.Notification.createdAt.desc())\
        .offset(skip)\
        .limit(limit)\
        .all()


def create_notification(db: Session, notification: schemas.NotificationCreate) -> models.Notification:
    """Create new notification"""
    db_notification = models.Notification(
        userID=notification.userID,
        auctionID=notification.auctionID,
        notificationType=notification.notificationType,
        title=notification.title,
        message=notification.message,
        isRead=False,
        isSent=False,
        createdAt=datetime.utcnow()
    )
    db.add(db_notification)
    db.commit()
    db.refresh(db_notification)
    return db_notification


def create_outbid_notification(
    db: Session, 
    auction_id: int, 
    outbid_user_id: int, 
    new_bidder_id: int, 
    new_bid_price: int
) -> Optional[models.Notification]:
    """Create notification when user is outbid"""
    # Get auction and user information
    auction = get_auction(db, auction_id)
    new_bidder = get_account_by_id(db, new_bidder_id)
    
    if not auction or not new_bidder:
        return None
    
    db_notification = models.Notification(
        userID=outbid_user_id,
        auctionID=auction_id,
        notificationType=NotificationType.BID_OUTBID,
        title="You have been outbid!",
        message=f"{new_bidder.firstName or new_bidder.username} placed a higher bid of {new_bid_price:,} VND on {auction.auctionName}",
        isRead=False,
        isSent=False,
        createdAt=datetime.utcnow()
    )
    db.add(db_notification)
    db.commit()
    db.refresh(db_notification)
    return db_notification


def update_notification_status(db: Session, notification_id: int, is_read: bool = True) -> Optional[models.Notification]:
    """Update notification read status"""
    db_notification = get_notification(db, notification_id)
    if not db_notification:
        return None
    
    db_notification.isRead = is_read
    if is_read:
        db_notification.readAt = datetime.utcnow()
    
    db.commit()
    db.refresh(db_notification)
    return db_notification


def mark_all_notifications_read(db: Session, user_id: int) -> bool:
    """Mark all user notifications as read"""
    notifications = get_unread_notifications_by_user(db, user_id, skip=0, limit=1000)
    for notification in notifications:
        notification.isRead = True
        notification.readAt = datetime.utcnow()
    
    db.commit()
    return True


def delete_notification(db: Session, notification_id: int) -> bool:
    """Delete notification"""
    db_notification = get_notification(db, notification_id)
    if not db_notification:
        return False
    
    db.delete(db_notification)
    db.commit()
    return True


def get_unread_count(db: Session, user_id: int) -> int:
    """Get count of unread notifications for user"""
    return db.query(models.Notification)\
        .filter(
            models.Notification.userID == user_id,
            models.Notification.isRead == False
        )\
        .count()