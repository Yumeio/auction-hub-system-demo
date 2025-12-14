"""
Status management endpoints (UC02 - Update product status, UC03 - Update auction result, UC04 - View product status)
Refactored to use middleware and utils packages
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime

from app import repositories, schemas
from app.database import get_db
from app.middlewares import get_current_active_user, require_admin
from app.utils import (
    format_currency,
    format_datetime,
    format_time_remaining
)

router = APIRouter(prefix="/status", tags=["Status Management"])


@router.put("/product/{product_id}", response_model=dict)
def update_product_status(
    product_id: int,
    status_update: schemas.ProductStatusUpdate,
    admin=Depends(require_admin),  # Admin only via middleware
    db: Session = Depends(get_db)
):
    """
    Update product shipping status (UC02 - Admin only)
    
    PUT /status/product/{product_id}
    Headers: Authorization: Bearer <access_token>
    Body: { "shipping_status": "shipped" }
    Returns: Updated product information
    """
    # Update product status
    product_update = schemas.ProductUpdate(shippingStatus=status_update.shippingStatus)
    updated_product = repositories.update_product(
        db=db, 
        product_id=product_id, 
        product_update=product_update
    )
    
    if not updated_product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    return {
        "success": True,
        "message": "Product status updated successfully",
        "data": {
            "product_id": updated_product.productID,
            "product_name": updated_product.productName,
            "shipping_status": updated_product.shippingStatus,
            "updated_at": format_datetime(updated_product.updatedAt, "full"),
            "updated_by": admin.username
        }
    }


@router.put("/auction/{auction_id}/result", response_model=dict)
def update_auction_result(
    auction_id: int,
    result_update: schemas.AuctionResultUpdate,
    admin=Depends(require_admin),  # Admin only via middleware
    db: Session = Depends(get_db)
):
    """
    Update auction result (UC03 - Admin only)
    
    PUT /status/auction/{auction_id}/result
    Headers: Authorization: Bearer <access_token>
    Body: { "bid_winner_id": 123 }
    Returns: Updated auction information
    """
    # Get auction
    auction = repositories.get_auction(db=db, auction_id=auction_id)
    if not auction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Auction not found"
        )
    
    # Check if auction has ended
    if datetime.utcnow() < auction.endDate:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update result before auction ends"
        )
    
    # Check if bid winner exists
    winner = repositories.get_account_by_id(db=db, account_id=result_update.bidWinnerID)
    if not winner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bid winner not found"
        )
    
    # Update auction result
    auction_update = schemas.AuctionUpdate(
        bidWinnerID=result_update.bidWinnerID,
        auctionStatus="completed"
    )
    updated_auction = repositories.update_auction(
        db=db, 
        auction_id=auction_id, 
        auction_update=auction_update
    )
    
    if not updated_auction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Failed to update auction result"
        )
    
    # Get final bid
    highest_bid = repositories.get_current_highest_bid(db, auction_id)
    
    return {
        "success": True,
        "message": "Auction result updated successfully",
        "data": {
            "auction_id": updated_auction.auctionID,
            "auction_name": updated_auction.auctionName,
            "auction_status": updated_auction.auctionStatus,
            "winner_id": updated_auction.bidWinnerID,
            "winner_name": f"{winner.firstName} {winner.lastName}".strip(),
            "final_price": format_currency(highest_bid.bidPrice) if highest_bid else None,
            "final_price_raw": highest_bid.bidPrice if highest_bid else None,
            "updated_at": format_datetime(updated_auction.updatedAt, "full"),
            "updated_by": admin.username
        }
    }


@router.get("/product/{product_id}", response_model=dict)
def get_product_status(
    product_id: int,
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    View product status after auction (UC04)
    
    GET /status/product/{product_id}
    Headers: Authorization: Bearer <access_token>
    Returns: Product status information with formatted data
    """
    # Get product
    product = repositories.get_product(db=db, product_id=product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    # Get auctions for this product
    all_auctions = repositories.get_auctions(db=db, skip=0, limit=1000)
    product_auctions = [a for a in all_auctions if a.productID == product_id]
    
    if not product_auctions:
        return {
            "success": True,
            "product": {
                "product_id": product.productID,
                "product_name": product.productName,
                "shipping_status": product.shippingStatus,
                "created_at": format_datetime(product.createdAt, "full")
            },
            "auction_status": "no_auctions",
            "message": "No auctions found for this product"
        }
    
    # Get the most recent auction
    latest_auction = max(product_auctions, key=lambda x: x.createdAt)
    
    # Check user permissions
    can_view_detailed_status = (
        current_user.is_admin or 
        (latest_auction.bidWinnerID == current_user.accountID)
    )
    
    status_info = {
        "success": True,
        "product": {
            "product_id": product.productID,
            "product_name": product.productName,
            "product_description": product.productDescription,
            "product_type": product.productType,
            "shipping_status": product.shippingStatus,
            "created_at": format_datetime(product.createdAt, "full"),
            "updated_at": format_datetime(product.updatedAt, "full") if product.updatedAt else None
        },
        "latest_auction": {
            "auction_id": latest_auction.auctionID,
            "auction_name": latest_auction.auctionName,
            "start_date": format_datetime(latest_auction.startDate, "full"),
            "end_date": format_datetime(latest_auction.endDate, "full"),
            "auction_status": latest_auction.auctionStatus,
            "bid_winner_id": latest_auction.bidWinnerID,
            "created_at": format_datetime(latest_auction.createdAt, "full")
        },
        "auction_count": len(product_auctions)
    }
    
    if can_view_detailed_status:
        # Get payment information
        payments = repositories.get_payments_by_auction(db=db, auction_id=latest_auction.auctionID)
        
        status_info["detailed_status"] = {
            "payment_status": "no_payment",
            "payment_method": None,
            "receiving_option": None,
            "shipping_address": None
        }
        
        if payments:
            payment = payments[0]  # Get first payment
            status_info["detailed_status"]["payment_status"] = payment.paymentStatus
            status_info["detailed_status"]["payment_method"] = payment.userPaymentMethod
            status_info["detailed_status"]["receiving_option"] = payment.userReceivingOption
            status_info["detailed_status"]["shipping_address"] = payment.userAddress
    
    return status_info


@router.get("/auction/{auction_id}/complete", response_model=dict)
def get_auction_completion_status(
    auction_id: int,
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get comprehensive auction completion status (Admin and winner only)
    
    GET /status/auction/{auction_id}/complete
    Headers: Authorization: Bearer <access_token>
    Returns: Comprehensive auction status with formatted data
    """
    # Get auction
    auction = repositories.get_auction(db=db, auction_id=auction_id)
    if not auction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Auction not found"
        )
    
    # Check permissions
    if not current_user.is_admin and auction.bidWinnerID != current_user.accountID:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Only admin or winner can view completion status."
        )
    
    # Get product information
    product = repositories.get_product(db=db, product_id=auction.productID)
    
    # Get payment information
    payments = repositories.get_payments_by_auction(db=db, auction_id=auction_id)
    payment = payments[0] if payments else None
    
    # Get winner information
    winner = None
    if auction.bidWinnerID:
        winner = repositories.get_account_by_id(db=db, account_id=auction.bidWinnerID)
    
    # Get highest bid
    highest_bid = repositories.get_current_highest_bid(db=db, auction_id=auction_id)
    
    completion_status = {
        "success": True,
        "auction": {
            "auction_id": auction.auctionID,
            "auction_name": auction.auctionName,
            "start_date": format_datetime(auction.startDate, "full"),
            "end_date": format_datetime(auction.endDate, "full"),
            "final_price": format_currency(highest_bid.bidPrice) if highest_bid else None,
            "final_price_raw": highest_bid.bidPrice if highest_bid else None,
            "auction_status": auction.auctionStatus,
            "completion_date": format_datetime(auction.updatedAt, "full") if auction.updatedAt else None
        },
        "product": {
            "product_id": product.productID,
            "product_name": product.productName,
            "shipping_status": product.shippingStatus
        } if product else None,
        "winner": {
            "user_id": winner.accountID,
            "username": winner.username,
            "full_name": f"{winner.firstName} {winner.lastName}".strip(),
            "email": winner.email
        } if winner else None,
        "payment": {
            "payment_status": payment.paymentStatus if payment else "no_payment",
            "payment_method": payment.userPaymentMethod if payment else None,
            "amount": format_currency(payment.amount) if payment else None,
            "amount_raw": payment.amount if payment else None,
            "created_at": format_datetime(payment.createdAt, "full") if payment else None
        } if payment else None,
        "shipping": {
            "status": product.shippingStatus if product else None,
            "note": "Estimated delivery and tracking will be added when shipped"
        }
    }
    
    return completion_status


@router.post("/auction/{auction_id}/finalize", response_model=dict)
def finalize_auction(
    auction_id: int,
    admin=Depends(require_admin),  # Admin only via middleware
    db: Session = Depends(get_db)
):
    """
    Finalize auction and update all related statuses (Admin only)
    
    POST /status/auction/{auction_id}/finalize
    Headers: Authorization: Bearer <access_token>
    Returns: Success message
    """
    # Get auction
    auction = repositories.get_auction(db=db, auction_id=auction_id)
    if not auction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Auction not found"
        )
    
    # Check if auction has ended
    if datetime.utcnow() < auction.endDate:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot finalize auction before it ends"
        )
    
    # Get highest bid
    highest_bid = repositories.get_current_highest_bid(db=db, auction_id=auction_id)
    if not highest_bid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No bids found for this auction"
        )
    
    # Update auction with winner
    auction_update = schemas.AuctionUpdate(
        bidWinnerID=highest_bid.userID,
        auctionStatus="finalized"
    )
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
    
    # Update product shipping status to "sold"
    product_update = schemas.ProductUpdate(shippingStatus="sold")
    repositories.update_product(db=db, product_id=auction.productID, product_update=product_update)
    
    # Get winner info
    winner = repositories.get_account_by_id(db, highest_bid.userID)
    
    return {
        "success": True,
        "message": "Auction finalized successfully",
        "data": {
            "auction_id": updated_auction.auctionID,
            "auction_name": updated_auction.auctionName,
            "winner_id": highest_bid.userID,
            "winner_name": f"{winner.firstName} {winner.lastName}".strip() if winner else None,
            "final_price": format_currency(highest_bid.bidPrice),
            "final_price_raw": highest_bid.bidPrice,
            "finalized_at": format_datetime(updated_auction.updatedAt, "full"),
            "finalized_by": admin.username
        }
    }