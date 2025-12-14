"""
Product management endpoints (UC09 - Register product, UC13 - Approve product)
Refactored to use middleware and utils packages
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional, List
import json

from app import repositories, schemas
from app.database import SessionLocal, get_db
from app.middlewares import get_current_active_user, require_admin
from app.utils import (
    validate_image_file,
    sanitize_string,
    format_datetime,
    format_file_size,
    format_pagination_response
)

router = APIRouter(prefix="/products", tags=["Products"])


@router.post("/register", response_model=dict)
def register_product(
    product: schemas.ProductCreate,
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Register product for auction (UC09)
    
    POST /products/register
    Headers: Authorization: Bearer <access_token>
    Body: { "product_name": "Figure Name", "product_description": "...", "product_type": "..." }
    Returns: Created product information
    """
    # Sanitize inputs
    product_name = sanitize_string(product.productName, max_length=200)
    product_description = sanitize_string(product.productDescription, max_length=2000)
    product_type = sanitize_string(product.productType, max_length=100)
    
    # Create sanitized product (include optional image fields if provided)
    sanitized_product = schemas.ProductCreate(
        productName=product_name,
        productDescription=product_description,
        productType=product_type,
        imageUrl=product.imageUrl,
        additionalImages=product.additionalImages
    )
    
    # Create product
    db_product = repositories.create_product(
        db=db, 
        product=sanitized_product, 
        user_id=current_user.accountID
    )
    
    # Parse additional_images JSON string back to list
    additional_images_list = None
    if db_product.additionalImages:
        try:
            additional_images_list = json.loads(db_product.additionalImages)
        except:
            additional_images_list = None
    
    return {
        "success": True,
        "message": "Product registered successfully. Awaiting admin approval.",
        "data": {
            "product_id": db_product.productID,
            "product_name": db_product.productName,
            "product_description": db_product.productDescription,
            "product_type": db_product.productType,
            "image_url": db_product.imageUrl,
            "additional_images": additional_images_list,
            "shipping_status": db_product.shippingStatus,
            "approval_status": db_product.approvalStatus,
            "rejection_reason": db_product.rejectionReason,
            "suggested_by_user_id": db_product.suggestedByUserID,
            "created_at": format_datetime(db_product.createdAt, "full"),
            "updated_at": format_datetime(db_product.updatedAt, "full") if db_product.updatedAt else None
        }
    }


