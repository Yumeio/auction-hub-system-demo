import traceback
import logging
from fastapi import Request, status, FastAPI
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from pydantic import ValidationError
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

class ErrorHandlerMiddleware(BaseHTTPMiddleware):
    """Middleware for centralized error handling"""
    
    def __init__(self, app: FastAPI, debug: bool = False):
        super().__init__(app)
        self.app = app
        self.debug = debug
    
    async def dispatch(self, request: Request, call_next):
        try:
            response = await call_next(request)
            return response
            
        except ValidationError as e:
            # Pydantic validation errors
            logger.warning(f"Validation error: {e}")
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content={
                    "error": "Validation Error",
                    "detail": e.errors(),
                    "success": False
                }
            )
        
        except IntegrityError as e:
            # Database integrity errors (unique constraint, foreign key, etc.)
            logger.error(f"Database integrity error: {e}")
            return JSONResponse(
                status_code=status.HTTP_409_CONFLICT,
                content={
                    "error": "Database Integrity Error",
                    "detail": "Resource already exists or violates constraints",
                    "success": False
                }
            )
        
        except SQLAlchemyError as e:
            # Other database errors
            logger.error(f"Database error: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "error": "Database Error",
                    "detail": "An error occurred while accessing the database",
                    "success": False
                }
            )
        
        except ValueError as e:
            # Value errors (invalid input)
            logger.warning(f"Value error: {e}")
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={
                    "error": "Invalid Input",
                    "detail": str(e),
                    "success": False
                }
            )
        
        except PermissionError as e:
            # Permission errors
            logger.warning(f"Permission error: {e}")
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={
                    "error": "Permission Denied",
                    "detail": str(e),
                    "success": False
                }
            )
        
        except Exception as e:
            # Catch-all for unexpected errors
            logger.error(f"Unexpected error: {e}")
            logger.error(traceback.format_exc())
            
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "error": "Internal Server Error",
                    "detail": str(e) if self.debug else "An unexpected error occurred",
                    "success": False,
                    "traceback": traceback.format_exc() if self.debug else None
                }
            )


def format_error_response(
    error_type: str,
    message: str,
    status_code: int = 400,
    details: Optional[Dict[str, Any]] = None
) -> JSONResponse:
    """
    Format standardized error response
    
    Args:
        error_type: Type of error (e.g., "ValidationError", "NotFound")
        message: Error message
        status_code: HTTP status code
        details: Additional error details
    
    Returns:
        JSONResponse with standardized error format
    """
    content = {
        "error": error_type,
        "message": message,
        "success": False
    }
    
    if details:
        content["details"] = details
    
    return JSONResponse(
        status_code=status_code,
        content=content
    )