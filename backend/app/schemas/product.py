from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class ProductBase(BaseModel):
    productName: str
    productDescription: Optional[str] = None
    productType: Optional[str] = None
    imageUrl: Optional[str] = None
    additionalImages: Optional[List[str]] = None


class ProductCreate(ProductBase):
    pass


class Product(ProductBase):
    productID: int
    shippingStatus: Optional[str] = None
    approvalStatus: Optional[str] = None
    rejectionReason: Optional[str] = None
    suggestedByUserID: Optional[int] = None
    createdAt: datetime
    updatedAt: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProductUpdate(BaseModel):
    productName: Optional[str] = None
    productDescription: Optional[str] = None
    productType: Optional[str] = None
    imageUrl: Optional[str] = None
    additionalImages: Optional[List[str]] = None
    shippingStatus: Optional[str] = None
    approvalStatus: Optional[str] = None
    rejectionReason: Optional[str] = None


class ProductRejectRequest(BaseModel):
    rejectionReason: str


class ProductStatusUpdate(BaseModel):
    shippingStatus: str