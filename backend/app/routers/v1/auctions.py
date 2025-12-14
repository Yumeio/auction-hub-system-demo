from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
import json

from app import repositories, schemas, models
from app.database import SessionLocal, get_db
from app.middlewares import get_current_user, get_current_active_user, require_admin
from app.utils import (
    validate_price,
    validate_date_range,
    format_currency,
    format_datetime,
    format_time_remaining,
    format_time_ago,
    format_pagination_response,
    is_expired,
    sanitize_string,
    get_full_image_url
)

router = APIRouter(prefix="/auctions", tags=["Auctions"])

@router.post("/register", response_model=schemas.Auction)
def register_auction(
    auction: schemas.AuctionCreate,
    current_user=Depends(get_current_active_user),  # Allow any active user to register auctions
    db: Session = Depends(get_db)
):
    """
    Register new auction (UC05) - Admin only
    
    POST /auctions/register
    Headers: Authorization: Bearer <access_token>
    Body: {
        "auctionName": "Figure Auction",
        "productID": 1,
        "startDate": "...",
        "endDate": "...",
        "priceStep": 10000
    }
    Returns: Created auction information
    """
    # Sanitize auction name
    auction.auctionName = sanitize_string(auction.auctionName, max_length=200)
    
    # Check if product exists
    product = repositories.get_product(db=db, product_id=auction.productID)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    # Validate date range
    is_valid, error = validate_date_range(
        auction.startDate,
        auction.endDate,
        min_duration_hours=1,
        max_duration_days=30
    )
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error
        )
    
    # Validate price step
    is_valid, error = validate_price(
        auction.priceStep,
        min_price=1000,
        max_price=100000000
    )
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error
        )
    # Ensure start date is in the future
    now = datetime.now(timezone.utc) if auction.startDate.tzinfo else datetime.now()
    if auction.startDate <= now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Start date must be in the future"
        )
    
    # Create auction
    db_auction = repositories.create_auction(db=db, auction=auction)
    
    return schemas.Auction(
        auctionID=db_auction.auctionID,
        auctionName=db_auction.auctionName,
        productID=db_auction.productID,
        startDate=db_auction.startDate,
        endDate=db_auction.endDate,
        priceStep=db_auction.priceStep,
        auctionStatus=db_auction.auctionStatus,
        bidWinnerID=db_auction.bidWinnerID,
        createdAt=db_auction.createdAt,
        updatedAt=db_auction.updatedAt
    )


