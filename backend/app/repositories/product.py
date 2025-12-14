from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
import json

from .. import models, schemas
from ..models import ProductApprovalStatus


def get_product(db: Session, product_id: int) -> Optional[models.Product]:
    """Get product by ID"""
    return db.query(models.Product).filter(models.Product.productID == product_id).first()


def get_products(db: Session, skip: int = 0, limit: int = 100) -> List[models.Product]:
    """Get all products with pagination"""
    return db.query(models.Product).offset(skip).limit(limit).all()


def create_product(db: Session, product: schemas.ProductCreate, user_id: Optional[int] = None) -> models.Product:
    """Create new product"""
    # Handle additionalImages list - convert to JSON string for database storage
    additional_images_json = None
    if product.additionalImages:
        additional_images_json = json.dumps(product.additionalImages)
    
    print()
    db_product = models.Product(
        productName=product.productName,
        productDescription=product.productDescription,
        productType=product.productType,
        imageUrl=product.imageUrl,
        additionalImages=additional_images_json,
        shippingStatus=None,
        approvalStatus=ProductApprovalStatus.PENDING,
        rejectionReason=None,
        suggestedByUserID=user_id,
        createdAt=datetime.utcnow(),
        updatedAt=None
    )
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product


def update_product(db: Session, product_id: int, product_update: schemas.ProductUpdate) -> Optional[models.Product]:
    """Update product information"""
    db_product = get_product(db, product_id)
    if not db_product:
        return None
    
    update_data = product_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_product, field, value)
    
    db_product.updatedAt = datetime.utcnow()
    db.commit()
    db.refresh(db_product)
    return db_product


def delete_product(db: Session, product_id: int) -> bool:
    """Delete product"""
    db_product = get_product(db, product_id)
    if not db_product:
        return False
    
    db.delete(db_product)
    db.commit()
    return True