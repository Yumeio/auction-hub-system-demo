from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timezone

from .. import models, schemas
from ..models.enums import AuctionStatus

def check_and_update_status(db: Session, auction: models.Auction) -> models.Auction:
    """
    Lazily update auction status based on current time
    """
    if not auction:
        return auction
        
    # Handle timezone-aware datetimes
    now = datetime.now(timezone.utc) if auction.startDate.tzinfo else datetime.utcnow()
    updated = False
    
    # Check if should start
    if auction.auctionStatus == AuctionStatus.SCHEDULED and now >= auction.startDate:
        auction.auctionStatus = AuctionStatus.ONGOING # ONGOING means Active
        updated = True
        
    # Check if should end
    if auction.auctionStatus == AuctionStatus.ONGOING and now >= auction.endDate:
        auction.auctionStatus = AuctionStatus.COMPLETED
        updated = True
        
        # Determine winner
        from ..models.enums import BidStatus
        highest_bid = db.query(models.Bid).filter(
            models.Bid.auctionID == auction.auctionID, 
            models.Bid.bidStatus == BidStatus.ACTIVE
        ).order_by(models.Bid.bidPrice.desc()).first()
        
        if highest_bid:
            # Set winner
            auction.bidWinnerID = highest_bid.userID
            
            # Update bid statuses
            highest_bid.bidStatus = BidStatus.WINNING
            db.add(highest_bid)
            
            # Set all other active bids to LOST
            db.query(models.Bid).filter(
                models.Bid.auctionID == auction.auctionID,
                models.Bid.bidID != highest_bid.bidID,
                models.Bid.bidStatus == BidStatus.ACTIVE
            ).update({models.Bid.bidStatus: BidStatus.LOST}, synchronize_session=False)
            
    if updated:
        db.add(auction)
        db.commit()
        db.refresh(auction)
        
    return auction

def get_auction(db: Session, auction_id: int) -> Optional[models.Auction]:
    """Get auction by ID with lazy status update"""
    auction = db.query(models.Auction).filter(models.Auction.auctionID == auction_id).first()
    return check_and_update_status(db, auction)

def get_auction_with_details(db: Session, auction_id: int) -> Optional[models.Auction]:
    """Get auction with product and bid details"""
    auction = db.query(models.Auction).filter(models.Auction.auctionID == auction_id).first()
    return check_and_update_status(db, auction)

def get_user_won_auctions(db: Session, user_id: int) -> List[models.Auction]:
    """Get auctions won by a user"""
    # For lists, we might want to batch update or just update on the fly
    auctions = db.query(models.Auction).filter(models.Auction.bidWinnerID == user_id).all()
    return [check_and_update_status(db, a) for a in auctions]

def get_auctions(db: Session, skip: int = 0, limit: int = 20) -> List[models.Auction]:
    """Get all auctions with pagination and lazy status update"""
    auctions = db.query(models.Auction).offset(skip).limit(limit).all()
    return [check_and_update_status(db, a) for a in auctions]

def create_auction(db: Session, auction: schemas.AuctionCreate) -> models.Auction:
    """Create new auction"""
    db_auction = models.Auction(
        auctionName=auction.auctionName,
        productID=auction.productID,
        startDate=auction.startDate,
        endDate=auction.endDate,
        priceStep=auction.priceStep,
        createdAt=datetime.utcnow(),
        auctionStatus=AuctionStatus.SCHEDULED
    )
    db.add(db_auction)
    db.commit()
    db.refresh(db_auction)
    
    # Check status immediately (e.g. if start date is now)
    return check_and_update_status(db, db_auction)

def update_auction(db: Session, auction_id: int, auction_update: schemas.AuctionUpdate) -> Optional[models.Auction]:
    """Update auction information"""
    db_auction = get_auction(db, auction_id) # This already calls check_update
    if not db_auction:
        return None
    
    update_data = auction_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_auction, field, value)
    
    db_auction.updatedAt = datetime.utcnow()
    db.commit()
    db.refresh(db_auction)
    
    # Re-check status after update (e.g. dates changed)
    return check_and_update_status(db, db_auction)

def delete_auction(db: Session, auction_id: int) -> bool:
    """Delete auction"""
    db_auction = get_auction(db, auction_id)
    if not db_auction:
        return False

    db.delete(db_auction)
    db.commit()
    return True