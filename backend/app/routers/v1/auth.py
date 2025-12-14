from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from datetime import datetime

from app.config import settings
from app import schemas, repositories, models
from app.database import SessionLocal, get_db
from app.middlewares import (
    get_current_active_user,
    get_current_user
)
from app.utils import (
    create_token_pair,
    refresh_access_token,
    validate_email,
    validate_username,
    is_password_strong,
    validate_password_change,
    hash_password,
    verify_password,
    otp_manager,
    validate_otp_format,
    format_otp_email,
    format_welcome_email,
    format_password_reset_email,
    email_service
)
from app.models.enums import (
    AccountStatus,
    UserRole,
    NotificationType
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=schemas.TokenResponse)
async def login(
    login_data: schemas.LoginRequest,
    db: Session = Depends(get_db)
):
    user = repositories.authenticate_account(
        db=db,
        username=login_data.username,
        password=login_data.password
    )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is not active"
        )
    
    tokens = create_token_pair(
        user_id=user.accountID,
        username=user.username,
        role=user.role.value
    )
    
    # Update last login
    user.lastLoginAt = datetime.utcnow()
    db.commit()
    
    return schemas.TokenResponse(
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )
    
@router.post("/refresh", response_model=schemas.TokenResponse)
def refresh_token_endpoint(refresh_data: schemas.RefreshRequest):
    """
    Refresh token endpoint: get new access token using refresh token
    
    POST /auth/refresh
    Body: { "refresh_token": "..." }
    Returns: { "access_token", "refresh_token", "token_type", "expires_in" }
    """
    # Use utils to refresh token
    new_access_token = refresh_access_token(refresh_data.refresh_token)

    if not new_access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return schemas.TokenResponse(
        access_token=new_access_token,
        refresh_token=refresh_data.refresh_token,  # Keep same refresh token
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )


