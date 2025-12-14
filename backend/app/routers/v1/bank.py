"""
Mock Bank API endpoints
Handles deposits and payments with QR code functionality
Refactored to use middleware and utils packages
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from datetime import datetime
import uuid

from app import repositories, schemas, models
from app.database import SessionLocal, get_db
from app.middlewares import get_current_active_user
from app.utils import (
    format_currency,
    format_datetime,
    validate_price
)
from app.utils.bank import BankPort

router = APIRouter(prefix="/bank", tags=["Mock Bank API"])

# Initialize bank port
bank_port = BankPort()

# =================== DEPOSIT ENDPOINTS (Đặt cọc) =================== #

@router.post("/deposit/create", response_model=dict)
def create_deposit(
    auction_id: int = Query(..., description="Auction ID for deposit"),
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Create deposit for auction participation (đặt cọc)
    
    This endpoint is called when user wants to participate in an auction.
    For demo: always returns successful deposit immediately.
    
    POST /bank/deposit/create?auction_id=1
    Headers: Authorization: Bearer <access_token>
    Returns: Deposit transaction with QR code
    """
    # Get auction
    auction = repositories.get_auction(db=db, auction_id=auction_id)
    if not auction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Auction not found"
        )
    
    # Check if auction is scheduled or pending (can deposit)
    # Không cho phép deposit nếu auction đã completed hoặc cancelled
    if auction.auctionStatus in ["completed", "cancelled"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot deposit for {auction.auctionStatus} auction"
        )
    
    # Calculate deposit amount
    deposit_amount = bank_port.calculate_deposit_amount(auction)
    
    # Validate deposit amount
    is_valid, error = validate_price(deposit_amount, min_price=1000)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error
        )
    
    # Create deposit transaction
    deposit_result = bank_port.create_deposit_transaction(
        db=db,
        user_id=current_user.accountID,
        auction_id=auction_id,
        amount=deposit_amount
    )
    
    return {
        "success": True,
        "message": "Deposit created successfully",
        "data": {
            "transaction_id": deposit_result["transaction_id"],
            "auction_id": auction_id,
            "auction_name": auction.auctionName,
            "amount": format_currency(deposit_amount),
            "amount_raw": deposit_amount,
            "status": deposit_result["status"],
            "qr_code": deposit_result["qr_code"],
            "bank_info": {
                "bank_name": bank_port.bank_name,
                "bank_code": bank_port.bank_code
            },
            # "created_at": format_datetime(deposit_result["created_at"], "full")
        }
    }


@router.get("/deposit/status/{transaction_id}", response_model=dict)
def get_deposit_status(
    transaction_id: str,
    current_user=Depends(get_current_active_user)
):
    """
    Check deposit transaction status
    
    GET /bank/deposit/status/DEP_ABC123DEF456
    Headers: Authorization: Bearer <access_token>
    Returns: Deposit status
    """
    status_result = bank_port.get_transaction_status(transaction_id)
    
    return {
        "success": True,
        "data": {
            "transaction_id": transaction_id,
            "status": status_result["status"],
            "bank_response": status_result["bank_response"],
            "checked_at": format_datetime(datetime.utcnow(), "full")
        }
    }


# =================== PAYMENT ENDPOINTS (Thanh toán) =================== #

