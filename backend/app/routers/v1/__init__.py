from .auth import router as auth_router
from .accounts import router as accounts_router
from .auctions import router as auctions_router
from .bank import router as bank_router
from .bids import router as bids_router
from .images import router as images_router
from .notifications import router as notifications_router
from .payments import router as payments_router
from .participations import router as participations_router
from .products import router as products_router
from .search import router as search_router
from .payments import router as payments_router
from .sse import router as sse_router
from .status import router as status_router
from .websocker import router as websockets_router

__all__ = [
    "auth_router",
    "accounts_router",
    "auctions_router",
    "bank_router",
    "bids_router",
    "images_router",
    "notifications_router",
    "payments_router",
    "participations_router",
    "products_router",
    "search_router",
    "sse_router",
    "status_router",
    "websockets_router",
]