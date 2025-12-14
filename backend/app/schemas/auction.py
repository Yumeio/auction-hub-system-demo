from pydantic import BaseModel
from typing import Optional, List, TYPE_CHECKING
from datetime import datetime

if TYPE_CHECKING:
    from .product import Product
    from .bid import Bid


class AuctionBase(BaseModel):
    auctionName: str
    productID: int
    startDate: datetime
    endDate: datetime
    priceStep: int


class AuctionCreate(AuctionBase):
    pass


class Auction(AuctionBase):
    auctionID: int
    auctionStatus: Optional[str] = None
    bidWinnerID: Optional[int] = None
    createdAt: datetime
    updatedAt: Optional[datetime] = None

    class Config:
        from_attributes = True


class AuctionUpdate(BaseModel):
    auctionName: Optional[str] = None
    startDate: Optional[datetime] = None
    endDate: Optional[datetime] = None
    priceStep: Optional[int] = None
    auctionStatus: Optional[str] = None
    bidWinnerID: Optional[int] = None


class AuctionDetail(Auction):
    product: Optional["Product"] = None
    bids: List["Bid"] = []
    currentPrice: Optional[int] = None

    class Config:
        from_attributes = True


class AuctionSearch(BaseModel):
    auctionName: Optional[str] = None
    auctionStatus: Optional[str] = None
    productType: Optional[str] = None
    minPriceStep: Optional[int] = None
    maxPriceStep: Optional[int] = None



class AuctionResultUpdate(BaseModel):
    bidWinnerID: int


class ParticipationCreate(BaseModel):
    auction_id: int
    amount: Optional[int] = None



class AuctionParticipation(BaseModel):
    auctionID: int
    userID: int
    depositAmount: Optional[int] = None
    participationStatus: Optional[str] = None
    createdAt: datetime

    class Config:
        from_attributes = True