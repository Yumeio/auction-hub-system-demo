"""
Rate Limiting Middleware
Prevents abuse by limiting request rates
"""
import time
import asyncio
from typing import Dict, Tuple
from collections import defaultdict
from fastapi import Request, HTTPException, status, FastAPI
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware


class RateLimiterMiddleware(BaseHTTPMiddleware):
    """
    Simple in-memory rate limiter
    For production, use Redis-based rate limiting
    """
    
    def __init__(
        self,
        app: FastAPI,
        requests_per_minute: int = 60,
        requests_per_hour: int = 1000,
        enabled: bool = True
    ):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.requests_per_hour = requests_per_hour
        self.enabled = enabled
        
        # Storage: {client_id: [(timestamp, count), ...]}
        self.request_counts: Dict[str, list] = defaultdict(list)
        self.lock = asyncio.Lock()
    
    async def dispatch(self, request: Request, call_next):
        if not self.enabled:
            return await call_next(request)
        
        # Get client identifier (IP or user_id if authenticated)
        client_id = self._get_client_id(request)
        
        # Check rate limit
        async with self.lock:
            if not self._check_rate_limit(client_id):
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Rate limit exceeded. Please try again later.",
                    headers={
                        "Retry-After": "60",
                        "X-RateLimit-Limit": str(self.requests_per_minute),
                        "X-RateLimit-Remaining": "0",
                    }
                )
            
            # Record request
            self._record_request(client_id)
        
        # Process request
        response = await call_next(request)
        
        # Add rate limit headers
        remaining = self._get_remaining_requests(client_id)
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(int(time.time()) + 60)
        
        return response
    
    def _get_client_id(self, request: Request) -> str:
        """Get client identifier from request"""
        # Use user_id if authenticated
        if hasattr(request.state, "user_id"):
            return f"user_{request.state.user_id}"
        
        # Otherwise use IP address
        if request.client:
            return f"ip_{request.client.host}"
        
        return "unknown"
    
    def _check_rate_limit(self, client_id: str) -> bool:
        """Check if client has exceeded rate limit"""
        now = time.time()
        requests = self.request_counts[client_id]
        
        # Remove old requests
        one_minute_ago = now - 60
        one_hour_ago = now - 3600
        
        recent_requests = [
            (ts, count) for ts, count in requests
            if ts > one_hour_ago
        ]
        self.request_counts[client_id] = recent_requests
        
        # Count requests in last minute
        minute_count = sum(
            count for ts, count in recent_requests
            if ts > one_minute_ago
        )
        
        # Count requests in last hour
        hour_count = sum(count for ts, count in recent_requests)
        
        # Check limits
        if minute_count >= self.requests_per_minute:
            return False
        if hour_count >= self.requests_per_hour:
            return False
        
        return True
    
    def _record_request(self, client_id: str):
        """Record a request for rate limiting"""
        now = time.time()
        self.request_counts[client_id].append((now, 1))
    
    def _get_remaining_requests(self, client_id: str) -> int:
        """Get number of remaining requests in current minute"""
        now = time.time()
        one_minute_ago = now - 60
        
        minute_count = sum(
            count for ts, count in self.request_counts[client_id]
            if ts > one_minute_ago
        )
        
        return max(0, self.requests_per_minute - minute_count)


class EndpointRateLimiter:
    """
    Rate limiter with different limits for different endpoints
    """
    
    def __init__(self, limits: Dict[str, tuple]):
        """
        Args:
            limits: Dict mapping path patterns to (requests_per_minute, requests_per_hour)
                   Example: {"/api/v1/auth/login": (5, 20)}
        """
        self.limits = limits or {}
        self.default_limit = (60, 1000)  # Default: 60/min, 1000/hour
        self.request_counts: Dict[str, Dict[str, list]] = defaultdict(lambda: defaultdict(list))
        self.lock = asyncio.Lock()
    
    async def __call__(self, request: Request, call_next):
        client_id = self._get_client_id(request)
        path = request.url.path
        
        # Get rate limit for this endpoint
        limit = self._get_limit_for_path(path)
        requests_per_minute, requests_per_hour = limit
        
        # Check rate limit
        async with self.lock:
            if not self._check_rate_limit(client_id, path, requests_per_minute, requests_per_hour):
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Rate limit exceeded for {path}",
                    headers={"Retry-After": "60"}
                )
            
            self._record_request(client_id, path)
        
        response = await call_next(request)
        return response
    
    def _get_client_id(self, request: Request) -> str:
        """Get client identifier"""
        if hasattr(request.state, "user_id"):
            return f"user_{request.state.user_id}"
        if request.client:
            return f"ip_{request.client.host}"
        return "unknown"
    
    def _get_limit_for_path(self, path: str) -> tuple:
        """Get rate limit for specific path"""
        for pattern, limit in self.limits.items():
            if path.startswith(pattern):
                return limit
        return self.default_limit
    
    def _check_rate_limit(
        self,
        client_id: str,
        path: str,
        requests_per_minute: int,
        requests_per_hour: int
    ) -> bool:
        """Check rate limit for specific endpoint"""
        now = time.time()
        requests = self.request_counts[client_id][path]
        
        # Clean old requests
        one_minute_ago = now - 60
        one_hour_ago = now - 3600
        
        recent = [ts for ts in requests if ts > one_hour_ago]
        self.request_counts[client_id][path] = recent
        
        minute_count = sum(1 for ts in recent if ts > one_minute_ago)
        hour_count = len(recent)
        
        return minute_count < requests_per_minute and hour_count < requests_per_hour
    
    def _record_request(self, client_id: str, path: str):
        """Record request"""
        self.request_counts[client_id][path].append(time.time())


# Common rate limit configurations
STRICT_RATE_LIMIT = {
    "/api/v1/auth/login": (5, 20),           # 5/min, 20/hour for login
    "/api/v1/auth/register": (3, 10),        # 3/min, 10/hour for registration
    "/api/v1/auth/password-reset": (3, 10),  # 3/min, 10/hour for password reset
    "/api/v1/bids": (10, 100),               # 10/min, 100/hour for bidding
}

MODERATE_RATE_LIMIT = {
    "/api/v1/auth/login": (10, 50),
    "/api/v1/auth/register": (5, 20),
    "/api/v1/bids": (20, 200),
}

PERMISSIVE_RATE_LIMIT = {
    "/api/v1/auth/login": (30, 200),
    "/api/v1/auth/register": (10, 50),
}