@router.post("/payment/create", response_model=dict)
def create_payment(
    payment_request: dict,
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Create payment for won auction (thanh toán)
    
    This endpoint is called when user wants to pay for a won auction.
    Returns QR code for payment confirmation.
    
    POST /bank/payment/create
    Headers: Authorization: Bearer <access_token>
    Body: { "auction_id": 1, "payment_id": 123 }
    Returns: Payment transaction with QR code
    """
    auction_id = payment_request.get("auction_id")
    payment_id = payment_request.get("payment_id")
    
    if not auction_id or not payment_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="auction_id and payment_id are required"
        )
    
    # Get auction
    auction = repositories.get_auction(db=db, auction_id=auction_id)
    if not auction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Auction not found"
        )
    
    # Check if user won the auction
    if auction.bidWinnerID != current_user.accountID:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only make payment for auctions you won"
        )
    
    # Get payment
    payment = repositories.get_payment(db=db, payment_id=payment_id)
    if not payment or payment.userID != current_user.accountID:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )
    
    # Check if payment already completed
    if payment.paymentStatus == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment already completed"
        )
    
    # Get payment amount
    payment_amount = bank_port.get_payment_amount(db=db, auction=auction)
    
    # Validate payment amount
    is_valid, error = validate_price(payment_amount, min_price=1000)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error
        )
    
    # Create payment transaction
    payment_result = bank_port.create_payment_transaction(
        db=db,
        user_id=current_user.accountID,
        auction_id=auction_id,
        amount=payment_amount,
        payment_id=payment_id
    )

    # Lưu mapping transaction_id -> payment_id để auto-confirm
    bank_port.save_transaction_mapping(
        transaction_id=payment_result["transaction_id"],
        payment_id=payment_id
    )

    return {
        "success": True,
        "message": "Payment created - scan QR code to confirm",
        "data": {
            "transaction_id": payment_result["transaction_id"],
            "payment_id": payment_id,
            "auction_id": auction_id,
            "auction_name": auction.auctionName,
            "amount": format_currency(payment_amount),
            "amount_raw": payment_amount,
            "status": payment_result["status"],
            "qr_code": payment_result["qr_code"],
            "bank_info": {
                "bank_name": bank_port.bank_name,
                "bank_code": bank_port.bank_code
            },
            "payment_instructions": "Scan QR code with banking app or click payment link to complete payment",
            "created_at": format_datetime(payment_result["created_at"], "full")
        }
    }


@router.post("/payment/confirm", response_model=dict)
def confirm_payment(
    confirmation_data: dict,
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Confirm payment after QR scan or link click (thanh toán)

    This endpoint simulates user confirming payment via QR scan or web link.
    For demo: always returns successful payment.

    POST /bank/payment/confirm
    Headers: Authorization: Bearer <access_token>
    Body: { "transaction_id": "PAY_ABC123", "payment_id": 123 }
    Returns: Payment confirmation result
    """
    transaction_id = confirmation_data.get("transaction_id")
    payment_id = confirmation_data.get("payment_id")

    if not transaction_id or not payment_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="transaction_id and payment_id are required"
        )

    # Get payment
    payment = repositories.get_payment(db=db, payment_id=payment_id)
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )

    # Check if user owns the payment
    if payment.userID != current_user.accountID:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only confirm your own payments"
        )

    # Process payment confirmation
    confirmation_result = bank_port.process_payment_confirmation(
        db=db,
        transaction_id=transaction_id,
        payment_id=payment_id
    )

    # Update payment status in database if confirmation is successful
    if confirmation_result["status"] == "completed":
        repositories.update_payment_status(
            db=db,
            payment_id=payment_id,
            status="completed"
        )

    return {
        "success": True,
        "message": "Payment confirmed successfully",
        "data": {
            "transaction_id": confirmation_result["transaction_id"],
            "payment_id": confirmation_result["payment_id"],
            "status": confirmation_result["status"],
            "bank_response": confirmation_result["bank_response"],
            "confirmed_at": format_datetime(
                confirmation_result["confirmed_at"],
                "full"
            )
        }
    }


