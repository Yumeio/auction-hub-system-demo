"""
Search and filtering endpoints (UC10 - Search auction information)
Refactored to use middleware and utils packages
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime
from typing import Optional
import traceback

from app import repositories, schemas, models
from app.database import SessionLocal, get_db
from app.middlewares import get_current_active_user
from app.utils import (
    format_currency,
    format_datetime,
    format_time_remaining,
    format_pagination_response,
    sanitize_string,
    get_full_image_url
)

router = APIRouter(prefix="/search", tags=["Search"])


def format_auction_for_search(auction: models.Auction, current_bid, total_bids: int = 0) -> dict:
    """Helper function to format auction data for search responses"""
    return {
        "auctionID": auction.auctionID,
        "auctionName": auction.auctionName,
        "auctionStatus": auction.auctionStatus,
        "productID": auction.productID,
        "startDate": auction.startDate.isoformat() if auction.startDate else None,
        "endDate": auction.endDate.isoformat() if auction.endDate else None,
        "priceStep": auction.priceStep,
        "bidWinnerID": auction.bidWinnerID,
        "createdAt": auction.createdAt.isoformat() if auction.createdAt else None,
        "updatedAt": auction.updatedAt.isoformat() if auction.updatedAt else None,
        "productName": auction.product.productName if auction.product else None,
        "productType": auction.product.productType if auction.product else None,
        "productImage": get_full_image_url(auction.product.imageUrl) if auction.product else None,
        "highestBidPrice": current_bid.bidPrice if current_bid else None,
        "totalBids": total_bids,
        "timeRemaining": (auction.endDate - datetime.now()).total_seconds() if auction.endDate and auction.endDate > datetime.now() else 0,
    }


@router.post("/auctions", response_model=dict)
def search_auctions(
    search_params: schemas.AuctionSearch,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Search auctions based on criteria (UC10)

    POST /search/auctions?skip=0&limit=100
    Headers: Authorization: Bearer <access_token>
    Body: {
        "auction_name": "figure",
        "auction_status": "pending",
        "product_type": "static",
        "min_price_step": 10000,
        "max_price_step": 100000
    }
    Returns: Paginated list of matching auctions with formatted data
    """
    try:
        # Get total count using repository
        total = repositories.count_auctions(db=db, search_params=search_params)

        # Search auctions with proper pagination
        auctions = repositories.search_auctions(
            db=db,
            search_params=search_params,
            skip=skip,
            limit=limit
        )

        # Format auctions
        formatted_auctions = []
        for auction in auctions:
            current_bid = repositories.get_current_highest_bid(db, auction.auctionID)
            total_bids = len(repositories.get_bids_by_auction(db, auction.auctionID))

            formatted_auctions.append(format_auction_for_search(auction, current_bid, total_bids))

        return format_pagination_response(
            items=formatted_auctions,
            page=(skip // limit) + 1 if limit > 0 else 1,
            page_size=limit,
            total_items=total
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid parameters: {str(e)}"
        )
    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred"
        )
    except Exception as e:
        print(f"Error in search_auctions: {str(e)}")
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unexpected error occurred"
        )


