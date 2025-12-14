"""
Image upload and management router for local storage
Refactored to use middleware and utils packages
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from pathlib import Path

from app import repositories, schemas
from app.database import SessionLocal, get_db
from app.middlewares import get_current_active_user, require_admin
from app.utils import (
    validate_image_file,
    format_file_size,
    format_datetime
)

router = APIRouter(prefix="/images", tags=["Image Management"])



@router.post("/upload", response_model=dict)
async def upload_image(
    file: UploadFile = File(...),
    product_id: Optional[int] = Form(None),
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Upload image to local storage
    
    POST /images/upload
    Headers: Authorization: Bearer <access_token>
    Form Data:
    - file: Image file (JPEG, PNG, WEBP)
    - product_id: Optional product ID for organization
    
    Returns: Uploaded image information with local path
    """
    # Read file content
    file_content = await file.read()
    
    # Validate file using utils
    is_valid, error_message = validate_image_file(
        file_content,
        filename=file.filename,
        max_size_mb=5
    )
    
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_message
        )
    
    # Save image
    try:
        from app.utils import save_image, get_image_url
        
        image_path = save_image(file_content, str(file.filename), product_id)
        image_url = get_image_url(image_path)
        
        return {
            "success": True,
            "message": "Image uploaded successfully",
            "data": {
                "image_path": image_path,
                "image_url": image_url,
                "filename": file.filename,
                "size": format_file_size(len(file_content)),
                "size_bytes": len(file_content),
                "product_id": product_id
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save image: {str(e)}"
        )


@router.post("/upload/multiple", response_model=dict)
async def upload_multiple_images(
    files: List[UploadFile] = File(...),
    product_id: Optional[int] = Form(None),
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Upload multiple images to local storage
    
    POST /images/upload/multiple
    Headers: Authorization: Bearer <access_token>
    Form Data:
    - files: List of image files (max 5)
    - product_id: Optional product ID for organization
    
    Returns: List of uploaded images with their information
    """
    if len(files) > 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 5 images allowed per upload"
        )
    
    uploaded_images = []
    
    for file in files:
        try:
            # Read file content
            file_content = await file.read()
            
            # Validate file using utils
            is_valid, error_message = validate_image_file(
                file_content,
                filename=file.filename,
                max_size_mb=5
            )
            
            if not is_valid:
                uploaded_images.append({
                    "filename": file.filename,
                    "success": False,
                    "error": error_message
                })
                continue
            
            # Save image
            from app.utils.image_handler import save_image, get_image_url
            
            image_path = save_image(file_content, str(file.filename), product_id)
            image_url = get_image_url(image_path)
            
            uploaded_images.append({
                "filename": file.filename,
                "image_path": image_path,
                "image_url": image_url,
                "size": format_file_size(len(file_content)),
                "size_bytes": len(file_content),
                "success": True
            })
            
        except Exception as e:
            uploaded_images.append({
                "filename": file.filename,
                "success": False,
                "error": str(e)
            })
    
    successful_uploads = [img for img in uploaded_images if img.get('success')]
    
    if not successful_uploads:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid images uploaded"
        )
    
    return {
        "success": True,
        "message": f"Uploaded {len(successful_uploads)} of {len(files)} images",
        "data": {
            "images": uploaded_images,
            "total_uploaded": len(successful_uploads),
            "total_failed": len(uploaded_images) - len(successful_uploads),
            "product_id": product_id
        }
    }


@router.delete("/delete", response_model=dict)
async def delete_uploaded_image(
    image_path: str,
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Delete image from local storage
    
    DELETE /images/delete?image_path=storage/images/products/sample.jpg
    Headers: Authorization: Bearer <access_token>
    Query Parameters:
    - image_path: Relative path to image to delete
    
    Returns: Success message
    """
    # Security check
    if not image_path.startswith("storage/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image path"
        )
    
    from app.utils.image_handler import delete_image
    
    success = delete_image(image_path)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found or could not be deleted"
        )
    
    return {
        "success": True,
        "message": "Image deleted successfully",
        "deleted_path": image_path
    }


@router.get("/view/{image_path:path}")
async def view_image(image_path: str):
    """
    Serve image files from local storage
    
    GET /images/view/storage/images/products/sample.jpg
    
    Returns: Image file
    """
    # Security: prevent directory traversal
    if ".." in image_path or image_path.startswith("/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image path"
        )
    
    # Check if file exists
    full_path = Path(image_path)
    if not full_path.exists() or not full_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found"
        )
    
    # Determine content type
    content_type = "image/jpeg"  # Default
    if image_path.lower().endswith('.png'):
        content_type = "image/png"
    elif image_path.lower().endswith('.webp'):
        content_type = "image/webp"
    elif image_path.lower().endswith('.gif'):
        content_type = "image/gif"
    
    return FileResponse(
        path=image_path,
        media_type=content_type
    )


