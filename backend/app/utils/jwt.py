from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Union
from jose import JWTError, jwt
from fastapi import HTTPException, status

# Giả định import settings từ project của bạn
from app.config import settings

# Cấu hình Constants
SECRET_KEY = settings.JWT_SECRET_KEY
ALGORITHM = settings.JWT_ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES
REFRESH_TOKEN_EXPIRE_DAYS = settings.REFRESH_TOKEN_EXPIRE_DAYS

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Tạo Access Token mới"""
    to_encode = data.copy()
    
    # 1. Xử lý thời gian hết hạn (Luôn dùng UTC)
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # 2. Ép kiểu 'sub' thành string để tránh lỗi
    if "sub" in to_encode:
        to_encode["sub"] = str(to_encode["sub"])

    to_encode.update({"exp": expire, "type": "access"})
    
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Tạo Refresh Token mới"""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    if "sub" in to_encode:
        to_encode["sub"] = str(to_encode["sub"])
        
    to_encode.update({"exp": expire, "type": "refresh"})
    
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str, verify_exp: bool = True) -> Dict[str, Any]:
    """
    Hàm lõi để giải mã token.
    Sẽ raise HTTPException nếu token không hợp lệ.
    """
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
            options={"verify_exp": verify_exp}
        )
        return payload
    except JWTError as e:
        # Gom chung các lỗi JWT thành 401
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

def create_token_pair(user_id: Union[int, str], username: str, role: str) -> Dict[str, str]:
    """Tạo cả cặp Access và Refresh token"""
    
    # Access Token chứa nhiều thông tin để FE dùng
    access_token = create_access_token(
        data={
            "sub": str(user_id), # Quan trọng: Ép kiểu string
            "username": username,
            "role": role
        }
    )
    
    # Refresh Token chỉ cần chứa ID để định danh
    refresh_token = create_refresh_token(
        data={"sub": str(user_id)}
    )
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }

def verify_token_type(token: str, required_type: str) -> Dict[str, Any]:
    """Kiểm tra token có đúng loại (access/refresh) không"""
    payload = decode_token(token)
    
    if payload.get("type") != required_type:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token type. Expected {required_type}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload

def refresh_access_token(refresh_token: str) -> Optional[str]:
    """
    Tạo Access Token mới từ Refresh Token.
    Lưu ý: Access Token mới sẽ chỉ có 'sub', các thông tin khác (role, username)
    cần được query lại từ DB nếu cần thiết ở tầng Service.
    """
    try:
        # 1. Verify token và kiểm tra loại
        payload = verify_token_type(refresh_token, "refresh")
        
        user_id = payload.get("sub")
        if not user_id:
            return None
            
        # 2. Tạo access token mới
        # Lưu ý: Ở đây ta chỉ có user_id. Nếu muốn access_token mới có cả role/username,
        # bạn cần truyền thêm vào hàm này hoặc query DB.
        new_access_token = create_access_token(
            data={"sub": user_id} 
        )
        
        return new_access_token
        
    except HTTPException:
        return None
    except JWTError:
        return None


def get_token_expiry(token: str) -> Optional[datetime]:
    try:
        payload = decode_token(token, verify_exp=False)
        exp = payload.get("exp")
        if exp:
            return datetime.fromtimestamp(exp)
        return None
    except Exception:
        return None