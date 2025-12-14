import asyncio
from typing import Set, Dict
from fastapi import WebSocket
from sqlalchemy.orm import Session
from datetime import datetime

from .. import schemas
from .notification import create_notification, create_outbid_notification
from .bid import get_bids_by_auction
from .auction import get_auction
from .account import get_account_by_id


# Global connection storage
active_connections: Dict[int, Set[WebSocket]] = {}
connection_lock = asyncio.Lock()


async def add_connection(user_id: int, websocket: WebSocket):
    """Add WebSocket connection for user"""
    async with connection_lock:
        if user_id not in active_connections:
            active_connections[user_id] = set()
        active_connections[user_id].add(websocket)


async def remove_connection(user_id: int, websocket: WebSocket):
    """Remove WebSocket connection for user"""
    async with connection_lock:
        if user_id in active_connections:
            active_connections[user_id].discard(websocket)
            if not active_connections[user_id]:
                del active_connections[user_id]


async def send_to_user(user_id: int, message: dict):
    """Send message to specific user via WebSocket"""
    async with connection_lock:
        connections = active_connections.get(user_id, set())
        disconnected = set()
        
        for websocket in connections:
            try:
                await websocket.send_json(message)
            except:
                disconnected.add(websocket)
        
        # Remove disconnected connections
        for websocket in disconnected:
            connections.discard(websocket)


async def broadcast_to_auction_participants(db: Session, auction_id: int, message: dict):
    """Send message to all participants in an auction"""
    # Get all users who have bid on this auction
    bids = get_bids_by_auction(db, auction_id)
    user_ids = set(bid.userID for bid in bids)
    
    # Send to each participant
    for user_id in user_ids:
        await send_to_user(user_id, message)


async def create_and_send_notification(
    db: Session, 
    notification: schemas.NotificationCreate, 
    websocket_message: dict = None
):
    """Create notification and send via WebSocket"""
    db_notification = create_notification(db, notification)
    if not db_notification:
        return None
    
    # Send via WebSocket if message provided
    if websocket_message:
        await send_to_user(notification.userID, websocket_message)
    
    return db_notification


async def notify_bid_outbid(
    db: Session, 
    auction_id: int, 
    outbid_user_id: int, 
    new_bidder_id: int, 
    new_bid_price: int
):
    """Create and send outbid notification"""
    # Create notification
    notification = create_outbid_notification(
        db, auction_id, outbid_user_id, new_bidder_id, new_bid_price
    )
    
    if notification:
        # Get auction and bidder info for WebSocket message
        auction = get_auction(db, auction_id)
        new_bidder = get_account_by_id(db, new_bidder_id)
        
        websocket_message = {
            "type": "bid_outbid",
            "data": {
                "auction_id": auction_id,
                "auction_name": auction.auctionName if auction else "Auction",
                "new_bid_price": new_bid_price,
                "new_bidder_name": f"{new_bidder.firstName} {new_bidder.lastName}".strip() if new_bidder else "Someone",
                "notification_id": notification.notificationID
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        
        await send_to_user(outbid_user_id, websocket_message)
    
    return notification