@router.get("/auctions", response_model=dict)
def search_auctions_by_query(
    auction_name: Optional[str] = Query(None),
    auction_status: Optional[str] = Query(None),
    product_type: Optional[str] = Query(None),
    min_price_step: Optional[int] = Query(None, ge=0),
    max_price_step: Optional[int] = Query(None, ge=0),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """
    Search auctions using query parameters (UC10)
    Public endpoint - no authentication required

    GET /search/auctions?auction_name=figure&auction_status=pending&product_type=static&skip=0&limit=100
    Returns: Paginated list of matching auctions with formatted data
    """
    try:
        # Sanitize search term
        if auction_name:
            auction_name = sanitize_string(auction_name, max_length=200)

        # Build search parameters
        search_params = schemas.AuctionSearch(
            auctionName=auction_name,
            auctionStatus=auction_status,
            productType=product_type,
            minPriceStep=min_price_step,
            maxPriceStep=max_price_step
        )

        # Get total count using repository
        total = repositories.count_auctions(db=db, search_params=search_params)

        # Search auctions with proper pagination
        auctions = repositories.search_auctions(
            db=db,
            search_params=search_params,
            skip=skip,
            limit=limit
        )

        # Format auctions
        formatted_auctions = []
        for auction in auctions:
            current_bid = repositories.get_current_highest_bid(db, auction.auctionID)
            total_bids = len(repositories.get_bids_by_auction(db, auction.auctionID))

            formatted_auctions.append({
                "auctionID": auction.auctionID,
                "auctionName": auction.auctionName,
                "productID": auction.productID,
                "startDate": auction.startDate.isoformat() if auction.startDate else None,
                "endDate": auction.endDate.isoformat() if auction.endDate else None,
                "priceStep": auction.priceStep,
                "auctionStatus": auction.auctionStatus,
                "bidWinnerID": auction.bidWinnerID,
                "createdAt": auction.createdAt.isoformat() if auction.createdAt else None,
                "updatedAt": auction.updatedAt.isoformat() if auction.updatedAt else None,
                "productName": auction.product.productName if auction.product else None,
                "productType": auction.product.productType if auction.product else None,
                "productType": auction.product.productType if auction.product else None,
                "productImage": get_full_image_url(auction.product.imageUrl) if auction.product else None,
                "highestBidPrice": current_bid.bidPrice if current_bid else None,
                "totalBids": total_bids,
                "timeRemaining": None  # Will be calculated on frontend
            })

        # Return in SearchAuctionsResponse format
        return {
            "total": total,
            "skip": skip,
            "limit": limit,
            "items": formatted_auctions,
            "filters_applied": {
                "auctionName": auction_name,
                "auctionStatus": auction_status,
                "productType": product_type,
                "minPriceStep": min_price_step,
                "maxPriceStep": max_price_step
            }
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid parameters: {str(e)}"
        )
    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred"
        )
    except Exception as e:
        print(f"Error in search_auctions_by_query: {str(e)}")
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unexpected error occurred"
        )


@router.get("/auctions/status/{auction_status}", response_model=dict)
def get_auctions_by_status(
    auction_status: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """
    Get auctions by status
    Public endpoint - no authentication required

    GET /search/auctions/status/pending?skip=0&limit=100
    Returns: Paginated list of auctions with specified status
    """
    try:
        # Sanitize status
        auction_status = sanitize_string(auction_status, max_length=50)

        search_params = schemas.AuctionSearch(auctionStatus=auction_status)

        # Get total count using repository
        total = repositories.count_auctions(db=db, search_params=search_params)

        # Search auctions with proper pagination
        auctions = repositories.search_auctions(
            db=db,
            search_params=search_params,
            skip=skip,
            limit=limit
        )

        # Format auctions
        formatted_auctions = []
        for auction in auctions:
            current_bid = repositories.get_current_highest_bid(db, auction.auctionID)

            formatted_auctions.append({
                "auction_id": auction.auctionID,
                "auction_name": auction.auctionName,
                "auction_status": auction.auctionStatus,
                "current_price": format_currency(current_bid.bidPrice) if current_bid else "No bids yet",
                "time_remaining": format_time_remaining(auction.endDate),
                "product_name": auction.product.productName if auction.product else None
            })

        return format_pagination_response(
            items=formatted_auctions,
            page=(skip // limit) + 1 if limit > 0 else 1,
            page_size=limit,
            total_items=total
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid parameters: {str(e)}"
        )
    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred"
        )
    except Exception as e:
        print(f"Error in get_auctions_by_status: {str(e)}")
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unexpected error occurred"
        )


