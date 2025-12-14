from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date
from .enums import UserRole, AccountStatus


class LoginRequest(BaseModel):
    username: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class UserResponse(BaseModel):
    accountID: int
    username: str
    email: str
    firstName: str
    lastName: str
    phoneNumber: Optional[str] = None
    dateOfBirth: Optional[date] = None
    address: Optional[str] = None
    role: UserRole
    status: AccountStatus
    lastLoginAt: Optional[datetime] = None
    isAuthenticated: bool

    class Config:
        from_attributes = True


class OTPVerificationRequest(BaseModel):
    otp_code: str
    otp_token: str
    username: str


class OTPVerificationResponse(BaseModel):
    success: bool
    message: str
    remaining_trials: Optional[int] = None
    updated_token: Optional[str] = None


class OTPRegistrationRequest(BaseModel):
    username: str


class OTPResendResponse(BaseModel):
    success: bool
    message: str
    otp_token: Optional[str] = None
    expires_in: Optional[int] = None


class PasswordRecoveryRequest(BaseModel):
    username: str


class PasswordRecoveryResponse(BaseModel):
    success: bool
    message: str
    otp_token: Optional[str] = None
    expires_in: Optional[int] = None


class OTPVerifyPasswordRecoveryRequest(BaseModel):
    otp_code: str
    otp_token: str
    username: str


class ResetTokenResponse(BaseModel):
    success: bool
    message: str
    reset_token: Optional[str] = None
    expires_in: Optional[int] = None


class PasswordResetRequest(BaseModel):
    reset_token: str
    new_password: str


class PasswordResetResponse(BaseModel):
    success: bool
    message: str


class RegistrationWithOTPResponse(BaseModel):
    success: bool
    message: str
    otp_token: Optional[str] = None
    expires_in: Optional[int] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    user: Optional[UserResponse] = None


class OTPStatusResponse(BaseModel):
    valid: bool
    expired: bool
    remaining_trials: int
    purpose: Optional[str] = None
    username: Optional[str] = None
    expires_at: Optional[datetime] = None
    message: str = ""


class RateLimitResponse(BaseModel):
    allowed: bool
    remaining: Optional[int] = None
    reset_time: Optional[datetime] = None
    message: str


class RegistrationCancelRequest(BaseModel):
    username: str