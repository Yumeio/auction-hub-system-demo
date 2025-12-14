"""
Image handling utilities for product images
Handles upload, validation, storage, and URL generation
"""
from pathlib import Path
from typing import Tuple, Optional
import io
import uuid
from PIL import Image
from datetime import datetime

# Storage configuration
IMAGES_PATH = Path("static/images/products")
IMAGES_PATH.mkdir(parents=True, exist_ok=True)

# Supported formats
SUPPORTED_FORMATS = {
    ".jpg": "JPEG",
    ".jpeg": "JPEG",
    ".png": "PNG",
    ".webp": "WEBP",
    ".gif": "GIF"
}

MAX_SIZE_MB = 5
MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024


def validate_image_file(
    file_content: bytes,
    filename: Optional[str] = None,
    max_size_mb: int = MAX_SIZE_MB
) -> Tuple[bool, Optional[str]]:
    """
    Validate image file content
    
    Args:
        file_content: Raw file bytes
        filename: Original filename (optional)
        max_size_mb: Maximum file size in MB
        
    Returns:
        (is_valid, error_message)
    """
    # Check size
    file_size = len(file_content)
    max_bytes = max_size_mb * 1024 * 1024
    
    if file_size > max_bytes:
        return False, f"File size ({file_size / 1024 / 1024:.2f}MB) exceeds maximum ({max_size_mb}MB)"
    
    if file_size == 0:
        return False, "File is empty"
    
    # Check extension if filename provided
    if filename:
        file_ext = Path(filename).suffix.lower()
        if file_ext not in SUPPORTED_FORMATS:
            return False, f"Unsupported format {file_ext}. Supported: {', '.join(SUPPORTED_FORMATS.keys())}"
    
    # Try to open and validate as image
    try:
        image = Image.open(io.BytesIO(file_content))
        
        # Verify it's a valid image
        image.verify()
        
        # Reopen for format check (verify() closes the image)
        image = Image.open(io.BytesIO(file_content))
        
        # Check format
        if not image.format or image.format.upper() not in ["JPEG", "PNG", "WEBP", "GIF"]:
            return False, f"Unsupported image format: {image.format}"
        
        # Check dimensions (reasonable limits)
        width, height = image.size
        if width > 8000 or height > 8000:
            return False, f"Image dimensions too large ({width}x{height}). Maximum: 8000x8000"
        
        if width < 10 or height < 10:
            return False, f"Image dimensions too small ({width}x{height}). Minimum: 10x10"
        
        return True, None
        
    except Exception as e:
        return False, f"Invalid image file: {str(e)}"


def save_image(
    file_content: bytes,
    filename: str,
    product_id: Optional[int] = None
) -> str:
    """
    Save image to storage and return relative path
    
    Args:
        file_content: Raw file bytes
        filename: Original filename
        product_id: Optional product ID for organization
        
    Returns:
        Relative path to saved image
    """
    # Generate unique filename
    file_ext = Path(filename).suffix.lower()
    unique_id = uuid.uuid4().hex[:8]
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    new_filename = f"{timestamp}_{unique_id}{file_ext}"
    
    # Determine save path
    if product_id:
        save_dir = IMAGES_PATH / f"product_{product_id}"
    else:
        save_dir = IMAGES_PATH / "general"
    
    save_dir.mkdir(parents=True, exist_ok=True)
    save_path = save_dir / new_filename
    
    # Open and process image
    image = Image.open(io.BytesIO(file_content))
    
    # Convert RGBA to RGB if saving as JPEG
    if file_ext in [".jpg", ".jpeg"] and image.mode in ("RGBA", "LA", "P"):
        rgb_image = Image.new("RGB", image.size, (255, 255, 255))
        if image.mode == "P":
            image = image.convert("RGBA")
        rgb_image.paste(image, mask=image.split()[-1] if image.mode == "RGBA" else None)
        image = rgb_image
    
    # Optimize and save
    save_kwargs = {
        "optimize": True,
        "quality": 85
    }
    
    if file_ext in [".jpg", ".jpeg"]:
        save_kwargs["format"] = "JPEG"
    elif file_ext == ".png":
        save_kwargs["format"] = "PNG"
    elif file_ext == ".webp":
        save_kwargs["format"] = "WEBP"
    elif file_ext == ".gif":
        save_kwargs["format"] = "GIF"
        save_kwargs.pop("quality")  # GIF doesn't use quality
    
    image.save(save_path, **save_kwargs)
    
    # Return relative path
    relative_path = save_path.relative_to(".").as_posix()
    return relative_path