@router.get("/me", response_model=schemas.UserResponse)
def get_me(current_user=Depends(get_current_active_user)):
    """
    Get current user info endpoint
    
    GET /auth/me
    Headers: Authorization: Bearer <access_token>
    Returns: User information
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
        role=schemas.UserRole(current_user.role.value),
        status=schemas.AccountStatus(current_user.status.value),
        lastLoginAt=current_user.lastLoginAt,
        isAuthenticated=current_user.isAuthenticated
    )


# =================== REGISTRATION WITH OTP =================== #

@router.post("/register", response_model=schemas.RegistrationWithOTPResponse)
async def register_with_otp(
    account_data: schemas.AccountCreate,
    db: Session = Depends(get_db)
):
    """
    Register new account with OTP email verification
    
    POST /auth/register
    Body: AccountCreate data
    Returns: RegistrationWithOTPResponse with otp_token
    """
    # Validate email
    is_valid, error = validate_email(account_data.email)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error
        )
    
    # Validate username
    is_valid, error = validate_username(account_data.username)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error
        )
    
    # Validate password strength
    is_strong, error = is_password_strong(account_data.password)
    if not is_strong:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error
        )
    
    # Check if username exists
    existing_user = repositories.get_account_by_username(db, account_data.username)
    if existing_user:
        # Check if unverified and can be deleted
        if not existing_user.isAuthenticated:
            time_since_creation = datetime.utcnow() - existing_user.createdAt
            if time_since_creation.total_seconds() > 900:  # 15 minutes
                # Delete unverified account
                repositories.delete_unactivated_account(db, account_data.username)
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Username already exists. Please wait 15 minutes or use a different username."
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already exists"
            )
    
    # Check if email exists
    existing_email = db.query(
        models.Account).filter(
        models.Account.email == account_data.email
    ).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already exists"
        )
    
    # Hash password
    account_data.password = hash_password(account_data.password)
    
    # Create account (isAuthenticated=False by default)
    user = repositories.create_account(db, account_data)
    
    # Generate OTP
    otp_code, otp_token = otp_manager.create_otp(
        user_id=user.accountID,
        purpose="registration"
    )
    
    # Send OTP email
    text, html = format_otp_email(user.username, otp_code)
    email_sent = email_service.send_email(
        to_email=user.email,
        subject="Verify Your Email",
        body=text,
        html_body=html
    )
    
    if not email_sent:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send verification email. Please try again."
        )
    
    return schemas.RegistrationWithOTPResponse(
        success=True,
        message="Registration successful. Please check your email for verification code.",
        otp_token=otp_token,
        expires_in=300,  # 5 minutes
        user=schemas.UserResponse(
            accountID=user.accountID,
            username=user.username,
            email=user.email,
            firstName=user.firstName,
            lastName=user.lastName,
            phoneNumber=user.phoneNumber,
            dateOfBirth=user.dateOfBirth,
            address=user.address,
            role=schemas.UserRole(user.role.value),
            status=schemas.AccountStatus(user.status.value),
            lastLoginAt=user.lastLoginAt,
            isAuthenticated=user.isAuthenticated
        )
    )


@router.post("/verify-otp", response_model=schemas.TokenResponse)
async def verify_registration_otp(
    verify_data: schemas.OTPVerificationRequest,
    db: Session = Depends(get_db)
):
    """
    Verify OTP for registration
    
    POST /auth/verify-otp
    Body: { "otp_code": "123456", "otp_token": "...", "username": "user123" }
    Returns: TokenResponse with access and refresh tokens
    """
    # Validate OTP format
    is_valid, error = validate_otp_format(verify_data.otp_code)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error
        )
    
    # Get user
    user = repositories.get_account_by_username(db, verify_data.username)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Verify OTP
    is_valid, error = otp_manager.verify_otp(
        verify_data.otp_token,
        verify_data.otp_code,
        user.accountID
    )
    
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error
        )
    
    # Mark user as authenticated
    user.isAuthenticated = True
    user.status = AccountStatus.ACTIVE
    db.commit()
    
    # Send welcome email
    text, html = format_welcome_email(user.username)
    email_service.send_email(
        to_email=user.email,
        subject="Welcome to Auction System!",
        body=text,
        html_body=html
    )
    
    # Create tokens
    tokens = create_token_pair(
        user_id=user.accountID,
        username=user.username,
        role=user.role.value
    )
    
    return schemas.TokenResponse(
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )


@router.post("/resend-otp", response_model=schemas.OTPResendResponse)
async def resend_otp(
    resend_data: dict,
    db: Session = Depends(get_db)
):
    """
    Resend OTP for registration
    
    POST /auth/resend-otp
    Body: { "username": "user123" }
    Returns: New OTP token
    """
    username = resend_data.get("username")
    if not username or not isinstance(username, str):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username is required"
        )
    
    # Get user
    user = repositories.get_account_by_username(db, username)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if already verified
    if user.isAuthenticated:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account is already verified"
        )
    
    # Generate new OTP
    otp_code, otp_token = otp_manager.create_otp(
        user_id=user.accountID,
        purpose="registration"
    )
    
    # Send OTP email
    text, html = format_otp_email(user.username, otp_code)
    email_sent = email_service.send_email(
        to_email=user.email,
        subject="Verify Your Email",
        body=text,
        html_body=html
    )
    
    if not email_sent:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send email. Please try again."
        )
    
    return schemas.OTPResendResponse(
        success=True,
        message="New OTP has been sent to your email",
        otp_token=otp_token,
        expires_in=300
    )


# =================== PASSWORD RECOVERY =================== #

@router.post("/recover", response_model=schemas.PasswordRecoveryResponse)
async def request_password_recovery(
    recovery_data: schemas.PasswordRecoveryRequest,
    db: Session = Depends(get_db)
):
    """
    Request password recovery OTP
    
    POST /auth/recover
    Body: { "username": "user123" }
    Returns: PasswordRecoveryResponse
    """
    # Get user
    user = repositories.get_account_by_username(db, recovery_data.username)
    
    # Always return success to prevent user enumeration
    if not user:
        return schemas.PasswordRecoveryResponse(
            success=True,
            message="If the account exists, an OTP will be sent to your email"
        )
    
    # Generate OTP
    otp_code, otp_token = otp_manager.create_otp(
        user_id=user.accountID,
        purpose="password_reset"
    )
    
    # Send OTP email
    text, html = format_otp_email(user.username, otp_code, expires_minutes=5)
    email_sent = email_service.send_email(
        to_email=user.email,
        subject="Password Recovery",
        body=text,
        html_body=html
    )
    
    if not email_sent:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send email. Please try again."
        )
    
    return schemas.PasswordRecoveryResponse(
        success=True,
        message="Password recovery OTP has been sent to your email",
        otp_token=otp_token,
        expires_in=300
    )


@router.post("/recover/verify", response_model=schemas.ResetTokenResponse)
async def verify_password_recovery_otp(
    verify_data: schemas.OTPVerifyPasswordRecoveryRequest,
    db: Session = Depends(get_db)
):
    """
    Verify OTP for password recovery and get reset token
    
    POST /auth/recover/verify
    Body: { "otp_code": "123456", "otp_token": "...", "username": "user123" }
    Returns: ResetTokenResponse
    """
    # Validate OTP format
    is_valid, error = validate_otp_format(verify_data.otp_code)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error
        )
    
    # Get user
    user = repositories.get_account_by_username(db, verify_data.username)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Verify OTP
    is_valid, error = otp_manager.verify_otp(
        verify_data.otp_token,
        verify_data.otp_code,
        user.accountID
    )
    
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error
        )
    
    # Create reset token (short-lived)
    reset_token = create_token_pair(
        user_id=user.accountID,
        username=user.username,
        role="reset"  # Special role for password reset
    )["access_token"]
    
    return schemas.ResetTokenResponse(
        success=True,
        message="OTP verified successfully. You can now reset your password.",
        reset_token=reset_token,
        expires_in=300
    )


@router.post("/reset", response_model=schemas.PasswordResetResponse)
async def reset_password(
    reset_data: schemas.PasswordResetRequest,
    db: Session = Depends(get_db)
):
    """
    Reset password using reset token
    
    POST /auth/reset
    Body: { "reset_token": "...", "new_password": "newpassword123" }
    Returns: PasswordResetResponse
    """
    # Decode reset token
    from app.utils.jwt import decode_token
    
    try:
        payload = decode_token(reset_data.reset_token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired reset token"
        )
    
    # Validate password strength
    is_strong, error = is_password_strong(reset_data.new_password)
    if not is_strong:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error
        )
    
    # Get user
    username = payload.get("username")
    
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid reset token payload"
        )
    user = repositories.get_account_by_username(db, username)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Hash and update password
    user.password = hash_password(reset_data.new_password)
    db.commit()
    
    return schemas.PasswordResetResponse(
        success=True,
        message="Password has been reset successfully"
    )


@router.post("/logout")
async def logout(current_user=Depends(get_current_user)):
    """
    Logout endpoint
    
    POST /auth/logout
    Headers: Authorization: Bearer <access_token>
    Returns: Success message
    """
    return {
        "success": True,
        "message": "Logged out successfully"
    }


@router.get("/otp/status", response_model=schemas.OTPStatusResponse)
async def get_otp_status(otp_token: str):
    """
    Get OTP token status
    
    GET /auth/otp/status?otp_token=...
    Returns: OTPStatusResponse
    """
    info = otp_manager.get_otp_info(otp_token)
    
    if not info:
        return schemas.OTPStatusResponse(
            valid=False,
            expired=True,
            remaining_trials=0,
            purpose=None,
            username=None,
            expires_at=None,
            message="Invalid or expired OTP token"
        )
    
    remaining = otp_manager.get_remaining_attempts(otp_token)
    time_remaining = otp_manager.get_time_remaining(otp_token)
    
    return schemas.OTPStatusResponse(
        valid=True,
        expired=time_remaining == 0,
        remaining_trials=remaining,
        purpose=info["purpose"],
        username=None,  # Don't expose username
        expires_at=info["expires_at"],
        message="OTP token is valid"
    )


@router.post("/cancel-registration", response_model=schemas.MessageResponse)
async def cancel_registration(
    cancel_data: schemas.RegistrationCancelRequest,
    db: Session = Depends(get_db)
):
    """
    Cancel unverified registration
    
    POST /auth/cancel-registration
    Body: { "username": "user123" }
    Returns: Success message
    """
    # Get user
    user = repositories.get_account_by_username(db, cancel_data.username)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if unverified
    if user.isAuthenticated:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel verified account"
        )
    
    # Delete account
    success = repositories.delete_unactivated_account(db, cancel_data.username)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel registration"
        )
    
    return schemas.MessageResponse(
        message="Registration cancelled successfully"
    )