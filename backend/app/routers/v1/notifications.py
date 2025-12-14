from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app import repositories, schemas
from app.database import SessionLocal, get_db
from app.middlewares import get_current_active_user
from app.utils import (
    format_time_ago,
    format_datetime,
    format_pagination_response
)
from datetime import datetime

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("/", response_model=dict)
def get_notifications(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get user's notifications with pagination
    
    GET /notifications?skip=0&limit=50
    Headers: Authorization: Bearer <access_token>
    Returns: Paginated list of notifications
    """
    # Get total count
    all_notifications = repositories.get_notifications_by_user(
        db, current_user.accountID, skip=0, limit=1000
    )
    total = len(all_notifications)
    
    # Get paginated notifications
    notifications = all_notifications[skip:skip+limit]
    
    # Format notifications
    formatted_notifications = []
    for notif in notifications:
        auction = repositories.get_auction(db, notif.auctionID) if notif.auctionID else None
        
        formatted_notifications.append({
            "notification_id": notif.notificationID,
            "title": notif.title,
            "message": notif.message,
            "type": notif.notificationType,
            "is_read": notif.isRead,
            "auction_id": notif.auctionID,
            "auction_name": auction.auctionName if auction else None,
            "time_ago": format_time_ago(notif.createdAt),
            "created_at": format_datetime(notif.createdAt, "full"),
            "read_at": format_datetime(notif.readAt, "full") if notif.readAt else None
        })
    
    return format_pagination_response(
        items=formatted_notifications,
        page=(skip // limit) + 1,
        page_size=limit,
        total_items=total
    )


@router.get("/unread", response_model=dict)
def get_unread_notifications(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get unread notifications
    
    GET /notifications/unread?skip=0&limit=50
    Headers: Authorization: Bearer <access_token>
    Returns: Paginated list of unread notifications
    """
    # Get all unread
    all_unread = repositories.get_unread_notifications_by_user(
        db, current_user.accountID, skip=0, limit=1000
    )
    total = len(all_unread)
    
    # Paginate
    notifications = all_unread[skip:skip+limit]
    
    # Format
    formatted_notifications = []
    for notif in notifications:
        auction = repositories.get_auction(db, notif.auctionID) if notif.auctionID else None
        
        formatted_notifications.append({
            "notification_id": notif.notificationID,
            "title": notif.title,
            "message": notif.message,
            "type": notif.notificationType,
            "auction_id": notif.auctionID,
            "auction_name": auction.auctionName if auction else None,
            "time_ago": format_time_ago(notif.createdAt),
            "created_at": format_datetime(notif.createdAt, "full")
        })
    
    return format_pagination_response(
        items=formatted_notifications,
        page=(skip // limit) + 1,
        page_size=limit,
        total_items=total
    )


@router.get("/unread/count", response_model=dict)
def get_unread_count(
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get count of unread notifications
    
    GET /notifications/unread/count
    Headers: Authorization: Bearer <access_token>
    Returns: Unread count
    """
    count = repositories.get_unread_count(db, current_user.accountID)
    
    return {
        "success": True,
        "count": count,
        "has_unread": count > 0
    }


@router.put("/{notification_id}/read", response_model=dict)
def mark_notification_read(
    notification_id: int,
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Mark notification as read
    
    PUT /notifications/{notification_id}/read
    Headers: Authorization: Bearer <access_token>
    Returns: Updated notification
    """
    # Get notification
    notification = repositories.get_notification(db, notification_id)
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    
    # Check ownership
    if notification.userID != current_user.accountID:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only mark your own notifications as read"
        )
    
    # Mark as read
    updated_notification = repositories.update_notification_status(
        db, notification_id, is_read=True
    )
    
    if not updated_notification:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to mark notification as read"
        )
    
    return {
        "success": True,
        "message": "Notification marked as read",
        "data": {
            "notification_id": updated_notification.notificationID,
            "is_read": updated_notification.isRead,
            "read_at": format_datetime(updated_notification.readAt, "full")
        }
    }


@router.put("/mark-all-read", response_model=dict)
def mark_all_read(
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Mark all notifications as read
    
    PUT /notifications/mark-all-read
    Headers: Authorization: Bearer <access_token>
    Returns: Success message
    """
    success = repositories.mark_all_notifications_read(db, current_user.accountID)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to mark all notifications as read"
        )
    
    return {
        "success": True,
        "message": "All notifications marked as read",
        "marked_at": format_datetime(datetime.utcnow(), "full")
    }


@router.delete("/{notification_id}", response_model=schemas.MessageResponse)
def delete_notification(
    notification_id: int,
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Delete notification
    
    DELETE /notifications/{notification_id}
    Headers: Authorization: Bearer <access_token>
    Returns: Success message
    """
    # Get notification
    notification = repositories.get_notification(db, notification_id)
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    
    # Check ownership
    if notification.userID != current_user.accountID:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own notifications"
        )
    
    # Delete
    success = repositories.delete_notification(db, notification_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete notification"
        )
    
    return schemas.MessageResponse(message="Notification deleted successfully")


@router.get("/auction/{auction_id}", response_model=dict)
def get_auction_notifications(
    auction_id: int,
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get notifications related to specific auction
    
    GET /notifications/auction/{auction_id}
    Headers: Authorization: Bearer <access_token>
    Returns: List of auction-related notifications
    """
    # Verify auction exists
    auction = repositories.get_auction(db, auction_id)
    if not auction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Auction not found"
        )
    
    # Get all user notifications for this auction
    all_notifications = repositories.get_notifications_by_user(
        db, current_user.accountID, skip=0, limit=1000
    )
    auction_notifications = [
        n for n in all_notifications 
        if n.auctionID == auction_id
    ]
    
    # Format
    formatted_notifications = []
    for notif in auction_notifications:
        formatted_notifications.append({
            "notification_id": notif.notificationID,
            "title": notif.title,
            "message": notif.message,
            "type": notif.notificationType,
            "is_read": notif.isRead,
            "time_ago": format_time_ago(notif.createdAt),
            "created_at": format_datetime(notif.createdAt, "full")
        })
    
    return {
        "success": True,
        "auction_id": auction_id,
        "auction_name": auction.auctionName,
        "notifications": formatted_notifications,
        "total_count": len(formatted_notifications)
    }


@router.post("/create", response_model=dict)
def create_notification(
    notification_data: schemas.NotificationCreate,
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Create a new notification

    POST /notifications/create
    Headers: Authorization: Bearer <access_token>
    Body: {
        "userID": 123,
        "auctionID": 456,
        "notificationType": "bid_placed",
        "title": "New Bid Placed",
        "message": "Someone placed a bid on your auction"
    }
    Returns: Created notification info
    """
    try:
        # Verify the user exists
        user = repositories.get_account_by_id(db, notification_data.userID)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # Verify the auction exists if auctionID is provided
        if notification_data.auctionID:
            auction = repositories.get_auction(db, notification_data.auctionID)
            if not auction:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Auction not found"
                )

        # Create notification
        notification = repositories.create_notification(db, notification_data)

        if not notification:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create notification"
            )

        return {
            "success": True,
            "message": "Notification created successfully",
            "data": {
                "notification_id": notification.notificationID,
                "user_id": notification.userID,
                "auction_id": notification.auctionID,
                "type": notification.notificationType,
                "title": notification.title,
                "message": notification.message,
                "is_read": notification.isRead,
                "created_at": format_datetime(notification.createdAt, "full")
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in create_notification: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create notification"
        )


@router.post("/test", response_model=dict)
def create_test_notification(
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Create a test notification for testing purposes

    POST /notifications/test
    Headers: Authorization: Bearer <access_token>
    Returns: Test notification info
    """
    from datetime import datetime

    notification_data = schemas.NotificationCreate(
        userID=current_user.accountID,
        auctionID=1,
        notificationType="test",
        title="Test Notification",
        message="This is a test notification for testing the notification system."
    )

    # Create notification
    notification = repositories.create_notification(db, notification_data)

    if not notification:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create test notification"
        )

    return {
        "success": True,
        "message": "Test notification created successfully",
        "data": {
            "notification_id": notification.notificationID,
            "title": notification.title,
            "message": notification.message,
            "created_at": format_datetime(notification.createdAt, "full")
        }
    }