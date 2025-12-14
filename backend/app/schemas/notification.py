from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class NotificationBase(BaseModel):
    userID: int
    auctionID: int
    notificationType: str
    title: str
    message: str


class NotificationCreate(NotificationBase):
    pass


class Notification(NotificationBase):
    notificationID: int
    isRead: bool
    isSent: bool
    createdAt: datetime
    readAt: Optional[datetime] = None

    class Config:
        from_attributes = True


class NotificationUpdate(BaseModel):
    isRead: Optional[bool] = None