@router.get("/list", response_model=dict)
async def list_images(
    product_id: Optional[int] = None,
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    List images in storage with formatted sizes
    
    GET /images/list?product_id=123
    Headers: Authorization: Bearer <access_token>
    Query Parameters:
    - product_id: Optional filter by product ID
    
    Returns: List of images with their information
    """
    from app.utils.image_handler import IMAGES_PATH, get_image_url
    from datetime import datetime
    
    images = []
    
    if product_id:
        # List images for specific product
        product_dir = IMAGES_PATH / f"product_{product_id}"
        if product_dir.exists():
            for image_file in product_dir.glob("*"):
                if image_file.is_file() and image_file.suffix.lower() in ['.jpg', '.jpeg', '.png', '.webp', '.gif']:
                    relative_path = f"storage/images/products/product_{product_id}/{image_file.name}"
                    file_size = image_file.stat().st_size
                    modified_time = datetime.fromtimestamp(image_file.stat().st_mtime)
                    
                    images.append({
                        "filename": image_file.name,
                        "image_path": relative_path,
                        "image_url": get_image_url(relative_path),
                        "size": format_file_size(file_size),
                        "size_bytes": file_size,
                        "modified_time": format_datetime(modified_time, "full")
                    })
    else:
        # List all images
        for image_file in IMAGES_PATH.rglob("*"):
            if image_file.is_file() and image_file.suffix.lower() in ['.jpg', '.jpeg', '.png', '.webp', '.gif']:
                # Skip sample images
                if "samples" in str(image_file):
                    continue
                
                relative_path = str(image_file.relative_to("."))
                file_size = image_file.stat().st_size
                modified_time = datetime.fromtimestamp(image_file.stat().st_mtime)
                
                images.append({
                    "filename": image_file.name,
                    "image_path": relative_path,
                    "image_url": get_image_url(relative_path),
                    "size": format_file_size(file_size),
                    "size_bytes": file_size,
                    "modified_time": format_datetime(modified_time, "full")
                })
    
    # Calculate total storage
    total_bytes = sum(img["size_bytes"] for img in images)
    
    return {
        "success": True,
        "data": {
            "images": images,
            "total_count": len(images),
            "total_storage": format_file_size(total_bytes),
            "total_storage_bytes": total_bytes,
            "storage_path": str(IMAGES_PATH),
            "product_id": product_id
        }
    }


@router.get("/formats", response_model=dict)
async def get_supported_image_formats():
    """
    Get supported image formats
    
    GET /images/formats
    
    Returns: List of supported formats and limits
    """
    from app.utils.image_handler import get_supported_formats
    
    return {
        "success": True,
        "data": {
            "supported_formats": get_supported_formats(),
            "max_file_size": "5 MB",
            "max_file_size_bytes": 5 * 1024 * 1024,
            "max_files_per_request": 5,
            "features": [
                "Automatic JPEG conversion for transparency",
                "Image optimization and compression",
                "Unique filename generation",
                "Product-specific organization",
                "Format validation",
                "Size limits enforcement"
            ]
        }
    }


@router.post("/samples", response_model=dict)
async def create_sample_images(
    admin=Depends(require_admin),  # Admin only via middleware
    db: Session = Depends(get_db)
):
    """
    Create sample images for demo purposes (Admin only)
    
    POST /images/samples
    Headers: Authorization: Bearer <access_token>
    
    Returns: Sample images creation result
    """
    from app.utils.image_handler import create_sample_images
    
    try:
        create_sample_images()
        return {
            "success": True,
            "message": "Sample images created successfully",
            "data": {
                "samples_location": "storage/images/products/samples/",
                "note": "Sample images are for demonstration purposes only"
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create sample images: {str(e)}"
        )