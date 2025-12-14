from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class PaymentBase(BaseModel):
    auctionID: int
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    userAddress: Optional[str] = None
    userReceivingOption: Optional[str] = None
    userPaymentMethod: Optional[str] = None


class PaymentCreate(PaymentBase):
    pass


class Payment(PaymentBase):
    paymentID: int
    userID: int
    paymentStatus: Optional[str] = None

    class Config:
        from_attributes = True


class PaymentStatusUpdate(BaseModel):
    paymentStatus: str


class PaymentTokenResponse(BaseModel):
    token: str
    qrUrl: str
    expiresAt: datetime
    expiresInMinutes: int
    amount: int
    paymentType: str


class PaymentTokenStatusResponse(BaseModel):
    valid: bool
    paymentID: Optional[int] = None
    userID: Optional[int] = None
    amount: Optional[int] = None
    paymentType: Optional[str] = None
    expiresAt: Optional[datetime] = None
    remainingMinutes: Optional[int] = None
    remainingSeconds: Optional[int] = None
    usedAt: Optional[datetime] = None
    expiredAt: Optional[datetime] = None
    error: Optional[str] = None


class QRCallbackResponse(BaseModel):
    success: bool
    message: str
    paymentID: Optional[int] = None
    amount: Optional[int] = None
    paymentStatus: Optional[str] = None


class DepositPaymentResponse(BaseModel):
    success: bool
    message: str
    paymentID: int
    amount: int
    paymentType: str
    paymentStatus: str
    qrToken: PaymentTokenResponse