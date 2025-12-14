from sqlalchemy.orm import Session
from typing import Optional, List

from .. import models, schemas
from ..models.enums import PaymentStatus


def get_payment(db: Session, payment_id: int) -> Optional[models.Payment]:
    """Get payment by ID"""
    return db.query(models.Payment).filter(models.Payment.paymentID == payment_id).first()


def get_payments_by_user(db: Session, user_id: int, skip: int = 0, limit: int = 100) -> List[models.Payment]:
    """Get all payments by a user"""
    return db.query(models.Payment)\
        .filter(models.Payment.userID == user_id)\
        .offset(skip)\
        .limit(limit)\
        .all()


def get_payments_by_auction(db: Session, auction_id: int) -> List[models.Payment]:
    """Get all payments for an auction"""
    return db.query(models.Payment)\
        .filter(models.Payment.auctionID == auction_id)\
        .all()


def create_payment(db: Session, payment: schemas.PaymentCreate, user_id: int) -> models.Payment:
    """Create new payment"""
    db_payment = models.Payment(
        auctionID=payment.auctionID,
        userID=user_id,
        firstName=payment.firstName,
        lastName=payment.lastName,
        userAddress=payment.userAddress,
        userReceivingOption=payment.userReceivingOption,
        userPaymentMethod=payment.userPaymentMethod,
        paymentStatus=PaymentStatus.PENDING
    )
    db.add(db_payment)
    db.commit()
    db.refresh(db_payment)
    return db_payment


def update_payment_status(db: Session, payment_id: int, status: str) -> Optional[models.Payment]:
    """Update payment status"""
    db_payment = get_payment(db, payment_id)
    if not db_payment:
        return None
    
    db_payment.paymentStatus = status
    db.commit()
    db.refresh(db_payment)
    return db_payment