@router.post("/register-with-images", response_model=dict)
async def register_product_with_images(
    product_name: str = Form(...),
    product_description: str = Form(...),
    product_type: str = Form(...),
    main_image: Optional[UploadFile] = File(None),
    additional_images: Optional[List[UploadFile]] = File(None),
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Register product for auction with image uploads (UC09)
    
    POST /products/register-with-images
    Headers: Authorization: Bearer <access_token>
    Form Data:
    - product_name: Product name
    - product_description: Product description  
    - product_type: Product type
    - main_image: Main product image (optional)
    - additional_images: Additional product images (max 4, optional)
    
    Returns: Created product information with local image paths
    """
    # Sanitize inputs
    product_name = sanitize_string(product_name, max_length=200)
    product_description = sanitize_string(product_description, max_length=2000)
    product_type = sanitize_string(product_type, max_length=100)
    
    # Create product without images first
    product_data = schemas.ProductCreate(
        productName=product_name,
        productDescription=product_description,
        productType=product_type
    )
    
    db_product = repositories.create_product(db=db, product=product_data, user_id=current_user.accountID)
    
    # Process main image
    main_image_path = None
    main_image_size = None
    if main_image:
        file_content = await main_image.read()
        
        # Validate main image using utils
        is_valid, error_message = validate_image_file(
            file_content, 
            filename=main_image.filename,
            max_size_mb=5
        )
        
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Main image error: {error_message}"
            )
        
        try:
            from app.utils import save_image
            main_image_path = save_image(file_content, str(main_image.filename), db_product.productID)
            main_image_size = format_file_size(len(file_content))
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to save main image: {str(e)}"
            )
    
    # Process additional images
    additional_images_paths = []
    additional_images_info = []
    
    if additional_images:
        for i, image in enumerate(additional_images[:4]):  # Max 5 additional images
            try:
                file_content = await image.read()
                
                # Validate image using utils
                is_valid, error_message = validate_image_file(
                    file_content,
                    filename=image.filename,
                    max_size_mb=5
                )
                
                if not is_valid:
                    continue  # Skip invalid images
                
                from app.utils import save_image
                image_path = save_image(file_content, str(image.filename), db_product.productID)
                additional_images_paths.append(image_path)
                additional_images_info.append({
                    "path": image_path,
                    "size": format_file_size(len(file_content)),
                    "filename": image.filename
                })
                
            except Exception as e:
                print(f"Failed to save additional image {i}: {str(e)}")
                continue
    
    # Update product with image paths
    try:
        if main_image_path:
            db_product.imageUrl = main_image_path
        
        if additional_images_paths:
            db_product.additionalImages = json.dumps(additional_images_paths)
        
        db.commit()
        db.refresh(db_product)
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update product with images: {str(e)}"
        )
    
    return {
        "success": True,
        "message": "Product registered with images. Awaiting admin approval.",
        "data": {
            "product_id": db_product.productID,
            "product_name": db_product.productName,
            "product_description": db_product.productDescription,
            "product_type": db_product.productType,
            "main_image": {
                "url": main_image_path,
                "size": main_image_size
            } if main_image_path else None,
            "additional_images": additional_images_info,
            "approval_status": db_product.approvalStatus,
            "created_at": format_datetime(db_product.createdAt, "full")
        }
    }


@router.get("/", response_model=dict)
def get_products(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Get all products with pagination
    
    GET /products?skip=0&limit=100
    Returns: Paginated list of products
    """
    # Get total count
    all_products = repositories.get_products(db=db, skip=0, limit=10000)
    total = len(all_products)
    
    # Get paginated products
    products = all_products[skip:skip+limit]
    
    # Format products
    formatted_products = []
    for product in products:
        additional_images_list = None
        if product.additionalImages:
            try:
                additional_images_list = json.loads(product.additionalImages)
            except:
                additional_images_list = None
        
        formatted_products.append({
            "product_id": product.productID,
            "product_name": product.productName,
            "product_description": product.productDescription,
            "product_type": product.productType,
            "image_url": product.imageUrl,
            "additional_images": additional_images_list,
            "shipping_status": product.shippingStatus,
            "approval_status": product.approvalStatus,
            "rejection_reason": product.rejectionReason,
            "suggested_by_user_id": product.suggestedByUserID,
            "created_at": format_datetime(product.createdAt, "full"),
            "updated_at": format_datetime(product.updatedAt, "full") if product.updatedAt else None
        })
    
    return format_pagination_response(
        items=formatted_products,
        page=(skip // limit) + 1 if limit > 0 else 1,
        page_size=limit,
        total_items=total
    )


@router.get("/{product_id}", response_model=dict)
def get_product(product_id: int, db: Session = Depends(get_db)):
    """
    Get product by ID
    
    GET /products/{product_id}
    Returns: Product information
    """
    product = repositories.get_product(db=db, product_id=product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    # Parse additionalImages JSON string back to list
    additional_images_list = None
    if product.additionalImages:
        try:
            additional_images_list = json.loads(product.additionalImages)
        except:
            additional_images_list = None
    
    return {
        "success": True,
        "data": {
            "product_id": product.productID,
            "product_name": product.productName,
            "product_description": product.productDescription,
            "product_type": product.productType,
            "image_url": product.imageUrl,
            "additional_images": additional_images_list,
            "shipping_status": product.shippingStatus,
            "approval_status": product.approvalStatus,
            "rejection_reason": product.rejectionReason,
            "suggested_by_user_id": product.suggestedByUserID,
            "created_at": format_datetime(product.createdAt, "full"),
            "updated_at": format_datetime(product.updatedAt, "full") if product.updatedAt else None
        }
    }


@router.put("/{product_id}", response_model=dict)
def update_product(
    product_id: int,
    product_update: schemas.ProductUpdate,
    admin=Depends(require_admin),  # Admin only via middleware
    db: Session = Depends(get_db)
):
    """
    Update product information (Admin only)
    
    PUT /products/{product_id}
    Headers: Authorization: Bearer <access_token>
    Body: { "product_name": "...", "shipping_status": "..." }
    Returns: Updated product information
    """
    # Update product
    updated_product = repositories.update_product(
        db=db, 
        product_id=product_id, 
        product_update=product_update
    )
    
    if not updated_product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    # Parse additionalImages JSON string back to list
    additional_images_list = None
    if updated_product.additionalImages:
        try:
            additional_images_list = json.loads(updated_product.additionalImages)
        except:
            additional_images_list = None
    
    return {
        "success": True,
        "message": "Product updated successfully",
        "data": {
            "product_id": updated_product.productID,
            "product_name": updated_product.productName,
            "product_description": updated_product.productDescription,
            "product_type": updated_product.productType,
            "image_url": updated_product.imageUrl,
            "additional_images": additional_images_list,
            "shipping_status": updated_product.shippingStatus,
            "approval_status": updated_product.approvalStatus,
            "updated_at": format_datetime(updated_product.updatedAt, "full")
        }
    }


@router.delete("/{product_id}", response_model=schemas.MessageResponse)
def delete_product(
    product_id: int,
    admin=Depends(require_admin),  # Admin only via middleware
    db: Session = Depends(get_db)
):
    """
    Delete product (Admin only)
    
    DELETE /products/{product_id}
    Headers: Authorization: Bearer <access_token>
    Returns: Success message
    """
    success = repositories.delete_product(db=db, product_id=product_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    return schemas.MessageResponse(message="Product deleted successfully")


@router.get("/pending/approval", response_model=dict)
def get_pending_products(
    skip: int = 0,
    limit: int = 100,
    admin=Depends(require_admin),  # Admin only via middleware
    db: Session = Depends(get_db)
):
    """
    Get products pending approval (Admin only - UC13)
    
    GET /products/pending/approval?skip=0&limit=100
    Headers: Authorization: Bearer <access_token>
    Returns: Paginated list of products pending approval
    """
    # Get all products
    all_products = repositories.get_products(db=db, skip=0, limit=10000)
    pending_products = [p for p in all_products if p.approvalStatus == "pending"]
    total = len(pending_products)
    
    # Paginate
    paginated = pending_products[skip:skip+limit]
    
    # Format
    formatted_products = []
    for product in paginated:
        formatted_products.append({
            "product_id": product.productID,
            "product_name": product.productName,
            "product_description": product.productDescription,
            "product_type": product.productType,
            "image_url": product.imageUrl,
            "suggested_by_user_id": product.suggestedByUserID,
            "created_at": format_datetime(product.createdAt, "full")
        })
    
    return format_pagination_response(
        items=formatted_products,
        page=(skip // limit) + 1 if limit > 0 else 1,
        page_size=limit,
        total_items=total
    )


@router.post("/{product_id}/approve", response_model=dict)
def approve_product(
    product_id: int,
    admin=Depends(require_admin),  # Admin only via middleware
    db: Session = Depends(get_db)
):
    """
    Approve product for auction (Admin only - UC13)
    
    POST /products/{product_id}/approve
    Headers: Authorization: Bearer <access_token>
    Returns: Success message
    """
    # Update product status to "approved" and clear rejection reason
    product_update = schemas.ProductUpdate(
        approvalStatus="approved",
        shippingStatus="approved",
        rejectionReason=None
    )
    updated_product = repositories.update_product(
        db=db, 
        product_id=product_id, 
        product_update=product_update
    )
    
    if not updated_product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    return {
        "success": True,
        "message": "Product approved successfully",
        "data": {
            "product_id": updated_product.productID,
            "product_name": updated_product.productName,
            "approval_status": updated_product.approvalStatus,
            "approved_at": format_datetime(updated_product.updatedAt, "full")
        }
    }


@router.post("/{product_id}/reject", response_model=dict)
def reject_product(
    product_id: int,
    reject_request: schemas.ProductRejectRequest,
    admin=Depends(require_admin),  # Admin only via middleware
    db: Session = Depends(get_db)
):
    """
    Reject product with reason (Admin only)
    
    POST /products/{product_id}/reject
    Headers: Authorization: Bearer <access_token>
    Body: { "rejection_reason": "Product does not meet quality standards" }
    Returns: Success message
    """
    # Sanitize rejection reason
    rejection_reason = sanitize_string(reject_request.rejectionReason, max_length=500)
    
    # Update product status to "rejected" with reason
    product_update = schemas.ProductUpdate(
        approvalStatus="rejected",
        shippingStatus="rejected",
        rejectionReason=rejection_reason
    )
    updated_product = repositories.update_product(
        db=db, 
        product_id=product_id, 
        product_update=product_update
    )
    
    if not updated_product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    return {
        "success": True,
        "message": "Product rejected",
        "data": {
            "product_id": updated_product.productID,
            "product_name": updated_product.productName,
            "approval_status": updated_product.approvalStatus,
            "rejection_reason": updated_product.rejectionReason,
            "rejected_at": format_datetime(updated_product.updatedAt, "full")
        }
    }