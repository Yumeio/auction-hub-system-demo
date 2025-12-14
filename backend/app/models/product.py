"""
Product model - Products to be auctioned
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum as SqlEnum
from sqlalchemy.orm import relationship, Mapped, mapped_column
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
import json

from ..database import BaseEngine
from .enums import ProductApprovalStatus

if TYPE_CHECKING:
    from .auction import Auction
    from .account import Account


class Product(BaseEngine):
    """
    Product model representing items to be auctioned.
    
    Attributes:
        productID: Primary key
        productName: Name of the product
        productDescription: Detailed description
        productType: Category/type of product
        imageUrl: Main product image URL
        additionalImages: JSON array of additional image URLs
        shippingStatus: Shipping/delivery status
        approvalStatus: Admin approval status
        rejectionReason: Reason if rejected
        suggestedByUserID: Foreign key to Account
        createdAt: Creation timestamp
        updatedAt: Last update timestamp
    """
    __tablename__ = "product"

    productID: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    productName: Mapped[str] = mapped_column(String(256), nullable=False)
    productDescription: Mapped[Optional[str]] = mapped_column(String(1024))
    productType: Mapped[Optional[str]] = mapped_column(String(100))
    
    # Image fields - essential for auction system
    imageUrl: Mapped[Optional[str]] = mapped_column(String(512))  # Main product image
    additionalImages: Mapped[Optional[str]] = mapped_column(String(2048))  # JSON array of additional image URLs
    
    shippingStatus: Mapped[Optional[str]] = mapped_column(String(100))
    approvalStatus: Mapped[ProductApprovalStatus] = mapped_column(
        SqlEnum(ProductApprovalStatus),
        nullable=False,
        default=ProductApprovalStatus.PENDING.value
    )
    rejectionReason: Mapped[Optional[str]] = mapped_column(String(1024))
    suggestedByUserID: Mapped[Optional[int]] = mapped_column(
        ForeignKey("account.accountID"),
        index=True
    )
    createdAt: Mapped[datetime] = mapped_column(
        DateTime, 
        nullable=False,
        default=datetime.utcnow
    )
    updatedAt: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Relationships
    auctions: Mapped[List["Auction"]] = relationship(back_populates="product")
    suggestedBy: Mapped[Optional["Account"]] = relationship(
        back_populates="submittedProducts", 
        foreign_keys=[suggestedByUserID]
    )

    def __repr__(self):
        return f"<Product(id={self.productID}, name='{self.productName}', status='{self.approvalStatus}')>"

    @property
    def is_approved(self) -> bool:
        """Check if product is approved"""
        return self.approvalStatus == ProductApprovalStatus.APPROVED.value

    @property
    def is_pending(self) -> bool:
        """Check if product is pending approval"""
        return self.approvalStatus == ProductApprovalStatus.PENDING.value

    @property
    def is_rejected(self) -> bool:
        """Check if product is rejected"""
        return self.approvalStatus == ProductApprovalStatus.REJECTED.value

    def get_additional_images(self) -> List[str]:
        """
        Parse and return additional images as a list
        
        Returns:
            List of image URLs
        """
        if not self.additionalImages:
            return []
        try:
            return json.loads(self.additionalImages)
        except (json.JSONDecodeError, TypeError):
            return []

    def set_additional_images(self, images: List[str]) -> None:
        """
        Set additional images from a list
        
        Args:
            images: List of image URLs
        """
        self.additionalImages = json.dumps(images) if images else None

    @property
    def all_images(self) -> List[str]:
        """Get all product images (main + additional)"""
        images = []
        if self.imageUrl:
            images.append(self.imageUrl)
        images.extend(self.get_additional_images())
        return images