@router.get("/payment/auto-confirm/{transaction_id}", response_class=HTMLResponse)
def auto_confirm_payment(
    transaction_id: str,
    db: Session = Depends(get_db)
):
    """
    Auto-confirm payment when QR code is scanned (không cần authentication)

    Endpoint này được gọi tự động khi user quét QR code.
    Tự động xác nhận thanh toán và hiển thị trang thành công.

    GET /bank/payment/auto-confirm/PAY_ABC123DEF456
    Returns: HTML page with success message and auto-redirect
    """
    try:
        # Lấy payment_id từ transaction_id
        payment_id = bank_port.get_payment_id_from_transaction(transaction_id)

        if not payment_id:
            return HTMLResponse(
                content="""
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Giao dịch không tìm thấy</title>
                    <style>
                        body {
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            min-height: 100vh;
                            margin: 0;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        }
                        .container {
                            background: white;
                            padding: 40px;
                            border-radius: 20px;
                            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                            text-align: center;
                            max-width: 400px;
                        }
                        .icon {
                            font-size: 80px;
                            margin-bottom: 20px;
                        }
                        h1 {
                            color: #e53e3e;
                            margin: 0 0 20px 0;
                            font-size: 24px;
                        }
                        p {
                            color: #666;
                            line-height: 1.6;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="icon">❌</div>
                        <h1>Giao dịch không tìm thấy</h1>
                        <p>Transaction ID không hợp lệ hoặc đã hết hạn.</p>
                        <p>Vui lòng thử lại hoặc liên hệ hỗ trợ.</p>
                    </div>
                </body>
                </html>
                """,
                status_code=404
            )

        # Get payment từ database
        payment = repositories.get_payment(db=db, payment_id=payment_id)
        if not payment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Payment not found"
            )

        # Check if payment already completed
        if payment.paymentStatus == "completed":
            return HTMLResponse(
                content="""
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Đã thanh toán</title>
                    <style>
                        body {
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            min-height: 100vh;
                            margin: 0;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        }
                        .container {
                            background: white;
                            padding: 40px;
                            border-radius: 20px;
                            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                            text-align: center;
                            max-width: 400px;
                        }
                        .icon {
                            font-size: 80px;
                            margin-bottom: 20px;
                        }
                        h1 {
                            color: #48bb78;
                            margin: 0 0 20px 0;
                            font-size: 24px;
                        }
                        p {
                            color: #666;
                            line-height: 1.6;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="icon">✅</div>
                        <h1>Đã thanh toán trước đó</h1>
                        <p>Giao dịch này đã được xác nhận thành công.</p>
                    </div>
                </body>
                </html>
                """
            )

        # Process payment confirmation
        confirmation_result = bank_port.process_payment_confirmation(
            db=db,
            transaction_id=transaction_id,
            payment_id=payment_id
        )

        # Update payment status in database
        if confirmation_result["status"] == "completed":
            repositories.update_payment_status(
                db=db,
                payment_id=payment_id,
                status="completed"
            )

        # Get auction info for display
        auction = repositories.get_auction(db=db, auction_id=payment.auctionID)
        auction_name = auction.auctionName if auction else "Đấu giá"

        # Return success HTML page with auto-redirect
        return HTMLResponse(
            content=f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Thanh toán thành công</title>
                <style>
                    body {{
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        min-height: 100vh;
                        margin: 0;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    }}
                    .container {{
                        background: white;
                        padding: 40px;
                        border-radius: 20px;
                        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                        text-align: center;
                        max-width: 400px;
                        animation: slideIn 0.5s ease-out;
                    }}
                    @keyframes slideIn {{
                        from {{
                            opacity: 0;
                            transform: translateY(-20px);
                        }}
                        to {{
                            opacity: 1;
                            transform: translateY(0);
                        }}
                    }}
                    .icon {{
                        font-size: 80px;
                        margin-bottom: 20px;
                        animation: checkmark 0.8s ease-in-out;
                    }}
                    @keyframes checkmark {{
                        0% {{ transform: scale(0); }}
                        50% {{ transform: scale(1.2); }}
                        100% {{ transform: scale(1); }}
                    }}
                    h1 {{
                        color: #48bb78;
                        margin: 0 0 20px 0;
                        font-size: 28px;
                    }}
                    .details {{
                        background: #f7fafc;
                        padding: 20px;
                        border-radius: 10px;
                        margin: 20px 0;
                    }}
                    .detail-row {{
                        display: flex;
                        justify-content: space-between;
                        padding: 10px 0;
                        border-bottom: 1px solid #e2e8f0;
                    }}
                    .detail-row:last-child {{
                        border-bottom: none;
                    }}
                    .label {{
                        color: #718096;
                        font-weight: 500;
                    }}
                    .value {{
                        color: #2d3748;
                        font-weight: 600;
                    }}
                    .redirect-info {{
                        color: #718096;
                        font-size: 14px;
                        margin-top: 20px;
                    }}
                    .spinner {{
                        display: inline-block;
                        width: 12px;
                        height: 12px;
                        border: 2px solid #e2e8f0;
                        border-top-color: #667eea;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                        margin-left: 5px;
                    }}
                    @keyframes spin {{
                        to {{ transform: rotate(360deg); }}
                    }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="icon">✅</div>
                    <h1>Thanh toán thành công!</h1>

                    <div class="details">
                        <div class="detail-row">
                            <span class="label">Đấu giá:</span>
                            <span class="value">{auction_name}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Mã giao dịch:</span>
                            <span class="value">{transaction_id[:16]}...</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Số tiền:</span>
                            <span class="value">{format_currency(payment.amountPaid)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Thời gian:</span>
                            <span class="value">{format_datetime(datetime.utcnow(), "short")}</span>
                        </div>
                    </div>

                    <p class="redirect-info">
                        Đang chuyển về trang chủ<span class="spinner"></span>
                    </p>
                </div>

                <script>
                    // Auto redirect sau 3 giây
                    setTimeout(() => {{
                        window.location.href = 'http://localhost:5173/dashboard/my-won-auctions';
                    }}, 3000);
                </script>
            </body>
            </html>
            """
        )

    except Exception as e:
        return HTMLResponse(
            content=f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Lỗi thanh toán</title>
                <style>
                    body {{
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        min-height: 100vh;
                        margin: 0;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    }}
                    .container {{
                        background: white;
                        padding: 40px;
                        border-radius: 20px;
                        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                        text-align: center;
                        max-width: 400px;
                    }}
                    .icon {{
                        font-size: 80px;
                        margin-bottom: 20px;
                    }}
                    h1 {{
                        color: #e53e3e;
                        margin: 0 0 20px 0;
                        font-size: 24px;
                    }}
                    p {{
                        color: #666;
                        line-height: 1.6;
                    }}
                    .error-detail {{
                        background: #fff5f5;
                        padding: 15px;
                        border-radius: 8px;
                        margin-top: 20px;
                        color: #c53030;
                        font-size: 14px;
                    }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="icon">❌</div>
                    <h1>Lỗi thanh toán</h1>
                    <p>Đã xảy ra lỗi trong quá trình xử lý thanh toán.</p>
                    <p>Vui lòng thử lại sau hoặc liên hệ hỗ trợ.</p>
                    <div class="error-detail">
                        {str(e)}
                    </div>
                </div>
            </body>
            </html>
            """,
            status_code=500
        )


@router.get("/payment/qr/{transaction_id}", response_model=dict)
def get_payment_qr(
    transaction_id: str,
    current_user=Depends(get_current_active_user)
):
    """
    Get QR code for existing payment transaction
    
    GET /bank/payment/qr/PAY_ABC123DEF456
    Headers: Authorization: Bearer <access_token>
    Returns: QR code for payment
    """
    # For demo, generate QR code for the transaction
    qr_code = bank_port.generate_qr_code(
        transaction_id=transaction_id,
        amount=0,  # Amount would be stored elsewhere in real implementation
        description="Auction payment"
    )
    
    return {
        "success": True,
        "data": {
            "transaction_id": transaction_id,
            "qr_code": qr_code,
            "bank_info": {
                "bank_name": bank_port.bank_name,
                "bank_code": bank_port.bank_code
            },
            "payment_instructions": "Scan QR code with your banking app to complete payment",
            "generated_at": format_datetime(datetime.utcnow(), "full")
        }
    }


@router.get("/payment/status/{transaction_id}", response_model=dict)
def get_payment_status(
    transaction_id: str,
    current_user=Depends(get_current_active_user)
):
    """
    Check payment transaction status
    
    GET /bank/payment/status/PAY_ABC123DEF456
    Headers: Authorization: Bearer <access_token>
    Returns: Payment status
    """
    status_result = bank_port.get_transaction_status(transaction_id)
    
    return {
        "success": True,
        "data": {
            "transaction_id": transaction_id,
            "status": status_result["status"],
            "bank_response": status_result["bank_response"],
            "checked_at": format_datetime(datetime.utcnow(), "full")
        }
    }


# =================== TERMS AND CONDITIONS ENDPOINT =================== #

@router.get("/terms", response_model=dict)
def get_terms_and_conditions():
    """
    Get terms and conditions for the auction platform
    
    GET /bank/terms
    Returns: Terms and conditions text
    """
    terms_text = """Các điều khoản sử dụng: - Nhóm 7 - Nhóm 7 - Nhóm 7
Các điều khoản sử dụng: - Nhóm 7 - Nhóm 7 - Nhóm 7
Các điều khoản sử dụng: - Nhóm 7 - Nhóm 7 - Nhóm 7
Các điều khoản sử dụng: - Nhóm 7 - Nhóm 7 - Nhóm 7
Các điều khoản sử dụng: - Nhóm 7 - Nhóm 7 - Nhóm 7
Các điều khoản sử dụng: - Nhóm 7 - Nhóm 7 - Nhóm 7
Các điều khoản sử dụng: - Nhóm 7 - Nhóm 7 - Nhóm 7"""
    
    return {
        "success": True,
        "data": {
            "title": "Điều khoản sử dụng",
            "content": terms_text,
            "version": "1.0.0",
            "last_updated": "2025-11-19T09:24:30.000Z"
        }
    }


# =================== UTILITY ENDPOINTS =================== #

@router.get("/banks", response_model=dict)
def get_supported_banks():
    """
    Get list of supported banks (mock data)
    
    GET /bank/banks
    Returns: List of supported banks
    """
    banks = [
        {
            "bank_code": bank_port.bank_code,
            "bank_name": bank_port.bank_name,
            "status": "active",
            "qr_support": True
        },
        {
            "bank_code": "VCB",
            "bank_name": "Vietcombank",
            "status": "active",
            "qr_support": True
        },
        {
            "bank_code": "TCB",
            "bank_name": "Techcombank",
            "status": "active",
            "qr_support": True
        },
        {
            "bank_code": "CTG",
            "bank_name": "VietinBank",
            "status": "active",
            "qr_support": True
        }
    ]
    
    return {
        "success": True,
        "data": banks
    }


@router.get("/health", response_model=dict)
def bank_health_check():
    """
    Health check endpoint for bank API
    
    GET /bank/health
    Returns: Bank API status
    """
    return {
        "success": True,
        "message": "Mock Bank API is running",
        "data": {
            "bank_name": bank_port.bank_name,
            "bank_code": bank_port.bank_code,
            "status": "healthy",
            "timestamp": format_datetime(datetime.utcnow(), "full")
        }
    }


# =================== USER TRANSACTIONS =================== #

@router.get("/transactions/me", response_model=dict)
def get_my_transactions(
    transaction_type: str = Query(None, regex="^(deposit|payment)$"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get current user's bank transactions
    
    GET /bank/transactions/me?transaction_type=deposit&skip=0&limit=20
    Headers: Authorization: Bearer <access_token>
    Returns: Paginated list of user's transactions
    """
    # Get user's payments
    payments = repositories.get_payments_by_user(
        db=db,
        user_id=current_user.accountID,
        skip=skip,
        limit=limit
    )
    
    # Format transactions
    formatted_transactions = []
    for payment in payments:
        # Get auction info
        auction = repositories.get_auction(db=db, auction_id=payment.auctionID)
        
        formatted_transactions.append({
            "payment_id": payment.paymentID,
            "auction_id": payment.auctionID,
            "auction_name": auction.auctionName if auction else None,
            "amount": format_currency(payment.amountPaid),
            "amount_raw": payment.amountPaid,
            "payment_type": payment.paymentType,
            "payment_method": payment.paymentMethod,
            "status": payment.paymentStatus,
            "created_at": format_datetime(payment.createdAt, "full"),
            "paid_at": format_datetime(payment.paidAt, "full") if payment.paidAt else None
        })
    
    from utils import format_pagination_response
    return format_pagination_response(
        items=formatted_transactions,
        page=(skip // limit) + 1,
        page_size=limit,
        total_items=len(formatted_transactions)
    )