def delete_image(image_path: str) -> bool:
    """
    Delete image from storage
    
    Args:
        image_path: Relative path to image
        
    Returns:
        True if deleted, False otherwise
    """
    try:
        full_path = Path(image_path)
        if full_path.exists() and full_path.is_file():
            full_path.unlink()
            return True
        return False
    except Exception as e:
        print(f"Error deleting image: {e}")
        return False


def get_image_url(image_path: str) -> str:
    """
    Get full URL for image
    
    Args:
        image_path: Relative path to image
        
    Returns:
        Full URL to access image
    """
    # For local development, return relative path
    # In production, prepend base URL
    return f"/images/view/{image_path}"


def get_supported_formats() -> list:
    """
    Get list of supported image formats
    
    Returns:
        List of supported extensions
    """
    return list(SUPPORTED_FORMATS.keys())


def create_sample_images():
    """
    Create sample placeholder images for testing
    """
    samples_dir = IMAGES_PATH / "samples"
    samples_dir.mkdir(parents=True, exist_ok=True)
    
    # Create sample images with different colors
    colors = [
        ("red", (255, 0, 0)),
        ("green", (0, 255, 0)),
        ("blue", (0, 0, 255)),
    ]
    
    for name, color in colors:
        # Create 400x400 image
        image = Image.new("RGB", (400, 400), color)
        
        # Save as JPEG
        save_path = samples_dir / f"sample_{name}.jpg"
        image.save(save_path, "JPEG", quality=85, optimize=True)
        
        print(f"Created sample image: {save_path}")


def resize_image(
    image_path: str,
    max_width: int = 1920,
    max_height: int = 1920
) -> bool:
    """
    Resize image if it exceeds maximum dimensions
    
    Args:
        image_path: Path to image
        max_width: Maximum width
        max_height: Maximum height
        
    Returns:
        True if resized, False otherwise
    """
    try:
        full_path = Path(image_path)
        if not full_path.exists():
            return False
        
        image = Image.open(full_path)
        original_size = image.size
        
        # Check if resize needed
        if image.width <= max_width and image.height <= max_height:
            return False
        
        # Calculate new size maintaining aspect ratio
        image.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)
        
        # Save resized image
        save_kwargs = {"optimize": True, "quality": 85}
        
        if image.format == "JPEG":
            save_kwargs["format"] = "JPEG"
        elif image.format == "PNG":
            save_kwargs["format"] = "PNG"
        elif image.format == "WEBP":
            save_kwargs["format"] = "WEBP"
        
        image.save(full_path, **save_kwargs)
        
        print(f"Resized image from {original_size} to {image.size}")
        return True
        
    except Exception as e:
        print(f"Error resizing image: {e}")
        return False


def get_image_info(image_path: str) -> Optional[dict]:
    """
    Get image information
    
    Args:
        image_path: Path to image
        
    Returns:
        Dictionary with image info or None
    """
    try:
        full_path = Path(image_path)
        if not full_path.exists():
            return None
        
        image = Image.open(full_path)
        file_size = full_path.stat().st_size
        
        return {
            "path": str(image_path),
            "format": image.format,
            "mode": image.mode,
            "size": image.size,
            "width": image.width,
            "height": image.height,
            "file_size_bytes": file_size,
            "file_size_mb": round(file_size / 1024 / 1024, 2)
        }
        
    except Exception as e:
        print(f"Error getting image info: {e}")
        return None