@router.get("/", response_model=dict)
def get_auctions(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: str = Query(None),
    db: Session = Depends(get_db)
):
    """
    Get all auctions with pagination and filtering
    
    GET /auctions?skip=0&limit=20&status=active
    Returns: Paginated list of auctions
    """
    # Get total count
    total = db.query(models.Auction).count()
    
    # Get auctions
    auctions = repositories.get_auctions(db=db, skip=skip, limit=limit)
    
    # Filter by status if provided
    if status:
        search_status = status
        # proper mapping from frontend "pending" (meaning ongoing) to backend ONGOING
        if status == "pending" or status == "ongoing":
            search_status = models.AuctionStatus.ONGOING
        elif status == "scheduled":
            search_status = models.AuctionStatus.SCHEDULED
            
        auctions = [a for a in auctions if a.auctionStatus == search_status]
    
    # Format auctions
    formatted_auctions = []
    for auction in auctions:
        highest_bid = repositories.get_current_highest_bid(db, auction.auctionID)
        
        formatted_auctions.append({
            "auctionID": auction.auctionID,
            "auctionName": auction.auctionName,
            "productID": auction.productID,
            "startDate": auction.startDate,
            "endDate": auction.endDate,
            "priceStep": auction.priceStep,
            "auctionStatus": auction.auctionStatus,
            "bidWinnerID": auction.bidWinnerID,
            "createdAt": auction.createdAt,
            "updatedAt": auction.updatedAt,
            "currentPrice": format_currency(highest_bid.bidPrice) if highest_bid else "0 ₫",
            "timeRemaining": format_time_remaining(auction.endDate),
            "totalBids": len(auction.bids) if hasattr(auction, 'bids') else 0
        })
    
    # Return paginated response
    return format_pagination_response(
        items=formatted_auctions,
        page=(skip // limit) + 1,
        page_size=limit,
        total_items=total
    )


from fastapi import Header
from jose import jwt
from app.config import settings

def get_optional_current_user(
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    if not authorization:
        return None
    try:
        scheme, token = authorization.split()
        if scheme.lower() != 'bearer':
            return None
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get("sub")
        return repositories.get_account_by_id(db, user_id)
    except:
        return None

@router.get("/registered/list", response_model=list[schemas.Auction])
def get_registered_auctions(
    current_user=Depends(require_admin),  # Only admin can view
    db: Session = Depends(get_db)
):
    """
    Get auctions with 'registered' or 'pending' status (Admin only)
    
    GET /auctions/registered/list
    Headers: Authorization: Bearer <access_token>
    Returns: List of registered auctions
    """
    # Get all auctions
    all_auctions = repositories.get_auctions(db=db, skip=0, limit=1000)
    
    # Filter by status
    registered_auctions = [
        a for a in all_auctions
        if a.auctionStatus in [models.AuctionStatus.SCHEDULED, models.AuctionStatus.DRAFT]
    ]
    
    return registered_auctions


@router.get("/search", response_model=dict)
def search_auctions(
    name: str = Query(None),
    status: str = Query(None),
    min_price: int = Query(None),
    max_price: int = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    Search auctions with filters
    
    GET /auctions/search?name=...&status=...&min_price=...&max_price=...
    Returns: Paginated and filtered auction list
    """
    # Build search params
    search_params = schemas.AuctionSearch(
        auctionName=name,
        auctionStatus=status,
        minPriceStep=min_price,
        maxPriceStep=max_price
    )
    
    # Search auctions
    auctions = repositories.search_auctions(
        db=db,
        search_params=search_params,
        skip=skip,
        limit=limit
    )
    
    # Get total count (simplified)
    total = len(auctions)
    
    # Format results
    formatted_auctions = []
    for auction in auctions:
        highest_bid = repositories.get_current_highest_bid(db, auction.auctionID)
        
        formatted_auctions.append({
            "auctionID": auction.auctionID,
            "auctionName": auction.auctionName,
            "currentPrice": format_currency(highest_bid.bidPrice) if highest_bid else "0 ₫",
            "timeRemaining": format_time_remaining(auction.endDate),
            "status": auction.auctionStatus,
            "image_url": get_full_image_url(auction.product.imageUrl) if auction.product else None
        })
    
    return format_pagination_response(
        items=formatted_auctions,
        page=(skip // limit) + 1,
        page_size=limit,
        total_items=total
    )


@router.get("/{auction_id}", response_model=dict)
def get_auction_details(
    auction_id: int, 
    db: Session = Depends(get_db),
    current_user = Depends(get_optional_current_user)
):
    """
    Get auction details (UC08)
    
    GET /auctions/{auction_id}
    Returns: Detailed auction information with formatted data
    """
    # Get auction
    auction = repositories.get_auction(db=db, auction_id=auction_id)
    if not auction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Auction not found"
        )
    
    # Get product
    product = repositories.get_product(db=db, product_id=auction.productID)
    
    # Get bids
    bids = repositories.get_bids_by_auction(db=db, auction_id=auction_id)
    
    # Get current highest bid
    current_highest_bid = repositories.get_current_highest_bid(db=db, auction_id=auction_id)
    
    # Parse additional images
    additional_images_list = None
    if product and product.additionalImages:
        try:
            raw_list = json.loads(product.additionalImages)
            additional_images_list = [get_full_image_url(img) for img in raw_list]
        except:
            additional_images_list = None
    
    # Format product
    product_data = None
    if product:
        product_data = {
            "product_id": product.productID, # snake_case matching Product type
            "product_name": product.productName,
            "product_description": product.productDescription,
            "product_type": product.productType,
            "initial_price": 0, # product model doesn't have initialPrice, default to 0
            "image_url": get_full_image_url(product.imageUrl),
            "additional_images": additional_images_list, # snake_case
            "approval_status": product.approvalStatus,
            "shipping_status": product.shippingStatus,
            "created_at": product.createdAt.isoformat() if product.createdAt else None,
            "updated_at": product.updatedAt.isoformat() if product.updatedAt else None
        }
    
    # Format bids
    formatted_bids = [
        {
            "bidID": bid.bidID,
            "auctionID": bid.auctionID,
            "userID": bid.userID,
            "bidPrice": format_currency(bid.bidPrice),
            "bidPriceRaw": bid.bidPrice,
            "bidStatus": bid.bidStatus,
            "createdAt": bid.createdAt,
            "timeAgo": format_time_ago(bid.createdAt)
        }
        for bid in bids
    ]
    
    # Get total bids count
    total_bids = len(bids)

    # Calculate additional fields
    highest_bid_amount = current_highest_bid.bidPrice if current_highest_bid else None
    
    # Calculate time remaining in seconds 
    now = datetime.utcnow()
    time_remaining = (auction.endDate - now).total_seconds() if auction.endDate > now else 0
    
    # User specific data
    user_participation = None
    user_highest_bid = None
    
    if current_user:
        # Check participation (via deposit payment)
        deposit_payment = db.query(models.Payment).filter(
            models.Payment.auctionID == auction_id,
            models.Payment.userID == current_user.accountID,
            models.Payment.paymentType == "deposit"
        ).first()

        if deposit_payment:
            user_participation = {
                "participationID": deposit_payment.paymentID,
                "auctionID": deposit_payment.auctionID,
                "accountID": deposit_payment.userID,
                "depositAmount": deposit_payment.amount,
                "depositStatus": deposit_payment.paymentStatus,
                "registrationDate": deposit_payment.createdAt.isoformat(),
                "createdAt": deposit_payment.createdAt.isoformat()
            }
        
        # Check user's highest bid
        user_bids = [b for b in bids if b.userID == current_user.accountID]
        if user_bids:
            highest = max(user_bids, key=lambda b: b.bidPrice)
            user_highest_bid = {
                "bidID": highest.bidID,
                "auctionID": highest.auctionID,
                "bidderID": highest.userID,
                "bidPrice": highest.bidPrice,
                "bidTime": highest.createdAt.isoformat(),
                "bidStatus": highest.bidStatus,
                "createdAt": highest.createdAt.isoformat()
            }
            
    formatted_response = {
        "auction": {
            "auctionID": auction.auctionID,
            "auctionName": auction.auctionName,
            "productID": auction.productID,
            "startDate": auction.startDate.isoformat() if auction.startDate else None,
            "endDate": auction.endDate.isoformat() if auction.endDate else None,
            "priceStep": auction.priceStep,
            "auctionStatus": auction.auctionStatus,
            "bidWinnerID": auction.bidWinnerID,
            "createdAt": auction.createdAt.isoformat() if auction.createdAt else None,
            "updatedAt": auction.updatedAt.isoformat() if auction.updatedAt else None
        },
        "product": product_data,
        "highestBid": {
            "bidID": current_highest_bid.bidID,
            "auctionID": current_highest_bid.auctionID,
            "bidderID": current_highest_bid.userID,
            "bidPrice": current_highest_bid.bidPrice,
            "bidTime": current_highest_bid.createdAt.isoformat(),
            "bidStatus": current_highest_bid.bidStatus,
            "createdAt": current_highest_bid.createdAt.isoformat()
        } if current_highest_bid else None,
        "totalBids": total_bids,
        "totalParticipants": 0, 
        "userParticipation": user_participation,
        "userHighestBid": user_highest_bid, 
        "timeRemaining": time_remaining,
        "formattedStartDate": format_datetime(auction.startDate),
        "formattedEndDate": format_datetime(auction.endDate),
        "formattedPriceStep": format_currency(auction.priceStep),
    }
    
    # Try to add participant count
    try:
        # Count registered participants (those with deposit payments)
        participant_count = db.query(models.Payment).filter(
            models.Payment.auctionID == auction_id,
            models.Payment.paymentType == "deposit"
        ).count()
        
        formatted_response["totalParticipants"] = participant_count
    except:
        pass

    return formatted_response


@router.put("/{auction_id}", response_model=schemas.Auction)
def update_auction(
    auction_id: int,
    auction_update: schemas.AuctionUpdate,
    current_user=Depends(require_admin),  # Only admin can update
    db: Session = Depends(get_db)
):
    """
    Update auction information (Admin only)
    
    PUT /auctions/{auction_id}
    Headers: Authorization: Bearer <access_token>
    Body: { "auctionName": "...", "startDate": "...", ... }
    Returns: Updated auction information
    """
    # Get auction
    auction = repositories.get_auction(db=db, auction_id=auction_id)
    if not auction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Auction not found"
        )
    
    # Sanitize auction name if provided
    if auction_update.auctionName:
        auction_update.auctionName = sanitize_string(
            auction_update.auctionName,
            max_length=200
        )
    
    # Validate dates if both provided
    if auction_update.startDate and auction_update.endDate:
        is_valid, error = validate_date_range(
            auction_update.startDate,
            auction_update.endDate,
            min_duration_hours=1,
            max_duration_days=30
        )
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error
            )
    
    # Validate price step if provided
    if auction_update.priceStep:
        is_valid, error = validate_price(
            auction_update.priceStep,
            min_price=1000,
            max_price=100000000
        )
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error
            )
    
    # Check if auction has started
    if auction.auctionStatus == models.AuctionStatus.ONGOING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update active auction"
        )
    
    # Update auction
    updated_auction = repositories.update_auction(
        db=db,
        auction_id=auction_id,
        auction_update=auction_update
    )
    
    if not updated_auction:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update auction"
        )
    
    return schemas.Auction(
        auctionID=updated_auction.auctionID,
        auctionName=updated_auction.auctionName,
        productID=updated_auction.productID,
        startDate=updated_auction.startDate,
        endDate=updated_auction.endDate,
        priceStep=updated_auction.priceStep,
        auctionStatus=updated_auction.auctionStatus,
        bidWinnerID=updated_auction.bidWinnerID,
        createdAt=updated_auction.createdAt,
        updatedAt=updated_auction.updatedAt
    )


@router.delete("/{auction_id}", response_model=schemas.MessageResponse)
def delete_auction(
    auction_id: int,
    current_user=Depends(require_admin),  # Only admin can delete
    db: Session = Depends(get_db)
):
    """
    Delete auction (Admin only - UC11)
    
    DELETE /auctions/{auction_id}
    Headers: Authorization: Bearer <access_token>
    Returns: Success message
    
    Conditions:
    - Auction must not have started
    - Must not have any bids
    - Must be at least 30 minutes before start time
    """
    # Get auction
    auction = repositories.get_auction(db=db, auction_id=auction_id)
    if not auction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Auction not found"
        )
    
    # Check if auction can be deleted
    if auction.auctionStatus not in [models.AuctionStatus.SCHEDULED, models.AuctionStatus.DRAFT]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete auction that has started or ended"
        )
    
    # Check if there are any bids
    bids = repositories.get_bids_by_auction(db=db, auction_id=auction_id)
    if bids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete auction with existing bids"
        )
    
    # Check time restriction (30 minutes before start)
    time_diff = auction.startDate - datetime.now()
    if time_diff < timedelta(minutes=30):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete auction within 30 minutes of start time"
        )
    
    # Delete auction
    success = repositories.delete_auction(db=db, auction_id=auction_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete auction"
        )
    
    return schemas.MessageResponse(message="Auction deleted successfully")


