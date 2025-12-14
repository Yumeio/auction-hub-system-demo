from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import date


class AccountCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    firstName: str
    lastName: str
    phoneNumber: Optional[str] = None
    dateOfBirth: Optional[date] = None
    address: Optional[str] = None


class AccountUpdate(BaseModel):
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    phoneNumber: Optional[str] = None
    email: Optional[EmailStr] = None
    dateOfBirth: Optional[date] = None
    address: Optional[str] = None
    
class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str