"""
CORS Middleware
Handles Cross-Origin Resource Sharing
"""
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional


def setup_cors(app: FastAPI, allowed_origins: Optional[List[str]] = None):
    """
    Setup CORS middleware for the application
    
    Args:
        app: FastAPI application instance
        allowed_origins: List of allowed origins. If None, allows all origins.
    
    Usage:
        from middleware.cors import setup_cors
        
        app = FastAPI()
        setup_cors(app, allowed_origins=["http://localhost:3000"])
    """
    if allowed_origins is None:
        allowed_origins = ["*"]
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
    )


class CustomCORSMiddleware:
    """
    Custom CORS middleware with more control
    Useful if you need custom logic for different endpoints
    """
    
    def __init__(
        self,
        allowed_origins: Optional[List[str]] = None,
        allowed_methods: Optional[List[str]] = None,
        allowed_headers: Optional[List[str]] = None,
        allow_credentials: bool = True,
        max_age: int = 600
    ):
        self.allowed_origins = allowed_origins or ["*"]
        self.allowed_methods = allowed_methods or ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
        self.allowed_headers = allowed_headers or ["*"]
        self.allow_credentials = allow_credentials
        self.max_age = max_age
    
    async def __call__(self, request, call_next):
        # Get origin from request
        origin = request.headers.get("origin")
        
        # Handle preflight OPTIONS request
        if request.method == "OPTIONS":
            response = Response()
            response.status_code = 200
        else:
            response = await call_next(request)
        
        # Add CORS headers
        if origin and (self._is_origin_allowed(origin) or "*" in self.allowed_origins):
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Methods"] = ", ".join(self.allowed_methods)
            response.headers["Access-Control-Allow-Headers"] = ", ".join(self.allowed_headers)
            
            if self.allow_credentials:
                response.headers["Access-Control-Allow-Credentials"] = "true"
            
            response.headers["Access-Control-Max-Age"] = str(self.max_age)
        
        return response
    
    def _is_origin_allowed(self, origin: str) -> bool:
        """Check if origin is in allowed list"""
        return origin in self.allowed_origins


# Common CORS configurations
DEVELOPMENT_CORS = {
    "allowed_origins": [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:5173",  # Vite default
        "http://127.0.0.1:3000",
    ],
    "allow_credentials": True,
}

PRODUCTION_CORS = {
    "allowed_origins": [
    ],
    "allow_credentials": True,
}

PERMISSIVE_CORS = {
    "allowed_origins": ["*"],
    "allow_credentials": False,  # Cannot use credentials with wildcard origin
}