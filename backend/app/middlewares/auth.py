import os
from datetime import datetime
from typing import Optional, List

from fastapi import Request, HTTPException, status, Depends, Security
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware
from jose import jwt, JWTError

from app.config import settings
from app.models import Account
from app.repositories.account import get_account_by_id
from app.database import get_db

security = HTTPBearer()

class AuthMiddleware(BaseHTTPMiddleware):
    def __init__(
        self, 
        app, 
        secret_key: str = settings.JWT_SECRET_KEY, 
        algorithm: str = settings.JWT_ALGORITHM,
        public_paths: Optional[List[str]] = None
    ):
        super().__init__(app)
        self.secret_key = secret_key
        self.algorithm = algorithm
        self.public_paths = public_paths or [
            "/docs", 
            "/redoc", 
            "/openapi.json", 
            "/api/v1/auth/login", 
            "/api/v1/auth/register"
        ]

    async def dispatch(self, request: Request, call_next):
        # 1. Skip authentication for public endpoints
        if self._is_public_endpoint(request.url.path):
            return await call_next(request)
        
        # 2. Get token from Authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Missing or invalid authorization header"},
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        token = auth_header.replace("Bearer ", "")
        
        try:
            # 3. Decode and validate token
            payload = jwt.decode(
                token,
                self.secret_key,
                algorithms=[self.algorithm]
            )
            
            # 4. Check expiration (Jose tự check, nhưng check thêm cho chắc)
            exp = payload.get("exp")
            if exp and datetime.utcnow().timestamp() > exp:
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content={"detail": "Token has expired"},
                )
            
            # 5. Attach user info to request state (Quan trọng!)
            # Để router phía sau có thể dùng request.state.user_id mà không cần decode lại
            request.state.user_id = payload.get("sub")
            request.state.username = payload.get("username")
            request.state.role = payload.get("role")
            
        except JWTError:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Could not validate credentials"},
            )
        
        # 6. Continue to the next middleware/router
        response = await call_next(request)
        return response

    def _is_public_endpoint(self, path: str) -> bool:
        """Check if endpoint is public"""
        # Logic check startswith để cover cả sub-paths nếu cần
        return any(path.startswith(public_path) for public_path in self.public_paths)
    
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
    db = Depends(get_db)
) -> Account:
    """
    Dependency to get current authenticated user
    
    Usage:
        @app.get("/me")
        def get_me(current_user: Account = Depends(get_current_user)):
            return current_user
    """
    token = credentials.credentials
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=settings.JWT_ALGORITHM
        )
        user_id = payload.get("sub")
        if user_id is None:
            print("Debug: Token không chứa field 'sub'")
            raise credentials_exception
        
        exp = payload.get("exp")
        if exp and datetime.utcnow().timestamp() > exp:
             raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except JWTError: 
        raise credentials_exception
    
    user = get_account_by_id(db, user_id)
    if user is None:
        raise credentials_exception
    
    return user

async def get_current_active_user(
    current_user: Account = Depends(get_current_user)
) -> Account:
    """
    Dependency to get current active user (not suspended)
    
    Usage:
        @app.get("/protected")
        def protected_route(user: Account = Depends(get_current_active_user)):
            return {"message": f"Hello {user.username}"}
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive or suspended"
        )
    return current_user

async def require_admin(
    current_user: Account = Depends(get_current_active_user)
) -> Account:
    """
    Dependency to require admin role

    Usage:
        @app.get("/admin/users")
        def get_all_users(admin: Account = Depends(require_admin)):
            return get_all_users_from_db()
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return current_user


async def get_current_user_from_query(
    token: Optional[str] = None,
    db = Depends(get_db)
) -> Account:
    """
    Dependency to get current user from query parameter token
    Used for SSE endpoints where EventSource cannot send custom headers

    Usage:
        @app.get("/sse/stream")
        def stream(current_user: Account = Depends(get_current_user_from_query)):
            return EventSourceResponse(generator(current_user.accountID))
    """
    # Accept token from query parameter for SSE compatibility
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token"
        )

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials"
    )

    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception

        exp = payload.get("exp")
        if exp and datetime.utcnow().timestamp() > exp:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired"
            )
    except JWTError:
        raise credentials_exception

    user = get_account_by_id(db, user_id)
    if user is None or not user.is_active:
        raise credentials_exception

    return user