from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class WebSocketMessage(BaseModel):
    type: str
    data: dict
    timestamp: datetime = datetime.utcnow()


class BidUpdateMessage(BaseModel):
    auctionID: int
    highestBidID: int
    highestBidPrice: int
    newBidderID: int
    bidderName: str
    bidCount: int


class AuctionStatusMessage(BaseModel):
    auctionID: int
    status: str
    winnerID: Optional[int] = None
    finalPrice: Optional[int] = None