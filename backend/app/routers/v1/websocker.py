from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, status
from sqlalchemy.orm import Session
from typing import List, Dict, Optional
import json
import asyncio
from datetime import datetime

from app import repositories
from app.database import get_db, SessionLocal
from app.utils import (
    format_currency,
    format_time_remaining,
    format_time_ago,
    format_datetime
)

router = APIRouter(prefix="/ws", tags=["WebSocket"])

class ConnectionManager:
    def __init__(self):
        # Dictionary mapping auction_id to list of active connections
        self.active_connections: Dict[int, List[WebSocket]] = {}
        # Dictionary mapping websocket to user_id
        self.connection_users: Dict[WebSocket, int] = {}
    
    async def connect(self, websocket: WebSocket, auction_id: int, user_id: int):
        """Accept and register new WebSocket connection"""
        await websocket.accept()
        
        if auction_id not in self.active_connections:
            self.active_connections[auction_id] = []
        
        self.active_connections[auction_id].append(websocket)
        self.connection_users[websocket] = user_id
        
        return len(self.active_connections[auction_id])
    
    def disconnect(self, websocket: WebSocket, auction_id: int):
        """Remove WebSocket connection"""
        if auction_id in self.active_connections:
            if websocket in self.active_connections[auction_id]:
                self.active_connections[auction_id].remove(websocket)
            
            # Clean up empty auction rooms
            if not self.active_connections[auction_id]:
                del self.active_connections[auction_id]
        
        if websocket in self.connection_users:
            del self.connection_users[websocket]
    
    async def send_personal_message(self, message: str, websocket: WebSocket):
        """Send message to specific connection"""
        try:
            await websocket.send_text(message)
        except:
            pass
    
    async def broadcast_to_auction(self, message: str, auction_id: int):
        """Broadcast message to all connections watching an auction"""
        if auction_id in self.active_connections:
            disconnected = []
            for connection in self.active_connections[auction_id]:
                try:
                    await connection.send_text(message)
                except:
                    disconnected.append(connection)
            
            # Clean up disconnected connections
            for connection in disconnected:
                self.disconnect(connection, auction_id)


manager = ConnectionManager()

async def get_formatted_auction_state(auction_id: int, db: Session) -> Optional[dict]:
    """Get current auction state with formatted data"""
    auction = repositories.get_auction(db=db, auction_id=auction_id)
    if not auction:
        return None
    
    # Get current highest bid
    highest_bid = repositories.get_current_highest_bid(db=db, auction_id=auction_id)
    
    # Get all bids
    all_bids = repositories.get_bids_by_auction(db=db, auction_id=auction_id)
    
    # Format data
    state = {
        "type": "auction_state",
        "auction_id": auction.auctionID,
        "auction_name": auction.auctionName,
        "auction_status": auction.auctionStatus,
        "current_price": format_currency(
            highest_bid.bidPrice if highest_bid else auction.startingPrice
        ),
        "current_price_raw": highest_bid.bidPrice if highest_bid else auction.startingPrice,
        "starting_price": format_currency(auction.startingPrice),
        "price_step": format_currency(auction.priceStep),
        "total_bids": len(all_bids),
        "time_remaining": format_time_remaining(auction.endDate),
        "end_date": format_datetime(auction.endDate, "full"),
        "is_active": auction.auctionStatus == "active",
        "timestamp": format_datetime(datetime.utcnow(), "full")
    }
    
    # Add highest bidder info
    if highest_bid:
        bidder = repositories.get_account_by_id(db, highest_bid.userID)
        if bidder:
            state["highest_bidder"] = {
                "user_id": bidder.accountID,
                "username": bidder.username,
                "bid_time": format_time_ago(highest_bid.createdAt),
                "bid_time_full": format_datetime(highest_bid.createdAt, "full")
            }
    
    return state


