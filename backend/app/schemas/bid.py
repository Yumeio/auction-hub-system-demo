from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class BidBase(BaseModel):
    auctionID: int
    bidPrice: int


class BidCreate(BidBase):
    pass


class Bid(BidBase):
    bidID: int
    userID: int
    bidStatus: Optional[str] = None
    createdAt: datetime

    class Config:
        from_attributes = True