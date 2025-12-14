from .auth import (
    AuthMiddleware,
    get_current_user,
    get_current_active_user,
    get_current_user_from_query,
    require_admin,
    security,
)

from .error_handler import (
    ErrorHandlerMiddleware,
    format_error_response,
)

from .cors import (
    setup_cors,
    CustomCORSMiddleware,
    DEVELOPMENT_CORS,
    PRODUCTION_CORS,
    PERMISSIVE_CORS,
)

from .logging import (
    LoggingMiddleware,
    setup_logging,
)

from .rate_limiter import (
    RateLimiterMiddleware,
    EndpointRateLimiter,
    STRICT_RATE_LIMIT,
    MODERATE_RATE_LIMIT,
    PERMISSIVE_RATE_LIMIT,
)

__all__ = [
    # Auth
    "AuthMiddleware",
    "get_current_user",
    "get_current_active_user",
    "require_admin",
    "security",
    "get_current_user_from_query",
    # Error Handler
    "ErrorHandlerMiddleware",
    "format_error_response",
    # CORS
    "setup_cors",
    "CustomCORSMiddleware",
    "DEVELOPMENT_CORS",
    "PRODUCTION_CORS",
    "PERMISSIVE_CORS",
    # Logging
    "LoggingMiddleware",
    "setup_logging",
    # Rate Limiter
    "RateLimiterMiddleware",
    "EndpointRateLimiter",
    "STRICT_RATE_LIMIT",
    "MODERATE_RATE_LIMIT",
    "PERMISSIVE_RATE_LIMIT",
]