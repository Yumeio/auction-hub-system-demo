"""
Search repository
Handles search operations for auctions and products
"""
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import cast, String
from typing import List

from .. import models, schemas


def count_auctions(db: Session, search_params: schemas.AuctionSearch) -> int:
    """
    Count auctions based on search criteria

    Args:
        db: Database session
        search_params: Search parameters (name, status, price range, product type)

    Returns:
        Total count of matching auctions
    """
    query = db.query(models.Auction)

    # Filter by auction name (partial match)
    if search_params.auctionName:
        query = query.filter(models.Auction.auctionName.contains(search_params.auctionName))

    # Filter by auction status
    if search_params.auctionStatus:
        # Handle both string and Enum
        status_val = search_params.auctionStatus
        if hasattr(status_val, 'value'):
            status_val = status_val.value
        
        # Normalize status string
        if isinstance(status_val, str):
            if status_val.lower() in ["pending", "ongoing"]:
                status_val = "ONGOING"
            else:
                status_val = status_val.upper()
            
        # Use cast(String) to force comparison by value, bypassing SQLAlchemy Enum name serialization
        query = query.filter(cast(models.Auction.auctionStatus, String) == status_val)

    # Filter by minimum price step
    if search_params.minPriceStep:
        query = query.filter(models.Auction.priceStep >= search_params.minPriceStep)

    # Filter by maximum price step
    if search_params.maxPriceStep:
        query = query.filter(models.Auction.priceStep <= search_params.maxPriceStep)

    # Filter by product type (requires JOIN with Product table)
    if search_params.productType:
        query = query.join(models.Product).filter(
            models.Product.productType == search_params.productType
        )

    return query.count()


def search_auctions(
    db: Session,
    search_params: schemas.AuctionSearch,
    skip: int = 0,
    limit: int = 20
) -> List[models.Auction]:
    """
    Search auctions based on criteria with eager loading

    Args:
        db: Database session
        search_params: Search parameters (name, status, price range, product type)
        skip: Number of records to skip (for pagination)
        limit: Maximum number of records to return

    Returns:
        List of matching auctions with preloaded product data
    """
    # Use eager loading to prevent N+1 queries
    query = db.query(models.Auction).options(
        joinedload(models.Auction.product)
    )

    # Filter by auction name (partial match)
    if search_params.auctionName:
        query = query.filter(models.Auction.auctionName.contains(search_params.auctionName))

    # Filter by auction status
    if search_params.auctionStatus:
        # Handle both string and Enum
        status_val = search_params.auctionStatus
        if hasattr(status_val, 'value'):
            status_val = status_val.value

        # Normalize status string
        if isinstance(status_val, str):
            if status_val.lower() in ["pending", "ongoing"]:
                status_val = "ONGOING"
            else:
                status_val = status_val.upper()

        # Use cast(String) to force comparison by value, bypassing SQLAlchemy Enum name serialization
        query = query.filter(cast(models.Auction.auctionStatus, String) == status_val)

    # Filter by minimum price step
    if search_params.minPriceStep:
        query = query.filter(models.Auction.priceStep >= search_params.minPriceStep)

    # Filter by maximum price step
    if search_params.maxPriceStep:
        query = query.filter(models.Auction.priceStep <= search_params.maxPriceStep)

    # Filter by product type (requires JOIN with Product table)
    if search_params.productType:
        query = query.join(models.Product).filter(
            models.Product.productType == search_params.productType
        )

    return query.offset(skip).limit(limit).all()
