from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Dict
import asyncio

from app import repositories, schemas, models
from app.database import SessionLocal, get_db
from app.middlewares import get_current_active_user, require_admin
from app.utils import (
    validate_price,
    format_currency,
    format_datetime,
    format_pagination_response,
    sanitize_string,
    verify_payment_token,
    invalidate_token,
    get_token_status,
    generate_payment_token,
    generate_qr_url,
    email_service
)

router = APIRouter(prefix="/payments", tags=["Payments"])

@router.post("/create", response_model=dict)
async def create_payment(
    payment: schemas.PaymentCreate,
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Create payment for won auction (UC19)
    
    POST /payments/create
    Headers: Authorization: Bearer <access_token>
    Body: {
        "auction_id": 1,
        "first_name": "John",
        "last_name": "Doe",
        "user_address": "...",
        "user_payment_method": "bank_transfer"
    }
    Returns: Payment information with QR code
    """
    # Get auction
    auction = repositories.get_auction(db=db, auction_id=payment.auctionID)
    if not auction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Auction not found"
        )
    
    # Check if user won the auction
    if auction.bidWinnerId != current_user.accountID:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only make payment for auctions you won"
        )
    
    # Check if payment already exists
    existing_payments = repositories.get_payments_by_auction(db=db, auction_id=payment.auctionID)
    user_payments = [p for p in existing_payments if p.userID == current_user.accountID]
    
    if user_payments:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment already exists for this auction"
        )
    
    # Get final payment amount (winning bid price)
    highest_bid = repositories.get_current_highest_bid(db, auction.auctionID)
    if not highest_bid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No winning bid found for this auction"
        )
    
    final_payment_amount = highest_bid.bidPrice
    
    # Validate payment amount
    is_valid, error = validate_price(final_payment_amount, min_price=1000)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error
        )
    
    # Sanitize text fields
    payment.firstName = sanitize_string(str(payment.firstName), max_length=50)
    payment.lastName = sanitize_string(str(payment.lastName), max_length=50)
    payment.userAddress = sanitize_string(str(payment.userAddress), max_length=200)
    
    # Create payment
    db_payment = repositories.create_payment(db=db, payment=payment, user_id=current_user.accountID)
    
    # Update payment fields
    db_payment.payment_type = "final_payment"
    db_payment.amount = final_payment_amount
    db_payment.createdAt = datetime.utcnow()
    db.commit()
    db.refresh(db_payment)
    
    # Generate payment token (24h expiry)
    token, expires_at = generate_payment_token(
        payment_id=db_payment.paymentID,
        user_id=current_user.accountID,
        amount=final_payment_amount,
        payment_type="final_payment",
        db=db
    )
    
    # Generate QR URL
    qr_url = generate_qr_url(token)
    
    # Send payment email
    from utils import format_auction_won_email
    text, html = format_auction_won_email(
        current_user.username,
        auction.auctionName,
        final_payment_amount,
        qr_url
    )
    
    email_service.send_email(
        to_email=current_user.email,
        subject=f"Payment Required - {auction.auctionName}",
        body=text,
        html_body=html
    )
    
    return {
        "success": True,
        "message": "Payment created successfully. Check your email for payment instructions.",
        "data": {
            "payment_id": db_payment.paymentID,
            "auction_id": db_payment.auctionID,
            "auction_name": auction.auctionName,
            "amount": format_currency(final_payment_amount),
            "amount_raw": final_payment_amount,
            "payment_status": db_payment.paymentStatus,
            "payment_method": db_payment.userPaymentMethod,
            "qr_url": qr_url,
            "token": token,
            "expires_at": format_datetime(expires_at, "full"),
            "created_at": format_datetime(db_payment.createdAt, "full")
        }
    }


@router.put("/{payment_id}/status", response_model=dict)
async def update_payment_status(
    payment_id: int,
    status_update: schemas.PaymentStatusUpdate,
    current_user=Depends(require_admin),  # Admin only
    db: Session = Depends(get_db)
):
    """
    Update payment status (UC01 - Admin only)
    
    PUT /payments/{payment_id}/status
    Headers: Authorization: Bearer <access_token>
    Body: { "payment_status": "completed" }
    Returns: Updated payment information
    """
    # Get payment
    payment = repositories.get_payment(db=db, payment_id=payment_id)
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )
    
    # Update payment status
    updated_payment = repositories.update_payment_status(
        db=db,
        payment_id=payment_id,
        status=status_update.paymentStatus
    )
    
    # If marking as completed, invalidate tokens
    if status_update.paymentStatus == "completed":
        tokens = db.query(models.PaymentToken).filter(
            models.PaymentToken.paymentID == payment_id,
            models.PaymentToken.isUsed == False
        ).all()
        
        for token in tokens:
            invalidate_token(token.token)
        
        # Send confirmation email
        user = repositories.get_account_by_id(db, payment.userID)
        auction = repositories.get_auction(db, payment.auctionID)
        
        if user and auction:
            email_service.send_email(
                to_email=user.email,
                subject=f"Payment Confirmed - {auction.auctionName}",
                body=f"Your payment of {format_currency(payment.amount)} has been confirmed.",
                html_body=f"<p>Your payment of <strong>{format_currency(payment.amount)}</strong> for {auction.auctionName} has been confirmed.</p>"
            )
    
    return {
        "success": True,
        "message": f"Payment status updated to {status_update.paymentStatus}",
        "data": {
            "payment_id": updated_payment.paymentID,
            "payment_status": updated_payment.paymentStatus,
            "amount": format_currency(getattr(updated_payment, 'amount', 0)),
            "updated_at": format_datetime(datetime.utcnow(), "full")
        }
    }


@router.get("/my-payments", response_model=dict)
def get_my_payments(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=1000),
    payment_type: str = Query(None),
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get current user's payments with pagination
    
    GET /payments/my-payments?skip=0&limit=20&payment_type=final_payment
    Headers: Authorization: Bearer <access_token>
    Returns: Paginated list of user's payments
    """
    # Get total count
    all_payments = repositories.get_payments_by_user(
        db=db,
        user_id=current_user.accountID,
        skip=0,
        limit=1000
    )
    
    # Filter by payment type if provided
    if payment_type:
        all_payments = [p for p in all_payments if p.paymentType.value == payment_type]

    total = len(all_payments)

    # Get paginated payments
    payments = all_payments[skip:skip+limit]

    # Format payments
    formatted_payments = []
    for payment in payments:
        auction = repositories.get_auction(db, payment.auctionID)
        product = repositories.get_product(db, auction.productID) if auction else None

        formatted_payments.append({
            "paymentID": payment.paymentID,
            "auctionID": payment.auctionID,
            "accountID": payment.userID,
            "auction_name": auction.auctionName if auction else "Unknown",
            "product_name": product.productName if product else None,
            "paymentAmount": payment.amount,
            "paymentStatus": payment.paymentStatus.value,
            "paymentMethod": payment.userPaymentMethod,
            "paymentType": payment.paymentType.value,
            "transactionID": None,  # Add if you have this field
            "firstName": payment.firstName,
            "lastName": payment.lastName,
            "userAddress": payment.userAddress,
            "userPaymentMethod": payment.userPaymentMethod,
            "createdAt": payment.createdAt.isoformat(),
            "updatedAt": None
        })
    
    return format_pagination_response(
        items=formatted_payments,
        page=(skip // limit) + 1,
        page_size=limit,
        total_items=total
    )


@router.get("/auction/{auction_id}", response_model=dict)
def get_auction_payment(
    auction_id: int,
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get payment for specific auction (UC14)
    
    GET /payments/auction/{auction_id}
    Headers: Authorization: Bearer <access_token>
    Returns: Payment information with formatted data
    """
    # Get auction
    # Get auction
    auction = repositories.get_auction(db=db, auction_id=auction_id)
    if not auction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Auction not found"
        )
    
    # Check permissions - handled by filtering below
    is_admin = getattr(current_user, 'role', None) == 'admin'
    
    # Get payment
    payments = repositories.get_payments_by_auction(db=db, auction_id=auction_id)  
    
    payment = None
    if is_admin:
        payment = payments[0] if payments else None
    else:
        # Filter for user's payment
        payment = next((p for p in payments if p.userID == current_user.accountID), None)
    
    if not payment:
        # Instead of throwing 404 immediately, verify if we should return empty success or 404.
        # But wait, frontend expects success=True to proceed.
        # If we return 404, frontend catches it. The 500 suggests a server error, likely an index error or attribute error.
        # The line `payment = payments[0]` is safe because of `if payments else None`.
        # However, `payment.userID` access in line 315 assumes `p` has `userID`.
        
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found for this auction"
        )
    
    response = {
        "success": True,
        "data": {
            "payment_id": payment.paymentID,
            "auction_id": payment.auctionID,
            "auction_name": auction.auctionName,
            "amount": format_currency(getattr(payment, 'amount', 0)),
            "amount_raw": getattr(payment, 'amount', 0),
            "payment_status": payment.paymentStatus,
            "payment_type": getattr(payment, 'payment_type', 'final_payment'),
            "payment_method": payment.userPaymentMethod,
            "user_address": payment.userAddress,
            "receiving_option": payment.userReceivingOption,
            "created_at": format_datetime(getattr(payment, 'createdAt', datetime.utcnow()), "full")
        }
    }

    # If payment is pending, try to get active token
    # Check string value if it's enum or string
    status_str = payment.paymentStatus.value if hasattr(payment.paymentStatus, 'value') else str(payment.paymentStatus)
    
    if status_str == "pending":
        token = db.query(models.PaymentToken).filter(
            models.PaymentToken.paymentID == payment.paymentID,
            models.PaymentToken.isUsed == False,
            models.PaymentToken.expiresAt > datetime.utcnow()
        ).first()

        if token:
            qr_url = generate_qr_url(token.token)
            response["data"]["qr_url"] = qr_url
            response["data"]["token"] = token.token

    return response


@router.get("/{payment_id}/status", response_model=dict)
def check_payment_status(
    payment_id: int,
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Check payment status by payment ID

    GET /payments/{payment_id}/status
    Headers: Authorization: Bearer <access_token>
    Returns: Payment status information
    """
    # Get payment
    payment = repositories.get_payment(db=db, payment_id=payment_id)
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )

    # Check permissions - user can only check their own payments
    is_admin = getattr(current_user, 'role', None) == 'admin'
    if not is_admin and payment.userID != current_user.accountID:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only check your own payment status"
        )

    response_data = {
            "payment_id": payment.paymentID,
            "auction_id": payment.auctionID,
            "payment_status": payment.paymentStatus.value,
            "payment_type": payment.paymentType.value,
            "amount": payment.amount,
            "created_at": payment.createdAt.isoformat(),
            "is_pending": payment.is_pending,
            "is_completed": payment.is_completed,
            "is_failed": payment.is_failed
        }

    # If payment is pending, try to get active token
    status_str = payment.paymentStatus.value if hasattr(payment.paymentStatus, 'value') else str(payment.paymentStatus)
    
    if status_str == "pending":
        token = db.query(models.PaymentToken).filter(
            models.PaymentToken.paymentID == payment.paymentID,
            models.PaymentToken.isUsed == False,
            models.PaymentToken.expiresAt > datetime.utcnow()
        ).first()

        if not token:
             # Just generate a new one implicitly if missing/expired
             # We import generate_payment_token inside function or at top - it is imported at top
             token_str, expires_at = generate_payment_token(
                payment_id=payment.paymentID,
                user_id=payment.userID,
                amount=payment.amount,
                payment_type=payment.paymentType.value,
                db=db
             )
             qr_url = generate_qr_url(token_str)
             response_data["qr_url"] = qr_url
             response_data["token"] = token_str
        else:
            qr_url = generate_qr_url(token.token)
            response_data["qr_url"] = qr_url
            response_data["token"] = token.token

    return {
        "success": True,
        "data": response_data
    }


@router.get("/all/pending", response_model=dict)
def get_pending_payments(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user=Depends(require_admin),  # Admin only
    db: Session = Depends(get_db)
):
    """
    Get all pending payments (Admin only)

    GET /payments/all/pending?skip=0&limit=20
    Headers: Authorization: Bearer <access_token>
    Returns: Paginated list of pending payments
    """
    from sqlalchemy import and_
    
    # Get total count
    total = db.query(models.Payment).filter(
        models.Payment.paymentStatus == "pending"
    ).count()
    
    # Get paginated payments
    pending_payments = db.query(models.Payment).filter(
        models.Payment.paymentStatus == "pending"
    ).offset(skip).limit(limit).all()
    
    # Format payments
    formatted_payments = []
    for payment in pending_payments:
        auction = repositories.get_auction(db, payment.auctionID)
        user = repositories.get_account_by_id(db, payment.userID)
        
        formatted_payments.append({
            "payment_id": payment.paymentID,
            "auction_id": payment.auctionID,
            "auction_name": auction.auctionName if auction else "Unknown",
            "user_id": payment.userID,
            "username": user.username if user else "Unknown",
            "amount": format_currency(getattr(payment, 'amount', 0)),
            "amount_raw": getattr(payment, 'amount', 0),
            "payment_type": getattr(payment, 'payment_type', 'final_payment'),
            "created_at": format_datetime(getattr(payment, 'createdAt', datetime.utcnow()), "full")
        })
    
    return format_pagination_response(
        items=formatted_payments,
        page=(skip // limit) + 1,
        page_size=limit,
        total_items=total
    )


@router.post("/{payment_id}/process", response_model=dict)
async def process_payment(
    payment_id: int,
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Process payment (simulate payment processing - UC19)
    
    POST /payments/{payment_id}/process
    Headers: Authorization: Bearer <access_token>
    Returns: Success message
    """
    # Get payment
    payment = repositories.get_payment(db=db, payment_id=payment_id)
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )
    
    # Check permissions
    is_admin = getattr(current_user, 'role', None) == 'admin'
    if not is_admin and payment.userID != current_user.accountID:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only process your own payments"
        )
    
    # Check payment status
    if payment.paymentStatus != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment status is already {payment.paymentStatus}"
        )
    
    # Invalidate tokens
    tokens = db.query(models.PaymentToken).filter(
        models.PaymentToken.paymentID == payment_id,
        models.PaymentToken.isUsed == False
    ).all()
    
    for token in tokens:
        invalidate_token(token.token,)
    
    # Update payment status
    updated_payment = repositories.update_payment_status(
        db=db,
        payment_id=payment_id,
        status="completed"
    )

    # Update winning bid status to WON
    from app.models.enums import BidStatus
    winning_bid = repositories.get_current_highest_bid(db, payment.auctionID)
    if winning_bid and winning_bid.userID == payment.userID:
        winning_bid.bidStatus = BidStatus.WON
        db.add(winning_bid)
        db.commit()
    
    # Send confirmation email
    user = repositories.get_account_by_id(db, payment.userID)
    auction = repositories.get_auction(db, payment.auctionID)
    
    if user and auction:
        email_service.send_email(
            to_email=user.email,
            subject=f"Payment Confirmed - {auction.auctionName}",
            body=f"Your payment of {format_currency(payment.amount)} has been processed successfully.",
            html_body=f"<h2>Payment Confirmed</h2><p>Your payment of <strong>{format_currency(payment.amount)}</strong> for {auction.auctionName} has been processed successfully.</p>"
        )
    
    return {
        "success": True,
        "message": "Payment processed successfully",
        "data": {
            "payment_id": payment_id,
            "payment_status": "completed",
            "amount": format_currency(getattr(payment, 'amount', 0)),
            "processed_at": format_datetime(datetime.utcnow(), "full")
        }
    }


@router.get("/status/{status_filter}", response_model=dict)
def get_payments_by_status(
    status_filter: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user=Depends(require_admin),  # Admin only
    db: Session = Depends(get_db)
):
    """
    Get payments by status (Admin only)
    
    GET /payments/status/completed?skip=0&limit=20
    Headers: Authorization: Bearer <access_token>
    Returns: Paginated list of payments
    """
    # Get total count
    total = db.query(models.Payment).filter(
        models.Payment.paymentStatus == status_filter
    ).count()
    
    # Get paginated payments
    payments = db.query(models.Payment).filter(
        models.Payment.paymentStatus == status_filter
    ).offset(skip).limit(limit).all()
    
    # Format payments
    formatted_payments = []
    for payment in payments:
        auction = repositories.get_auction(db, payment.auctionID)
        user = repositories.get_account_by_id(db, payment.userID)
        
        formatted_payments.append({
            "payment_id": payment.paymentID,
            "auction_id": payment.auctionID,
            "auction_name": auction.auctionName if auction else "Unknown",
            "user_id": payment.userID,
            "username": user.username if user else "Unknown",
            "amount": format_currency(getattr(payment, 'amount', 0)),
            "payment_status": payment.paymentStatus,
            "payment_type": getattr(payment, 'payment_type', 'final_payment'),
            "created_at": format_datetime(getattr(payment, 'createdAt', datetime.utcnow()), "full")
        })
    
    return format_pagination_response(
        items=formatted_payments,
        page=(skip // limit) + 1,
        page_size=limit,
        total_items=total
    )


# QR Payment Endpoints

@router.get("/qr-callback/{token}")
async def qr_payment_callback(token: str, db: Session = Depends(get_db)):
    """
    Mock callback endpoint when QR code is scanned
    
    GET /payments/qr-callback/{token}
    Returns: Payment confirmation
    """
    try:
        # Verify token
        token_data = verify_payment_token(token)
        if not token_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invalid or expired payment token"
            )
            
        payment_id = token_data.get("payment_id")
        payment = repositories.get_payment(db=db, payment_id=int(payment_id))
        
        if not payment:
             raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Payment not found"
            )
        
        # Check if already completed
        if payment.paymentStatus == "completed":
            return {
                "success": False,
                "message": "Payment already completed",
                "payment_id": payment.paymentID,
                "amount": format_currency(getattr(payment, 'amount', 0))
            }
        
        # Invalidate token
        invalidate_token(token)
        
        # Update payment
        updated_payment = repositories.update_payment_status(
            db=db,
            payment_id=payment.paymentID,
            status="completed"
        )

        # Update winning bid status to WON
        from app.models.enums import BidStatus
        winning_bid = repositories.get_current_highest_bid(db, payment.auctionID)
        if winning_bid and winning_bid.userID == payment.userID:
            winning_bid.bidStatus = BidStatus.WON
            db.add(winning_bid)
            db.commit()
        
        # Send confirmation email
        user = repositories.get_account_by_id(db, payment.userID)
        auction = repositories.get_auction(db, payment.auctionID)
        
        if user and auction:
            email_service.send_email(
                to_email=user.email,
                subject=f"Payment Confirmed - {auction.auctionName}",
                body=f"Your QR payment of {format_currency(payment.amount)} has been confirmed.",
                html_body=f"<h2>Payment Confirmed</h2><p>Your QR payment of <strong>{format_currency(payment.amount)}</strong> has been confirmed.</p>"
            )
        
        winning_bid_info = None
        if winning_bid:
            winning_bid_user = repositories.get_account_by_id(db, winning_bid.userID)
            winning_bid_info = {
                "bid_id": winning_bid.bidID,
                "amount": format_currency(winning_bid.amount),
                "bidder_id": winning_bid.userID,
                "bidder_username": winning_bid_user.username if winning_bid_user else "Unknown",
                "bid_status": winning_bid.bidStatus.value
            }
            # Send winning bid notification
            if winning_bid_info:
                notification_service.send_notification(
                    user_id=winning_bid.userID,
                    title="Payment Confirmed",
                    message=f"Your QR payment of {format_currency(payment.amount)} has been confirmed.",
                    type="payment_confirmed"
                )

        return {
            "success": True,
            "message": "Payment completed successfully",
            "payment_id": payment.paymentID,
            "payment_status": "completed",
            "amount": format_currency(getattr(payment, 'amount', 0)),
            "auction_name": auction.auctionName if auction else "Unknown",
            "payment_type": getattr(payment, 'payment_type', 'final_payment'),
            "completed_at": format_datetime(datetime.utcnow(), "full"),
            "winning_bid_details": winning_bid_info
        }


        return {
            "success": True,
            "message": "Payment completed successfully",
            "payment_id": payment.paymentID,
            "payment_status": "completed",
            "amount": format_currency(getattr(payment, 'amount', 0)),
            "auction_name": auction.auctionName if auction else "Unknown",
            "payment_type": getattr(payment, 'payment_type', 'final_payment'),
            "completed_at": format_datetime(datetime.utcnow(), "full")
        }
        
    except HTTPException as e:
        return {
            "success": False,
            "message": e.detail,
            "status_code": e.status_code
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Payment processing error: {str(e)}",
            "status_code": 500
        }


@router.get("/token/{token}/status")
async def get_token_status_endpoint(token: str, db: Session = Depends(get_db)):
    """
    Get token status information
    
    GET /payments/token/{token}/status
    Returns: Token status details with formatted data
    """
    status_info = get_token_status(token)
    
    # Format response
    if status_info.get("valid"):
        return {
            "success": True,
            "data": {
                "valid": status_info["valid"],
                "is_used": status_info.get("is_used", False),
                "payment_id": status_info.get("payment_id"),
                "amount": format_currency(status_info.get("amount", 0)),
                "amount_raw": status_info.get("amount", 0),
                "payment_type": status_info.get("payment_type"),
                "expires_at": format_datetime(status_info.get("expires_at"), "full") if status_info.get("expires_at") else None,
                "remaining_time": status_info.get("remaining_time")
            }
        }
    else:
        return {
            "success": False,
            "message": status_info.get("message", "Invalid token"),
            "data": {
                "valid": False
            }
        }
