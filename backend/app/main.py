import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from starlette.responses import JSONResponse

from app.database import engine, BaseEngine
from app.config import settings
from app.models import get_all_models

from app.middlewares import (
    setup_cors,
    LoggingMiddleware,
    setup_logging,
    ErrorHandlerMiddleware,
    RateLimiterMiddleware,
    AuthMiddleware
)
from app.routers.v1 import (
    auth_router,
    accounts_router,
    auctions_router,
    bank_router,
    payments_router,
    bids_router,
    notifications_router,
    participations_router,
    products_router,
    search_router,
    images_router,
    status_router,
    sse_router,
    websockets_router
)

setup_logging(log_level="DEBUG" if settings.DEBUG else "INFO")
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("🚀 Starting up application...")
    models = get_all_models()
    for model in models:
        model.metadata.create_all(bind=engine)
    logger.info("Database tables created successfully")
    yield
    # Shutdown
    logger.info("🛑 Shutting down application...")
    logger.info("✅ Application shutdown complete")

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.API_VERSION,
    description="Auction System API Documentation",
    lifespan=lifespan,
    openapi_url=f"/{settings.API_PREFIX}/openapi.json",
    docs_url=f"/{settings.API_PREFIX}/docs",
    redoc_url=f"/{settings.API_PREFIX}/redoc",
)

app.add_middleware(
    AuthMiddleware,
    secret_key=settings.JWT_SECRET_KEY,
    algorithm=settings.JWT_ALGORITHM,
    public_paths=[
        "/",
        "/health",
        f"/{settings.API_PREFIX}/docs",
        f"/{settings.API_PREFIX}/redoc",
        f"/{settings.API_PREFIX}/openapi.json",
        f"/{settings.API_PREFIX}/auth/login",
        f"/{settings.API_PREFIX}/auth/register",
        f"/{settings.API_PREFIX}/auth/me"
    ]
)
app.add_middleware(RateLimiterMiddleware, requests_per_minute=60)
app.add_middleware(ErrorHandlerMiddleware, debug=settings.DEBUG)
app.add_middleware(LoggingMiddleware, log_request_body=True)
setup_cors(app, allowed_origins=settings.ALLOWED_ORIGINS)

@app.get("/", tags=["Root"])
async def root():
    return {
        "message": "Welcome to Auction System API",
        "version": settings.API_VERSION,
        "docs": "/docs",
        "environment": settings.ENVIRONMENT
    }

@app.get("/health", tags=["Root"])
async def health_check():
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "version": settings.API_VERSION
    }

logger.info("📦 Loading routers...")
app.include_router(auth_router, prefix=f"/{settings.API_PREFIX}", tags=["Authentication"])
app.include_router(accounts_router, prefix=f"/{settings.API_PREFIX}", tags=["Accounts"])
app.include_router(auctions_router, prefix=f"/{settings.API_PREFIX}", tags=["Auctions"])
app.include_router(bank_router, prefix=f"/{settings.API_PREFIX}", tags=["Bank"])
app.include_router(payments_router, prefix=f"/{settings.API_PREFIX}", tags=["Payments"])
app.include_router(bids_router, prefix=f"/{settings.API_PREFIX}", tags=["Bids"])
app.include_router(notifications_router, prefix=f"/{settings.API_PREFIX}", tags=["Notifications"])
app.include_router(participations_router, prefix=f"/{settings.API_PREFIX}", tags=["Participation"])
app.include_router(products_router, prefix=f"/{settings.API_PREFIX}", tags=["Products"])
app.include_router(search_router, prefix=f"/{settings.API_PREFIX}", tags=["Search"])
app.include_router(images_router, prefix=f"/{settings.API_PREFIX}", tags=["Images"])
app.include_router(status_router, prefix=f"/{settings.API_PREFIX}", tags=["Status"])
app.include_router(sse_router, prefix=f"/{settings.API_PREFIX}", tags=["SSE"])
app.include_router(websockets_router, prefix=f"/{settings.API_PREFIX}", tags=["WebSockets"])
logger.info("✅ All routers loaded successfully")

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """
    Global exception handler for unhandled errors
    """
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "Internal server error",
            "detail": str(exc) if app.debug else "An unexpected error occurred"
        }
    )