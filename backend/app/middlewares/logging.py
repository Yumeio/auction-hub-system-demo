import logging
import time
import uuid
from fastapi import Request, FastAPI
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.concurrency import iterate_in_threadpool

logger = logging.getLogger(__name__)

class LoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware for request/response logging
    Handles Body stream consumption safely.
    """
    def __init__(self, app: FastAPI, log_request_body: bool = False):
        super().__init__(app)
        self.log_request_body = log_request_body
    
    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())[:8]
        start_time = time.time()
        
        log_dict = {
            "id": request_id,
            "method": request.method,
            "path": request.url.path,
            "client": request.client.host if request.client else None
        }

        # Handle Body Logging (Be careful with large files/performance)
        if self.log_request_body and request.method in ["POST", "PUT", "PATCH"]:
            await self._log_body(request, log_dict)

        logger.info(f"REQ: {log_dict}")

        try:
            response = await call_next(request)
            
            process_time = time.time() - start_time
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Process-Time"] = f"{process_time:.3f}s"
            
            logger.info(
                f"RES: [{request_id}] {response.status_code} "
                f"({process_time:.3f}s)"
            )
            return response
            
        except Exception as e:
            process_time = time.time() - start_time
            logger.error(f"ERR: [{request_id}] {str(e)} ({process_time:.3f}s)")
            raise

    async def _log_body(self, request: Request, log_dict: dict):
        """
        Safely read body and restore it for the next handler
        """
        try:
            # Read all body
            body_bytes = await request.body()
            
            # Store for logging
            log_dict["body"] = body_bytes.decode() if len(body_bytes) < 1000 else "<Too Large>"
            
            # Restore body for the actual route handler! (CRITICAL STEP)
            async def receive():
                return {"type": "http.request", "body": body_bytes}
            request._receive = receive
            
        except Exception:
            log_dict["body"] = "<Error reading body>"

def setup_logging(log_level: str = "INFO"):
    logging.basicConfig(
        level=getattr(logging, log_level.upper()),
        format='%(asctime)s - %(levelname)s - %(message)s'
    )