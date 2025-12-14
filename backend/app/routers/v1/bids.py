"""
Bidding endpoints (UC17 - Place bid, UC18 - Cancel bid)
Refactored to use middleware and utils packages
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import asyncio

from app import repositories, schemas, models
from app.database import SessionLocal, get_db
from app.middlewares import get_current_active_user
from app.utils import (
    validate_price,
    format_currency,
    format_time_remaining,
    format_time_ago,
    format_pagination_response,
    email_service,
    format_bid_outbid_email
)
from app.config import settings

router = APIRouter(prefix="/bids", tags=["Bids"])



@router.post("/place", response_model=dict)
async def place_bid(
    bid: schemas.BidCreate,
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Place a bid (UC17) - With deposit verification and notifications
    
    POST /bids/place
    Headers: Authorization: Bearer <access_token>
    Body: { "auction_id": 1, "bid_price": 50000 }
    Returns: Bid information with formatted data
    """
    # Get auction
    auction = repositories.get_auction(db=db, auction_id=bid.auctionID)
    if not auction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Auction not found"
        )
    
    # Check if auction is active
    current_time = datetime.utcnow()
    if not (auction.startDate <= current_time <= auction.endDate):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Auction is not currently active. Opens at {auction.startDate}"
        )
    
    # Allow ONGOING (backend enum), active/pending (legacy)
    # Check against string value to handle both Enum objects and raw strings
    status_str = str(auction.auctionStatus) if auction.auctionStatus else ""
    if status_str not in ["active", "pending", "ONGOING", "ongoing", "AuctionStatus.ONGOING"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Auction is not accepting bids (status: {auction.auctionStatus})"
        )
    
    # Verify deposit payment
    deposit_payment = db.query(models.Payment).filter(
        models.Payment.auctionID == bid.auctionID,
        models.Payment.userID == current_user.accountID,
        models.Payment.paymentType == "deposit",
        models.Payment.paymentStatus == "completed"
    ).first()
    
    if not deposit_payment:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must register and pay the deposit before placing bids"
        )
    
    # Get previous highest bid
    previous_highest_bid = repositories.get_current_highest_bid(db=db, auction_id=bid.auctionID)
    min_bid_amount = auction.priceStep
    
    if previous_highest_bid:
        min_bid_amount = previous_highest_bid.bidPrice + auction.priceStep
    
    # Validate bid amount
    is_valid, error = validate_price(
        bid.bidPrice,
        min_price=min_bid_amount,
        max_price=999999999
    )
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Bid must be at least {format_currency(min_bid_amount)}"
        )
    
    # Create bid
    db_bid = repositories.create_bid(db=db, bid=bid, user_id=current_user.accountID)
    
    # Check if bid is in last 5 minutes (auto-extend)
    extended = False
    time_remaining = auction.endDate - current_time
    
    if time_remaining <= timedelta(minutes=5):
        new_end_date = auction.endDate + timedelta(minutes=5)
        auction_update = schemas.AuctionUpdate(endDate=new_end_date)
        updated_auction = repositories.update_auction(
            db=db,
            auction_id=bid.auctionID,
            auction_update=auction_update
        )
        extended = True
        auction = updated_auction
    
    # Send notifications
    try:
        # Get all participants
        all_bids = repositories.get_bids_by_auction(db=db, auction_id=bid.auctionID)
        participant_ids = set(b.userID for b in all_bids)
        
        # Prepare bid update message
        bid_update_message = {
            "type": "bid_update",
            "data": {
                "auction_id": bid.auctionID,
                "auction_name": auction.auctionName if auction else "Unknown",
                "new_highest_bid": format_currency(bid.bidPrice),
                "new_highest_bid_raw": bid.bidPrice,
                "bidder": f"{current_user.firstName} {current_user.lastName}".strip() or current_user.username,
                "total_bids": len(all_bids),
                "extended": extended,
                "new_end_time": auction.endDate if auction else None,
                "time_remaining": format_time_remaining(auction.endDate) if auction else "N/A",
                "bid_timestamp": db_bid.createdAt.isoformat()
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Broadcast to participants
        asyncio.create_task(
            repositories.broadcast_to_auction_participants(db, bid.auctionID, bid_update_message)
        )
        
        # Notify outbid user
        if previous_highest_bid and previous_highest_bid.userID != current_user.accountID:
            outbid_user = repositories.get_account_by_id(db, previous_highest_bid.userID)
            
            if outbid_user:
                # Create notification
                notification = schemas.NotificationCreate(
                    userID=previous_highest_bid.userID,
                    auctionID=bid.auctionID,
                    notificationType="bid_outbid",
                    title="You have been outbid!",
                    message=f"{current_user.firstName or current_user.username} placed a higher bid of {format_currency(bid.bidPrice)} on {auction.auctionName}"
                )
                repositories.create_notification(db, notification)
                
                # Send email notification
                text, html = format_bid_outbid_email(
                    outbid_user.username,
                    auction.auctionName,
                    previous_highest_bid.bidPrice,
                    bid.bidPrice,
                    f"/auctions/{bid.auctionID}"
                )
                
                email_service.send_email(
                    to_email=outbid_user.email,
                    subject=f"You've been outbid - {auction.auctionName}",
                    body=text,
                    html_body=html
                )
    
    except Exception as e:
        print(f"Error sending notifications: {e}")
    
    return {
        "success": True,
        "message": "Bid placed successfully",
        "data": {
            "bid_id": db_bid.bidID,
            "auction_id": db_bid.auctionID,
            "bid_price": format_currency(db_bid.bidPrice),
            "bid_price_raw": db_bid.bidPrice,
            "bid_status": db_bid.bidStatus,
            "created_at": format_time_ago(db_bid.createdAt),
            "is_leading": True,
            "auction_extended": extended,
            "time_remaining": format_time_remaining(auction.endDate)
        }
    }


@router.post("/cancel/{bid_id}", response_model=schemas.MessageResponse)
def cancel_bid(
    bid_id: int,
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Cancel a bid (UC18)
    
    POST /bids/cancel/{bid_id}
    Headers: Authorization: Bearer <access_token>
    Returns: Success message
    """
    # Get bid
    bid = repositories.get_bid(db=db, bid_id=bid_id)
    if not bid:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bid not found"
        )
    
    # Check ownership
    if bid.userID != current_user.accountID:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only cancel your own bids"
        )
    
    # Check status
    if bid.bidStatus != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Bid is not active (status: {bid.bidStatus})"
        )
    
    # Get auction
    auction = repositories.get_auction(db=db, auction_id=bid.auctionID)
    if not auction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Auction not found"
        )
    
    # Check timing
    current_time = datetime.utcnow()
    time_diff = auction.endDate - current_time
    
    if time_diff.total_seconds() <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel bid after auction has ended"
        )
    
    # Check if leading in last 10 minutes
    current_highest_bid = repositories.get_current_highest_bid(db=db, auction_id=bid.auctionID)
    
    if current_highest_bid and current_highest_bid.userID == current_user.accountID:
        if time_diff <= timedelta(minutes=10):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot cancel bid while leading in the last 10 minutes"
            )
        
        # Extend auction if canceling while leading
        if time_diff > timedelta(minutes=10):
            new_end_date = auction.endDate + timedelta(minutes=5)
            auction_update = schemas.AuctionUpdate(endDate=new_end_date)
            repositories.update_auction(db=db, auction_id=bid.auctionID, auction_update=auction_update)
    
    # Cancel bid
    success = repositories.cancel_bid(db=db, bid_id=bid_id, user_id=current_user.accountID)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel bid"
        )
    
    return schemas.MessageResponse(message="Bid cancelled successfully")


@router.get("/my-bids", response_model=dict)
def get_my_bids(
    skip: int = 0,
    limit: int = 20,
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get user's bid history with pagination and formatting
    
    GET /bids/my-bids?skip=0&limit=20
    Headers: Authorization: Bearer <access_token>
    Returns: Paginated list of bids
    """
    # Get total count
    all_bids = repositories.get_bids_by_user(db=db, user_id=current_user.accountID, skip=0, limit=1000)
    total = len(all_bids)
    
    # Get paginated bids
    bids = all_bids[skip:skip+limit]
    
    # Format bids
    formatted_bids = []
    for bid in bids:
        auction = repositories.get_auction(db, bid.auctionID)
        current_highest = repositories.get_current_highest_bid(db, bid.auctionID)
        
        formatted_bids.append({
            "bid_id": bid.bidID,
            "auction_id": bid.auctionID,
            "auction_name": auction.auctionName if auction else "Unknown",
            "bid_price": format_currency(bid.bidPrice),
            "bid_price_raw": bid.bidPrice,
            "bid_status": bid.bidStatus,
            "is_leading": current_highest and current_highest.bidID == bid.bidID,
            "created_at": format_time_ago(bid.createdAt),
            "bid_time": bid.createdAt.isoformat(),
            "auction_status": auction.auctionStatus if auction else None
        })
    
    return format_pagination_response(
        items=formatted_bids,
        page=(skip // limit) + 1,
        page_size=limit,
        total_items=total
    )


@router.get("/auction/{auction_id}", response_model=dict)
def get_auction_bids(
    auction_id: int,
    skip: int = 0,
    limit: int = 50,
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get all bids for an auction with formatting
    
    GET /bids/auction/{auction_id}?skip=0&limit=50
    Headers: Authorization: Bearer <access_token>
    Returns: Paginated list of bids
    """
    # Get auction
    auction = repositories.get_auction(db=db, auction_id=auction_id)
    if not auction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Auction not found"
        )
    
    # Get all bids
    all_bids = repositories.get_bids_by_auction(db=db, auction_id=auction_id, skip=0, limit=1000)
    total = len(all_bids)
    
    # Get paginated bids
    bids = all_bids[skip:skip+limit]
    
    # Format bids
    formatted_bids = []
    for bid in bids:
        bidder = repositories.get_account_by_id(db, bid.userID)
        
        formatted_bids.append({
            "bid_id": bid.bidID,
            "bid_price": format_currency(bid.bidPrice),
            "bid_price_raw": bid.bidPrice,
            "bidder_name": f"{bidder.firstName} {bidder.lastName}".strip() if bidder else "Anonymous",
            "bid_status": bid.bidStatus,
            "time_ago": format_time_ago(bid.createdAt),
            "created_at": bid.createdAt.isoformat()
        })
    
    return {
        "success": True,
        "auction": {
            "auction_id": auction.auctionID,
            "auction_name": auction.auctionName,
            "time_remaining": format_time_remaining(auction.endDate)
        },
        "bids": format_pagination_response(
            items=formatted_bids,
            page=(skip // limit) + 1,
            page_size=limit,
            total_items=total
        )
    }


@router.get("/auction/{auction_id}/highest", response_model=dict)
def get_highest_bid(
    auction_id: int,
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get current highest bid with formatted data
    
    GET /bids/auction/{auction_id}/highest
    Headers: Authorization: Bearer <access_token>
    Returns: Highest bid information
    """
    # Get auction
    auction = repositories.get_auction(db=db, auction_id=auction_id)
    if not auction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Auction not found"
        )
    
    # Get highest bid
    highest_bid = repositories.get_current_highest_bid(db=db, auction_id=auction_id)
    
    if not highest_bid:
        return {
            "success": True,
            "has_bids": False,
            "message": "No bids yet",
            "next_min_bid": format_currency(auction.priceStep)
        }
    
    bidder = repositories.get_account_by_id(db, highest_bid.userID)
    next_min_bid = highest_bid.bidPrice + auction.priceStep
    
    return {
        "success": True,
        "has_bids": True,
        "data": {
            "bid_id": highest_bid.bidID,
            "bid_price": format_currency(highest_bid.bidPrice),
            "bid_price_raw": highest_bid.bidPrice,
            "bidder_name": f"{bidder.firstName} {bidder.lastName}".strip() if bidder else "Anonymous",
            "is_your_bid": highest_bid.userID == current_user.accountID,
            "time_ago": format_time_ago(highest_bid.createdAt),
            "next_min_bid": format_currency(next_min_bid),
            "next_min_bid_raw": next_min_bid
        }
    }


@router.get("/auction/{auction_id}/my-status", response_model=dict)
def get_my_bid_status(
    auction_id: int,
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get user's bid status for an auction
    
    GET /bids/auction/{auction_id}/my-status
    Headers: Authorization: Bearer <access_token>
    Returns: User's bid status
    """
    # Get auction
    auction = repositories.get_auction(db=db, auction_id=auction_id)
    if not auction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Auction not found"
        )
    
    # Get user's bids
    user_bids = repositories.get_bids_by_user(db=db, user_id=current_user.accountID)
    auction_bids = [b for b in user_bids if b.auctionID == auction_id]
    
    if not auction_bids:
        return {
            "success": True,
            "has_bids": False,
            "message": "You have not placed any bids for this auction",
            "auction_status": auction.auctionStatus if auction else None,
            "time_remaining": format_time_remaining(auction.endDate) if auction else "N/A"
        }
    
    # Get current highest bid
    current_highest = repositories.get_current_highest_bid(db=db, auction_id=auction_id)
    is_leading = current_highest and current_highest.userID == current_user.accountID
    
    highest_bid_amount = max(b.bidPrice for b in auction_bids)
    latest_bid = max(auction_bids, key=lambda b: b.createdAt)
    
    return {
        "success": True,
        "has_bids": True,
        "is_leading": is_leading,
        "total_bids": len(auction_bids),
        "highest_bid": format_currency(highest_bid_amount),
        "highest_bid_raw": highest_bid_amount,
        "latest_bid": format_time_ago(latest_bid.createdAt),
        "auction_status": auction.auctionStatus,
        "time_remaining": format_time_remaining(auction.endDate)
    }