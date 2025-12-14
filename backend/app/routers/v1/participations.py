"""
Auction participation endpoints (UC15 - Register for participation, UC16 - Unregister from participation)
Refactored to use middleware and utils packages
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import asyncio

from app import repositories, schemas, models
from app.database import SessionLocal, get_db
from app.middlewares import get_current_active_user, require_admin
from app.utils import (
    validate_price,
    format_currency,
    format_datetime,
    format_time_remaining,
    EmailService
)
from app.utils import generate_payment_token, generate_qr_url, email_service

router = APIRouter(prefix="/participation", tags=["Participation"])

@router.post("/register", response_model=dict)
async def register_for_auction(
    request: schemas.ParticipationCreate,
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Register to participate in auction (UC15) - With deposit payment
    
    POST /participation/register
    Headers: Authorization: Bearer <access_token>
    Body: { "auction_id": 1, "amount": 500000 }
    Returns: Registration confirmation with payment details
    """
    auction_id = request.auction_id

    # Get auction
    auction = repositories.get_auction(db=db, auction_id=auction_id)
    if not auction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Auction not found"
        )
    
    # Check if auction is accepting registrations
    # Allow registration even if started, as long as not ended
    if auction.auctionStatus in [models.AuctionStatus.COMPLETED, models.AuctionStatus.CANCELLED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot register for cancelled or ended auction"
        )
    
    # Check if user already has deposit payment
    existing_deposit_payments = db.query(models.Payment).filter(
        models.Payment.auctionID == auction_id,
        models.Payment.userID == current_user.accountID,
        models.Payment.paymentType == "deposit"
    ).all()
    
    if existing_deposit_payments:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already registered for this auction"
        )
    
    # Check participation limit
    existing_participants = db.query(models.Payment).filter(
        models.Payment.auctionID == auction_id,
        models.Payment.paymentType == "deposit"
    ).count()
    
    if existing_participants >= 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Auction has reached maximum number of participants"
        )
    
    # Calculate deposit amount (custom or default 10x price step)
    if request.amount:
        deposit_amount = request.amount
    else:
        deposit_amount = auction.priceStep * 10
    
    # Validate deposit amount
    is_valid, error = validate_price(deposit_amount, min_price=1000)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error
        )
    
    deposit_payment = models.Payment(
        auctionID=auction_id,
        userID=current_user.accountID,
        firstName=current_user.firstName or "",
        lastName=current_user.lastName or "",
        userAddress="",
        userReceivingOption="",
        userPaymentMethod="bank_transfer",
        paymentStatus="pending",
        paymentType="deposit",
        amount=deposit_amount,
        createdAt=datetime.utcnow()
    )
    
    db.add(deposit_payment)
    db.commit()
    db.refresh(deposit_payment)
    
    # Generate payment token for deposit
    token, expires_at = generate_payment_token(
        payment_id=deposit_payment.paymentID,
        user_id=current_user.accountID,
        amount=deposit_amount,
        payment_type="deposit",
        db=db
    )
    
    # Generate QR URL
    qr_url = generate_qr_url(token)
    
    # Send deposit email
    email_service.send_email(
        to_email=current_user.email,
        subject=f"Deposit Required - {auction.auctionName}",
        body=f"Please pay deposit of {format_currency(deposit_amount)} to participate in {auction.auctionName}.\n\nQR Code: {qr_url}\n\nExpires at: {format_datetime(expires_at, 'full')}",
        html_body=f"""
        <h2>Deposit Required</h2>
        <p>To participate in <strong>{auction.auctionName}</strong>, please pay the deposit:</p>
        <p><strong>Amount: {format_currency(deposit_amount)}</strong></p>
        <p>Scan QR code or <a href="{qr_url}">click here to pay</a></p>
        <p><small>Expires: {format_datetime(expires_at, 'full')}</small></p>
        """
    )
    
    return {
        "success": True,
        "message": "Registration successful. Please pay deposit to complete.",
        "data": {
            "payment_id": deposit_payment.paymentID,
            "auction_id": auction_id,
            "auction_name": auction.auctionName,
            "deposit_amount": format_currency(deposit_amount),
            "deposit_amount_raw": deposit_amount,
            "payment_status": "pending",
            "qr_url": qr_url,
            "token": token,
            "expires_at": format_datetime(expires_at, "full"),
            "auction_starts_at": format_datetime(auction.startDate, "full"),
            "time_until_start": format_time_remaining(auction.startDate)
        }
    }