@router.get("/products/type/{product_type}", response_model=dict)
def get_products_by_type(
    product_type: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """
    Get products by type
    Public endpoint - no authentication required

    GET /search/products/type/static?skip=0&limit=100
    Returns: Paginated list of products with specified type
    """
    # Sanitize product type
    product_type = sanitize_string(product_type, max_length=100)
    
    all_products = repositories.get_products(db=db, skip=0, limit=10000)
    filtered_products = [p for p in all_products if p.productType == product_type]
    
    total = len(filtered_products)
    paginated_products = filtered_products[skip:skip+limit]
    
    # Format products
    formatted_products = []
    for product in paginated_products:
        formatted_products.append({
            "product_id": product.productID,
            "product_name": product.productName,
            "product_type": product.productType,
            "product_description": product.productDescription,
            "approval_status": product.approvalStatus,
            "image_url": get_full_image_url(product.imageUrl),
            "created_at": format_datetime(product.createdAt, "full")
        })
    
    return format_pagination_response(
        items=formatted_products,
        page=(skip // limit) + 1 if limit > 0 else 1,
        page_size=limit,
        total_items=total
    )


@router.get("/auctions/price-range", response_model=dict)
def get_auctions_by_price_range(
    min_price: int = Query(..., ge=0),
    max_price: int = Query(..., ge=0),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """
    Get auctions within price range
    Public endpoint - no authentication required

    GET /search/auctions/price-range?min_price=10000&max_price=100000&skip=0&limit=100
    Returns: Paginated list of auctions within price range
    """
    try:
        if min_price > max_price:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Minimum price cannot be greater than maximum price"
            )

        search_params = schemas.AuctionSearch(
            minPriceStep=min_price,
            maxPriceStep=max_price
        )

        # Get total count using repository
        total = repositories.count_auctions(db=db, search_params=search_params)

        # Search auctions with proper pagination
        auctions = repositories.search_auctions(
            db=db,
            search_params=search_params,
            skip=skip,
            limit=limit
        )

        # Format auctions
        formatted_auctions = []
        for auction in auctions:
            current_bid = repositories.get_current_highest_bid(db, auction.auctionID)

            formatted_auctions.append({
                "auction_id": auction.auctionID,
                "auction_name": auction.auctionName,
                "price_step": format_currency(auction.priceStep),
                "price_step_raw": auction.priceStep,
                "current_price": format_currency(current_bid.bidPrice) if current_bid else "No bids yet",
                "time_remaining": format_time_remaining(auction.endDate),
                "product_name": auction.product.productName if auction.product else None
            })

        return format_pagination_response(
            items=formatted_auctions,
            page=(skip // limit) + 1 if limit > 0 else 1,
            page_size=limit,
            total_items=total
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid parameters: {str(e)}"
        )
    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred"
        )
    except Exception as e:
        print(f"Error in get_auctions_by_price_range: {str(e)}")
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unexpected error occurred"
        )


@router.get("/auctions/active", response_model=dict)
def get_active_auctions(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """
    Get all active auctions (status = pending)
    Public endpoint - no authentication required

    GET /search/auctions/active?skip=0&limit=100
    Returns: Paginated list of active auctions with formatted data
    """
    try:
        # Use "pending" as the correct auction status for active auctions
        search_params = schemas.AuctionSearch(auctionStatus="pending")

        # Get total count using repository
        total = repositories.count_auctions(db=db, search_params=search_params)

        # Search auctions with proper pagination
        auctions = repositories.search_auctions(
            db=db,
            search_params=search_params,
            skip=skip,
            limit=limit
        )

        # Format auctions
        formatted_auctions = []
        for auction in auctions:
            current_bid = repositories.get_current_highest_bid(db, auction.auctionID)
            total_bids = len(repositories.get_bids_by_auction(db, auction.auctionID))

            formatted_auctions.append({
                "auction_id": auction.auctionID,
                "auction_name": auction.auctionName,
                "current_price": format_currency(current_bid.bidPrice) if current_bid else "No bids yet",
                "current_price_raw": current_bid.bidPrice if current_bid else 0,
                "total_bids": total_bids,
                "time_remaining": format_time_remaining(auction.endDate),
                "end_date": format_datetime(auction.endDate, "full"),
                "product_name": auction.product.productName if auction.product else None,
                "product_name": auction.product.productName if auction.product else None,
                "image_url": get_full_image_url(auction.product.imageUrl) if auction.product else None
            })

        return format_pagination_response(
            items=formatted_auctions,
            page=(skip // limit) + 1 if limit > 0 else 1,
            page_size=limit,
            total_items=total
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid parameters: {str(e)}"
        )
    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred"
        )
    except Exception as e:
        print(f"Error in get_active_auctions: {str(e)}")
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unexpected error occurred"
        )