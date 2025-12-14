"""
BankPort - Mock bank API interface for handling deposits and payments
Gateway class để giao tiếp với dịch vụ API ngân hàng ngoài
"""
import uuid
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from app import models, schemas, repositories

class BankPort:
    """
    Mock bank interface Gateway để giao tiếp với dịch vụ API ngân hàng ngoài

    Các endpoint được fake mặc định là thành công vì hiện tại không có API thực tế của ngân hàng
    """

    def __init__(self):
        self.bank_name = "MockBank VietNam"
        self.bank_code = "MB"
        self.is_mock_mode = True  # Đánh dấu đây là mock mode

        # In-memory storage cho transaction mapping (transaction_id -> payment_id)
        # Trong production, nên lưu vào database
        self._transaction_mapping: Dict[str, int] = {}
        
    def get_service_status(self) -> Dict[str, Any]:
        """
        Kiểm tra trạng thái dịch vụ ngân hàng
        Default trả về thành công vì đang ở mock mode
        """
        return {
            "service_status": "active",
            "mock_mode": self.is_mock_mode,
            "bank_name": self.bank_name,
            "bank_code": self.bank_code,
            "last_check": datetime.utcnow().isoformat(),
            "response_time_ms": 50,  # Mock response time
            "uptime": "99.9%"  # Mock uptime
        }
    
    def generate_qr_code(self, transaction_id: str, amount: int, description: str = None, base_url: str = "http://localhost:8000") -> str:
        """
        Generate mock QR code for transaction
        Returns auto-confirm URL that will automatically confirm payment when accessed
        """
        # Auto-confirm URL - khi quét QR sẽ tự động confirm payment
        auto_confirm_url = f"{base_url}/api/v1/bank/payment/auto-confirm/{transaction_id}"
        return auto_confirm_url

    def save_transaction_mapping(self, transaction_id: str, payment_id: int) -> None:
        """
        Lưu mapping giữa transaction_id và payment_id
        """
        self._transaction_mapping[transaction_id] = payment_id

    def get_payment_id_from_transaction(self, transaction_id: str) -> Optional[int]:
        """
        Lấy payment_id từ transaction_id
        """
        return self._transaction_mapping.get(transaction_id)
    
    def create_deposit_transaction(self, db: Session, user_id: int, auction_id: int, amount: int) -> Dict[str, Any]:
        """
        Create deposit transaction (đặt cọc)
        For demo: always returns success immediately
        """
        transaction_id = f"DEP_{uuid.uuid4().hex[:12].upper()}"
        
        # Generate QR code
        qr_code = self.generate_qr_code(
            transaction_id=transaction_id,
            amount=amount,
            description=f"Deposit for auction {auction_id}"
        )
        
        # Mock deposit - immediately successful for demo
        deposit_result = {
            "transaction_id": transaction_id,
            "status": "completed",  # Success immediately for demo
            "amount": amount,
            "bank_response": {
                "code": "00",
                "message": "Deposit successful",
                "timestamp": datetime.utcnow().isoformat()
            },
            "qr_code": qr_code,
            "created_at": datetime.utcnow().isoformat()
        }
        
        return deposit_result
    
    def create_payment_transaction(self, db: Session, user_id: int, auction_id: int, amount: int, payment_id: int) -> Dict[str, Any]:
        """
        Create payment transaction (thanh toán)
        For demo: returns pending status with QR code
        """
        transaction_id = f"PAY_{uuid.uuid4().hex[:12].upper()}"
        
        # Generate QR code
        qr_code = self.generate_qr_code(
            transaction_id=transaction_id,
            amount=amount,
            description=f"Payment for auction {auction_id}"
        )
        
        # Mock payment - returns pending for demo, but will be successful when confirmed
        payment_result = {
            "transaction_id": transaction_id,
            "status": "pending",  # Pending for demo
            "amount": amount,
            "bank_response": {
                "code": "01",
                "message": "Payment pending - scan QR to confirm",
                "timestamp": datetime.utcnow().isoformat()
            },
            "qr_code": qr_code,
            "payment_id": payment_id,
            "created_at": datetime.utcnow().isoformat()
        }
        
        return payment_result
    
    def process_payment_confirmation(self, db: Session, transaction_id: str, payment_id: int) -> Dict[str, Any]:
        """
        Process payment confirmation (when user scans QR or clicks payment link)
        For demo: returns success
        """
        # Mock payment processing - always successful for demo
        confirmation_result = {
            "transaction_id": transaction_id,
            "payment_id": payment_id,
            "status": "completed",  # Success for demo
            "bank_response": {
                "code": "00",
                "message": "Payment completed successfully",
                "timestamp": datetime.utcnow().isoformat()
            },
            "confirmed_at": datetime.utcnow().isoformat()
        }
        
        return confirmation_result
    
    def get_transaction_status(self, transaction_id: str) -> Dict[str, Any]:
        """
        Get status of a transaction
        """
        # Mock status check - always returns completed for demo
        status_result = {
            "transaction_id": transaction_id,
            "status": "completed",
            "bank_response": {
                "code": "00",
                "message": "Transaction completed",
                "timestamp": datetime.utcnow().isoformat()
            }
        }
        
        return status_result
    
    def calculate_deposit_amount(self, auction: models.Auction) -> int:
        """
        Calculate deposit amount based on auction (typically 10% of starting price)
        """
        # Mock calculation: 10% of price_step as deposit
        deposit_amount = max(10000, int(auction.priceStep * 0.1))  # Minimum 10,000 VND
        return deposit_amount
    
    def get_payment_amount(self, db: Session, auction: models.Auction) -> int:
        """
        Get payment amount (winning bid amount)
        """
        # Get highest bid to determine payment amount
        highest_bid = repositories.get_current_highest_bid(db=db, auction_id=auction.auction_id)
        if highest_bid:
            return highest_bid.bid_price
        return auction.price_step  # Fallback to price_step
    
    # ========== GATEWAY ENDPOINTS FOR EXTERNAL API COMMUNICATION ==========
    
    def validate_account(self, account_number: str, bank_code: str = None) -> Dict[str, Any]:
        """
        Endpoint gateway: Kiểm tra tài khoản ngân hàng
        Default trả về thành công (mock mode)
        """
        return {
            "success": True,
            "account_valid": True,
            "account_number": account_number,
            "bank_code": bank_code or self.bank_code,
            "validation_time": datetime.utcnow().isoformat(),
            "mock_response": True
        }
    
    def get_account_balance(self, account_number: str, bank_code: str = None) -> Dict[str, Any]:
        """
        Endpoint gateway: Lấy số dư tài khoản
        Default trả về số dư đủ để giao dịch (mock mode)
        """
        return {
            "success": True,
            "account_number": account_number,
            "bank_code": bank_code or self.bank_code,
            "balance": 100000000,  # 100 triệu VND (mock)
            "currency": "VND",
            "last_updated": datetime.utcnow().isoformat(),
            "mock_response": True
        }
    
    def transfer_money(self, from_account: str, to_account: str, amount: int, 
                      bank_code: str = None, description: str = None) -> Dict[str, Any]:
        """
        Endpoint gateway: Chuyển tiền
        Default trả về thành công (mock mode)
        """
        transaction_id = f"TXN_{uuid.uuid4().hex[:12].upper()}"
        
        return {
            "success": True,
            "transaction_id": transaction_id,
            "from_account": from_account,
            "to_account": to_account,
            "amount": amount,
            "currency": "VND",
            "description": description or "Chuyển tiền đấu giá",
            "bank_code": bank_code or self.bank_code,
            "status": "completed",
            "transaction_time": datetime.utcnow().isoformat(),
            "reference_number": f"REF{uuid.uuid4().hex[:8].upper()}",
            "mock_response": True
        }
    
    def get_transaction_history(self, account_number: str, limit: int = 10, 
                               bank_code: str = None) -> Dict[str, Any]:
        """
        Endpoint gateway: Lấy lịch sử giao dịch
        Default trả về danh sách giao dịch mock (mock mode)
        """
        transactions = []
        for i in range(min(limit, 5)):  # Mock 5 transactions max
            transactions.append({
                "transaction_id": f"TXN_{uuid.uuid4().hex[:12].upper()}",
                "amount": 50000 + (i * 10000),
                "type": "credit" if i % 2 == 0 else "debit",
                "description": f"Giao dịch mock #{i+1}",
                "timestamp": (datetime.utcnow().replace(hour=9+i, minute=0)).isoformat()
            })
        
        return {
            "success": True,
            "account_number": account_number,
            "bank_code": bank_code or self.bank_code,
            "transactions": transactions,
            "total_count": len(transactions),
            "mock_response": True
        }
    
    def check_service_health(self) -> Dict[str, Any]:
        """
        Endpoint gateway: Kiểm tra sức khỏe dịch vụ ngân hàng
        Default trả về healthy (mock mode)
        """
        return {
            "status": "healthy",
            "service": "Banking Service",
            "bank_name": self.bank_name,
            "bank_code": self.bank_code,
            "timestamp": datetime.utcnow().isoformat(),
            "response_time_ms": 120,
            "uptime": "99.95%",
            "last_maintenance": "2024-01-01T00:00:00Z",
            "mock_mode": True
        }

# Khởi tạo instance global để sử dụng trong toàn bộ ứng dụng
bank_port = BankPort()