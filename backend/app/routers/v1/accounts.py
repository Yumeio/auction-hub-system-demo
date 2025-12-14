from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime

from app import repositories, schemas, models
from app.database import SessionLocal, get_db
from app.middlewares import get_current_user, get_current_active_user
from app.utils import (
    validate_email,
    validate_username,
    validate_phone_number,
    validate_age,
    is_password_strong,
    validate_password_change,
    hash_password,
    sanitize_string
)

router = APIRouter(prefix="/accounts", tags=["Accounts"])

@router.post("/register", response_model=schemas.UserResponse, deprecated=True)
def create_account(
    account: schemas.AccountCreate,
    db: Session = Depends(get_db)
):
    """
    DEPRECATED: Use /auth/register instead
    
    Create new account (UC06)
    This endpoint is deprecated. Use /auth/register for OTP-based registration.
    """
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="This endpoint is deprecated. Please use /auth/register instead"
    )
    
@router.get("/profile", response_model=schemas.UserResponse)
def get_user_profile(current_user=Depends(get_current_active_user)):
    """
    Get current user profile information
    
    GET /accounts/profile
    Headers: Authorization: Bearer <access_token>
    Returns: User profile information
    """
    return schemas.UserResponse(
        accountID=current_user.accountID,
        username=current_user.username,
        email=current_user.email,
        firstName=current_user.firstName,
        lastName=current_user.lastName,
        phoneNumber=current_user.phoneNumber,
        dateOfBirth=current_user.dateOfBirth,
        address=current_user.address,
        role=current_user.role,
        status=current_user.status,
        lastLoginAt=current_user.lastLoginAt,
        isAuthenticated=current_user.isAuthenticated
    )
    
@router.put("/profile", response_model=schemas.UserResponse)
def update_user_profile(
    profile_update: schemas.AccountUpdate,
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Update user profile information (UC007)
    
    PUT /accounts/profile
    Headers: Authorization: Bearer <access_token>
    Body: { "firstName": "John", "lastName": "Doe", ... }
    Returns: Updated user profile
    """
    # Validate email if being updated
    if profile_update.email and profile_update.email != current_user.email:
        is_valid, error = validate_email(profile_update.email)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error
            )
        
        # Check if email already exists
        existing_email = db.query(models.Account).filter(
            models.Account.email == profile_update.email,
            models.Account.accountID != current_user.accountID
        ).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already exists"
            )
    
    # Validate phone number if provided
    if profile_update.phoneNumber:
        is_valid, error = validate_phone_number(
            profile_update.phoneNumber,
            country_code="VN"
        )
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error
            )
    
    # Validate date of birth if provided
    if profile_update.dateOfBirth:
        is_valid, error = validate_age(profile_update.dateOfBirth, min_age=18)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error
            )
    
    # Sanitize text fields
    if profile_update.firstName:
        profile_update.firstName = sanitize_string(profile_update.firstName, max_length=50)
    if profile_update.lastName:
        profile_update.lastName = sanitize_string(profile_update.lastName, max_length=50)
    if profile_update.address:
        profile_update.address = sanitize_string(profile_update.address, max_length=200)
    
    # Update account
    updated_account = repositories.update_account(
        db,
        current_user.accountID,
        profile_update
    )
    
    if not updated_account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return schemas.UserResponse(
        accountID=updated_account.accountID,
        username=updated_account.username,
        email=updated_account.email,
        firstName=updated_account.firstName,
        lastName=updated_account.lastName,
        phoneNumber=updated_account.phoneNumber,
        dateOfBirth=updated_account.dateOfBirth,
        address=updated_account.address,
        role=schemas.enums.UserRole(updated_account.role.value),
        status=schemas.enums.AccountStatus(updated_account.status.value),
        lastLoginAt=updated_account.lastLoginAt,
        isAuthenticated=updated_account.isAuthenticated
    )


@router.post("/change-password", response_model=schemas.MessageResponse)
def change_password(
    password_data: schemas.ChangePasswordRequest,
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Change user password
    
    POST /accounts/change-password
    Headers: Authorization: Bearer <access_token>
    Body: { "old_password": "...", "new_password": "..." }
    Returns: Success message
    """
    old_password = password_data.old_password
    new_password = password_data.new_password
    
    if not old_password or not new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both old_password and new_password are required"
        )
    
    # Validate password change
    is_valid, error = validate_password_change(
        old_password,
        new_password,
        current_user.password
    )
    
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error
        )
    
    # Update password
    current_user.password = hash_password(new_password)
    db.commit()
    
    return schemas.MessageResponse(
        message="Password changed successfully"
    )


@router.get("/me", response_model=schemas.UserResponse, deprecated=True)
def get_me(current_user=Depends(get_current_active_user)):
    """
    DEPRECATED: Use /auth/me instead
    
    Get current user information
    """
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="This endpoint is deprecated. Please use /auth/me instead"
    )
