from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime

from .. import models, schemas
from ..models.enums import BidStatus


def get_bid(db: Session, bid_id: int) -> Optional[models.Bid]:
    """Get bid by ID"""
    return db.query(models.Bid).filter(models.Bid.bidID == bid_id).first()

def get_bids_by_auction(db: Session, auction_id: int, skip: int = 0, limit: int = 100) -> List[models.Bid]:
    """Get all bids for an auction, ordered by price (highest first)"""
    return db.query(models.Bid)\
        .filter(models.Bid.auctionID == auction_id)\
        .order_by(models.Bid.bidPrice.desc())\
        .offset(skip)\
        .limit(limit)\
        .all()

def get_bids_by_user(db: Session, user_id: int, skip: int = 0, limit: int = 100) -> List[models.Bid]:
    """Get all bids by a user"""
    return db.query(models.Bid)\
        .filter(models.Bid.userID == user_id)\
        .offset(skip)\
        .limit(limit)\
        .all()
        
def get_current_highest_bid(db: Session, auction_id: int) -> Optional[models.Bid]:
    """Get the current highest bid for an auction"""
    return db.query(models.Bid)\
        .filter(
            models.Bid.auctionID == auction_id,
            models.Bid.bidStatus.in_([BidStatus.ACTIVE, BidStatus.WINNING, BidStatus.WON])
        )\
        .order_by(models.Bid.bidPrice.desc())\
        .first()
        
def create_bid(db: Session, bid: schemas.BidCreate, user_id: int) -> models.Bid:
    """Create new bid"""
    db_bid = models.Bid(
        auctionID=bid.auctionID,
        userID=user_id,
        bidPrice=bid.bidPrice,
        bidStatus=BidStatus.ACTIVE,
        createdAt=datetime.utcnow()
    )
    db.add(db_bid)
    db.commit()
    db.refresh(db_bid)
    return db_bid


def cancel_bid(db: Session, bid_id: int, user_id: int) -> bool:
    """Cancel a bid (only if it belongs to the user)"""
    db_bid = get_bid(db, bid_id)
    if not db_bid or db_bid.userID != user_id:
        return False
    
    db_bid.bidStatus = BidStatus.CANCELLED
    db.commit()
    return True