@router.post("/unregister", response_model=schemas.MessageResponse)
def unregister_from_auction(
    auction_id: int,
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Unregister from auction participation (UC16)
    
    POST /participation/unregister
    Headers: Authorization: Bearer <access_token>
    Body: { "auction_id": 1 }
    Returns: Success message
    """
    # Get auction
    auction = repositories.get_auction(db=db, auction_id=auction_id)
    if not auction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Auction not found"
        )
    
    # Check if auction has started
    if auction.startDate <= datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot unregister after auction has started"
        )
    
    # Check if user has placed any bids
    user_bids = repositories.get_bids_by_user(db=db, user_id=current_user.accountID)
    auction_bids = [
        bid for bid in user_bids 
        if bid.auctionID == auction_id and bid.bidStatus == "active"
    ]
    
    if auction_bids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot unregister after placing bids"
        )
    
    # Check if user is current highest bidder
    current_highest_bid = repositories.get_current_highest_bid(db=db, auction_id=auction_id)
    if current_highest_bid and current_highest_bid.userID == current_user.accountID:
        time_diff = datetime.utcnow() - current_highest_bid.createdAt
        if time_diff <= timedelta(minutes=10):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot unregister while leading in the last 10 minutes"
            )
    
    return schemas.MessageResponse(
        message="Successfully unregistered from auction. Deposit will be refunded."
    )


@router.get("/my-registrations", response_model=dict)
def get_my_registrations(
    skip: int = 0,
    limit: int = 100,
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get user's auction registrations
    
    GET /participation/my-registrations
    Headers: Authorization: Bearer <access_token>
    Returns: List of user's auction registrations with formatted data
    """
    # Get all auctions
    all_auctions = repositories.get_auctions(db=db, skip=0, limit=1000)
    
    # Get user's bids
    user_bids = repositories.get_bids_by_user(
        db=db, user_id=current_user.accountID, skip=0, limit=10000
    )
    
    # Filter auctions where user has participated
    registrations = []
    for auction in all_auctions:
        auction_bids = [b for b in user_bids if b.auctionID == auction.auctionID]
        if auction_bids:
            latest_bid = max(auction_bids, key=lambda x: x.createdAt)
            current_highest = repositories.get_current_highest_bid(db=db, auction_id=auction.auctionID)
            is_leading = current_highest and current_highest.bidID == latest_bid.bidID
            
            registrations.append({
                "auction_id": auction.auctionID,
                "auction_name": auction.auctionName,
                "registration_date": format_datetime(latest_bid.createdAt, "full"),
                "status": auction.auctionStatus,
                "is_leading": is_leading,
                "total_bids": len(auction_bids),
                "highest_bid": format_currency(max(b.bidPrice for b in auction_bids)),
                "time_remaining": format_time_remaining(auction.endDate)
            })
    
    from utils import format_pagination_response
    return format_pagination_response(
        items=registrations[skip:skip+limit],
        page=(skip // limit) + 1 if limit > 0 else 1,
        page_size=limit,
        total_items=len(registrations)
    )


@router.get("/auction/{auction_id}/participants", response_model=dict)
def get_auction_participants(
    auction_id: int,
    current_user=Depends(require_admin),  # Admin only
    db: Session = Depends(get_db)
):
    """
    Get participants for an auction (Admin only)
    
    GET /participation/auction/{auction_id}/participants
    Headers: Authorization: Bearer <access_token>
    Returns: List of auction participants with stats
    """
    # Get auction
    auction = repositories.get_auction(db=db, auction_id=auction_id)
    if not auction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Auction not found"
        )
    
    # Get all bids for this auction
    bids = repositories.get_bids_by_auction(db=db, auction_id=auction_id)
    
    # Get unique participants
    participants = {}
    for bid in bids:
        if bid.userID not in participants:
            participant = repositories.get_account_by_id(db=db, account_id=bid.userID)
            if participant:
                participants[bid.userID] = {
                    "user_id": bid.userID,
                    "username": participant.username,
                    "name": f"{participant.firstName} {participant.lastName}".strip(),
                    "email": participant.email,
                    "total_bids": 0,
                    "highest_bid": 0,
                    "highest_bid_formatted": "",
                    "latest_bid_time": None
                }
        
        participants[bid.userID]["total_bids"] += 1
        if bid.bidPrice > participants[bid.userID]["highest_bid"]:
            participants[bid.userID]["highest_bid"] = bid.bidPrice
            participants[bid.userID]["highest_bid_formatted"] = format_currency(bid.bidPrice)
        
        if (participants[bid.userID]["latest_bid_time"] is None or 
            bid.createdAt > participants[bid.userID]["latest_bid_time"]):
            participants[bid.userID]["latest_bid_time"] = format_datetime(bid.createdAt, "full")
    
    return {
        "success": True,
        "auction_id": auction_id,
        "auction_name": auction.auctionName,
        "participants": list(participants.values()),
        "total_participants": len(participants),
        "total_bids": len(bids)
    }


@router.get("/auction/{auction_id}/status", response_model=dict)
def get_auction_participation_status(
    auction_id: int,
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Check user's participation status for an auction
    
    GET /participation/auction/{auction_id}/status
    Headers: Authorization: Bearer <access_token>
    Returns: Participation status information
    """
    # Get auction
    auction = repositories.get_auction(db=db, auction_id=auction_id)
    if not auction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Auction not found"
        )
    
    # Check if user has placed bids
    user_bids = repositories.get_bids_by_user(db=db, user_id=current_user.accountID)
    auction_bids = [b for b in user_bids if b.auctionID == auction_id]
    
    if not auction_bids:
        return {
            "success": True,
            "is_registered": False,
            "message": "Not registered for this auction",
            "auction_status": auction.auctionStatus,
            "time_remaining": format_time_remaining(auction.endDate)
        }
    
    # Get current highest bid
    current_highest_bid = repositories.get_current_highest_bid(db=db, auction_id=auction_id)
    is_leading = current_highest_bid and current_highest_bid.userID == current_user.accountID
    
    latest_bid = max(auction_bids, key=lambda x: x.createdAt)
    highest_bid_amount = max(b.bidPrice for b in auction_bids)
    
    return {
        "success": True,
        "is_registered": True,
        "is_leading": is_leading,
        "total_bids": len(auction_bids),
        "highest_bid": format_currency(highest_bid_amount),
        "highest_bid_raw": highest_bid_amount,
        "latest_bid": format_currency(latest_bid.bidPrice),
        "latest_bid_time": format_datetime(latest_bid.createdAt, "full"),
        "registration_date": format_datetime(auction_bids[0].createdAt, "full"),
        "auction_status": auction.auctionStatus,
        "time_remaining": format_time_remaining(auction.endDate)
    }