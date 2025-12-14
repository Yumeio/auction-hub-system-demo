"""
Server-Sent Events (SSE) endpoint for real-time auction updates
Refactored to use middleware and utils packages
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sse_starlette.sse import EventSourceResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import func
import asyncio
import json
from datetime import datetime

from app import repositories, models
from app.database import SessionLocal, get_db
from app.middlewares import get_current_user_from_query
from app.utils import (
    format_currency,
    format_time_remaining,
    format_time_ago,
    format_datetime
)

router = APIRouter(prefix="/sse", tags=["Real-time Updates"])

async def auction_event_generator(auction_id: int):
    """
    Generate real-time auction events with formatted data

    Yields formatted auction updates every 2 seconds with heartbeat
    Fixed: Database session management, NoneType crashes, error handling
    """
    last_data = None
    heartbeat_counter = 0

    try:
        while True:
            db = SessionLocal()  # New session each iteration
            try:
                # Get auction data with eager loading
                auction = db.query(models.Auction)\
                    .options(joinedload(models.Auction.product))\
                    .filter(models.Auction.auctionID == auction_id)\
                    .first()

                # Trigger status check/update
                if auction:
                    repositories.check_and_update_status(db, auction)

                if not auction:
                    yield {
                        "event": "error",
                        "data": json.dumps({"error": "Auction not found"})
                    }
                    break

                # Get current highest bid
                highest_bid = repositories.get_current_highest_bid(db=db, auction_id=auction_id)

                # Get total bids count
                total_bids = db.query(func.count(models.Bid.bidID))\
                    .filter(models.Bid.auctionID == auction_id)\
                    .scalar() or 0

                # Format auction data
                auction_data = {
                    "auction_id": auction.auctionID,
                    "auction_name": auction.auctionName,
                    "auction_status": auction.auctionStatus,
                    "current_price": format_currency(highest_bid.bidPrice) if highest_bid else "No bids yet",
                    "current_price_raw": highest_bid.bidPrice if highest_bid else 0,
                    "price_step": format_currency(auction.priceStep),
                    "total_bids": total_bids,
                    "time_remaining": format_time_remaining(auction.endDate),
                    "end_date": format_datetime(auction.endDate, "full"),
                    "has_bids": total_bids > 0,
                    "is_active": auction.auctionStatus == models.AuctionStatus.ONGOING
                }

                # Add highest bidder info if exists
                if highest_bid:
                    bidder = repositories.get_account_by_id(db, highest_bid.userID)
                    if bidder:
                        auction_data["highest_bidder"] = {
                            "username": bidder.username,
                            "bid_time": format_time_ago(highest_bid.createdAt)
                        }

                # Only send update if data changed OR heartbeat needed
                if auction_data != last_data:
                    yield {
                        "event": "auction_update",
                        "data": json.dumps(auction_data)
                    }
                    last_data = auction_data
                    heartbeat_counter = 0
                else:
                    heartbeat_counter += 1
                    # Send heartbeat every 30 seconds (15 iterations * 2s)
                    if heartbeat_counter >= 15:
                        yield {
                            "event": "heartbeat",
                            "data": json.dumps({"timestamp": datetime.utcnow().isoformat()})
                        }
                        heartbeat_counter = 0

            except SQLAlchemyError as e:
                print(f"Database error in SSE: {str(e)}")
                yield {
                    "event": "error",
                    "data": json.dumps({"error": "Database error"})
                }
            except Exception as e:
                print(f"Unexpected error in SSE: {str(e)}")
                yield {
                    "event": "error",
                    "data": json.dumps({"error": "Unexpected error"})
                }
            finally:
                db.close()  # Always close session

            # Wait before next update
            await asyncio.sleep(2)

    except asyncio.CancelledError:
        # Client disconnected - normal cleanup
        pass


@router.get("/auction/{auction_id}")
async def stream_auction_updates(
    auction_id: int,
    current_user=Depends(get_current_user_from_query),
    db: Session = Depends(get_db)
):
    """
    Stream real-time auction updates via SSE

    GET /sse/auction/{auction_id}
    Headers: Authorization: Bearer <access_token>
    Returns: Server-Sent Events stream with formatted auction data

    Event types:
    - auction_update: Regular auction state updates (every 2s)
    - heartbeat: Keepalive signal (every 30s if no data change)
    - error: Error messages

    Fixed: Database session leaks, NoneType crashes, proper error handling
    """
    # Verify auction exists before starting stream
    auction = repositories.get_auction(db=db, auction_id=auction_id)
    if not auction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Auction not found"
        )

    return EventSourceResponse(auction_event_generator(auction_id))


async def all_auctions_event_generator():
    """
    Generate real-time updates for all active auctions

    Yields formatted updates for all active auctions every 5 seconds
    Fixed: Database session management, N+1 queries, batch processing
    """
    last_data = None
    heartbeat_counter = 0

    try:
        while True:
            db = SessionLocal()  # New session each iteration
            try:
                # Get all potentially active auctions (pending + scheduled)
                # We need scheduled ones to trigger their activation
                potential_auctions = db.query(models.Auction)\
                    .options(joinedload(models.Auction.product))\
                    .filter(models.Auction.auctionStatus.in_([
                        models.AuctionStatus.ONGOING, 
                        models.AuctionStatus.SCHEDULED
                    ]))\
                    .all()
                
                # Check and update status for all of them
                # Filter to keep only active ones (ONGOING)
                auctions = []
                for auction in potential_auctions:
                    repositories.check_and_update_status(db, auction)
                    if auction.auctionStatus == models.AuctionStatus.ONGOING:
                        auctions.append(auction)
                
                # Sort/Limit if needed (optional, but good for safety)
                auctions = auctions[:20]

                auction_ids = [a.auctionID for a in auctions]

                # Batch query for highest bids (FIX N+1)
                highest_bids_query = db.query(
                    models.Bid.auctionID,
                    func.max(models.Bid.bidPrice).label('max_price')
                ).filter(
                    models.Bid.auctionID.in_(auction_ids)
                ).group_by(models.Bid.auctionID).all()

                bid_map = {b.auctionID: b.max_price for b in highest_bids_query}

                # Batch query for bid counts (FIX N+1)
                bid_counts = db.query(
                    models.Bid.auctionID,
                    func.count(models.Bid.bidID).label('count')
                ).filter(
                    models.Bid.auctionID.in_(auction_ids)
                ).group_by(models.Bid.auctionID).all()

                count_map = {b.auctionID: b.count for b in bid_counts}

                # Format auction data without additional queries
                auctions_data = []
                for auction in auctions:
                    max_bid = bid_map.get(auction.auctionID, 0)
                    total_bids = count_map.get(auction.auctionID, 0)

                    auctions_data.append({
                        "auction_id": auction.auctionID,
                        "auction_name": auction.auctionName,
                        "current_price": format_currency(max_bid) if max_bid > 0 else "No bids yet",
                        "current_price_raw": max_bid,
                        "total_bids": total_bids,
                        "time_remaining": format_time_remaining(auction.endDate),
                        "product_name": auction.product.productName if auction.product else None
                    })

                response_data = {
                    "auctions": auctions_data,
                    "total_active": len(auctions),
                    "timestamp": datetime.utcnow().isoformat()
                }

                # Only send if changed OR heartbeat needed
                if response_data != last_data:
                    yield {
                        "event": "auctions_update",
                        "data": json.dumps(response_data)
                    }
                    last_data = response_data
                    heartbeat_counter = 0
                else:
                    heartbeat_counter += 1
                    # Send heartbeat every 25 seconds (5 iterations * 5s)
                    if heartbeat_counter >= 5:
                        yield {
                            "event": "heartbeat",
                            "data": json.dumps({"timestamp": datetime.utcnow().isoformat()})
                        }
                        heartbeat_counter = 0

            except SQLAlchemyError as e:
                print(f"Database error in all_auctions SSE: {str(e)}")
                yield {
                    "event": "error",
                    "data": json.dumps({"error": "Database error"})
                }
            except Exception as e:
                print(f"Unexpected error in all_auctions SSE: {str(e)}")
                yield {
                    "event": "error",
                    "data": json.dumps({"error": "Unexpected error"})
                }
            finally:
                db.close()  # Always close session

            # Wait before next update
            await asyncio.sleep(5)

    except asyncio.CancelledError:
        # Client disconnected - normal cleanup
        pass


@router.get("/auctions/active")
async def stream_active_auctions(
    current_user=Depends(get_current_user_from_query)
):
    """
    Stream real-time updates for all active auctions via SSE

    GET /sse/auctions/active
    Headers: Authorization: Bearer <access_token>
    Returns: Server-Sent Events stream with formatted data for all active auctions

    Updates every 5 seconds with current state of all active auctions
    Fixed: Database session leaks, N+1 queries, batch processing
    """
    return EventSourceResponse(all_auctions_event_generator())


async def user_notifications_generator(user_id: int):
    """
    Generate real-time notifications for a specific user

    Yields formatted notification updates every 3 seconds
    Fixed: Database session management, proper cleanup, heartbeat
    """
    last_notification_id = 0
    heartbeat_counter = 0

    try:
        while True:
            db = SessionLocal()  # New session each iteration
            try:
                # Get all notifications ordered by ID
                notifications = db.query(models.Notification)\
                    .filter(models.Notification.userID == user_id)\
                    .order_by(models.Notification.notificationID.desc())\
                    .limit(50)\
                    .all()

                # Send all notifications (frontend will filter read/unread)
                formatted_notifications = []
                for notif in notifications:
                    # Eager load auction if needed
                    auction = None
                    if notif.auctionID:
                        auction = db.query(models.Auction)\
                            .filter(models.Auction.auctionID == notif.auctionID)\
                            .first()

                    formatted_notifications.append({
                        "notification_id": notif.notificationID,
                        "title": notif.title,
                        "message": notif.message,
                        "type": notif.notificationType,
                        "is_read": notif.isRead,
                        "read": notif.isRead,  # Alias for frontend compatibility
                        "auction_id": notif.auctionID,
                        "auction_name": auction.auctionName if auction else None,
                        "time_ago": format_time_ago(notif.createdAt),
                        "created_at": format_datetime(notif.createdAt, "full")
                    })

                # Always send array directly (fix type mismatch)
                yield {
                    "event": "message",  # Changed from "new_notifications"
                    "data": json.dumps(formatted_notifications)
                }

                # Update last seen
                if notifications:
                    last_notification_id = max(n.notificationID for n in notifications)

                heartbeat_counter += 1
                # Send heartbeat every 30 seconds (10 iterations * 3s)
                if heartbeat_counter >= 10:
                    yield {
                        "event": "heartbeat",
                        "data": json.dumps({"timestamp": datetime.utcnow().isoformat()})
                    }
                    heartbeat_counter = 0

            except SQLAlchemyError as e:
                print(f"Database error in notifications SSE: {str(e)}")
                yield {
                    "event": "error",
                    "data": json.dumps({"error": "Database error"})
                }
            except Exception as e:
                print(f"Unexpected error in notifications SSE: {str(e)}")
                yield {
                    "event": "error",
                    "data": json.dumps({"error": "Unexpected error"})
                }
            finally:
                db.close()  # Always close session

            # Wait before next check
            await asyncio.sleep(3)

    except asyncio.CancelledError:
        # Client disconnected - normal cleanup
        pass


@router.get("/notifications")
async def stream_user_notifications(
    current_user=Depends(get_current_user_from_query)
):
    """
    Stream real-time notifications for current user via SSE

    GET /sse/notifications
    Headers: Authorization: Bearer <access_token>
    Returns: Server-Sent Events stream with formatted user notifications

    Sends all notifications every 3 seconds
    Fixed: Database session leaks, type mismatch, proper cleanup
    """
    return EventSourceResponse(
        user_notifications_generator(current_user.accountID)
    )