@router.websocket("/auction/{auction_id}")
async def websocket_auction_endpoint(
    websocket: WebSocket,
    auction_id: int
):
    """
    WebSocket endpoint for real-time auction updates
    
    WS /ws/auction/{auction_id}
    
    Messages sent to client:
    - type: "connected" - Connection established
    - type: "auction_state" - Current auction state
    - type: "new_bid" - New bid placed with formatted data
    - type: "auction_ended" - Auction has ended
    - type: "participant_count" - Number of active viewers
    - type: "error" - Error message
    
    Messages received from client:
    - type: "ping" - Keep connection alive
    - type: "get_state" - Request current auction state
    """
    # For demo, we'll accept connection without auth
    # In production, implement WebSocket auth here
    user_id = 0  # Replace with actual user_id from auth
    
    # Get database session
    db = next(get_db())
    
    try:
        # Verify auction exists
        auction = repositories.get_auction(db=db, auction_id=auction_id)
        if not auction:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        
        # Connect
        participant_count = await manager.connect(websocket, auction_id, user_id)
        
        # Send connection confirmation
        await manager.send_personal_message(
            json.dumps({
                "type": "connected",
                "message": "Connected to auction",
                "auction_id": auction_id,
                "participant_count": participant_count
            }),
            websocket
        )
        
        # Send initial auction state
        initial_state = await get_formatted_auction_state(auction_id, db)
        if initial_state:
            await manager.send_personal_message(
                json.dumps(initial_state),
                websocket
            )
        
        # Notify others about participant count
        await manager.broadcast_to_auction(
            json.dumps({
                "type": "participant_count",
                "count": participant_count
            }),
            auction_id
        )
        
        # Listen for messages
        while True:
            try:
                # Receive message from client
                data = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=30.0  # 30 second timeout
                )
                
                message = json.loads(data)
                message_type = message.get("type")
                
                if message_type == "ping":
                    # Respond to ping
                    await manager.send_personal_message(
                        json.dumps({"type": "pong"}),
                        websocket
                    )
                
                elif message_type == "get_state":
                    # Send current auction state
                    current_state = await get_formatted_auction_state(auction_id, db)
                    if current_state:
                        await manager.send_personal_message(
                            json.dumps(current_state),
                            websocket
                        )
                
            except asyncio.TimeoutError:
                # Send ping to keep connection alive
                await manager.send_personal_message(
                    json.dumps({"type": "ping"}),
                    websocket
                )
            
    except WebSocketDisconnect:
        manager.disconnect(websocket, auction_id)
        # Notify others about participant count
        remaining = len(manager.active_connections.get(auction_id, []))
        await manager.broadcast_to_auction(
            json.dumps({
                "type": "participant_count",
                "count": remaining
            }),
            auction_id
        )
    
    except Exception as e:
        print(f"WebSocket error: {str(e)}")
        manager.disconnect(websocket, auction_id)
    
    finally:
        db.close()


async def broadcast_new_bid(auction_id: int, bid_data: dict):
    """
    Broadcast new bid to all connections watching the auction
    Called from bids.py when a new bid is placed
    """
    message = {
        "type": "new_bid",
        "auction_id": auction_id,
        "bid_price": format_currency(bid_data["bid_price"]),
        "bid_price_raw": bid_data["bid_price"],
        "bidder": bid_data.get("bidder", "Anonymous"),
        "total_bids": bid_data.get("total_bids", 0),
        "time": format_datetime(datetime.utcnow(), "full"),
        "message": f"New bid: {format_currency(bid_data['bid_price'])}"
    }
    
    await manager.broadcast_to_auction(
        json.dumps(message),
        auction_id
    )


async def broadcast_auction_ended(auction_id: int, winner_data: dict):
    """
    Broadcast auction end notification
    Called when auction ends
    """
    message = {
        "type": "auction_ended",
        "auction_id": auction_id,
        "winner_id": winner_data.get("winner_id"),
        "winner_name": winner_data.get("winner_name"),
        "final_price": format_currency(winner_data["final_price"]),
        "final_price_raw": winner_data["final_price"],
        "ended_at": format_datetime(datetime.utcnow(), "full"),
        "message": "Auction has ended"
    }
    
    await manager.broadcast_to_auction(
        json.dumps(message),
        auction_id
    )


@router.websocket("/notifications")
async def websocket_notifications_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time notifications
    
    WS /ws/notifications
    
    Messages sent to client:
    - type: "connected" - Connection established
    - type: "notification" - New notification with formatted data
    - type: "pong" - Response to ping
    """
    # For demo, accept without auth
    # In production, implement WebSocket auth
    user_id = 0  # Replace with actual user_id
    
    await websocket.accept()
    
    try:
        await websocket.send_text(
            json.dumps({
                "type": "connected",
                "message": "Connected to notifications stream"
            })
        )
        
        # Listen for messages
        while True:
            try:
                data = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=30.0
                )
                
                message = json.loads(data)
                if message.get("type") == "ping":
                    await websocket.send_text(
                        json.dumps({"type": "pong"})
                    )
            
            except asyncio.TimeoutError:
                await websocket.send_text(
                    json.dumps({"type": "ping"})
                )
    
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"Notifications WebSocket error: {str(e)}")