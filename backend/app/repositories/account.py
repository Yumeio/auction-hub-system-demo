from sqlalchemy.orm import Session
from typing import Optional

from ..utils.password import hash_password, verify_password
from .. import models, schemas
from ..models.enums import UserRole, AccountStatus

def authenticate_account(db: Session, username: str, password: str) -> Optional[models.Account]:
    """Authenticate account with username and password"""
    account = get_account_by_username(db, username)
    if not account:
        print("Account not found")
        return None
    if not verify_password(password, str(account.password)):
        print("Password verification failed")
        return None
    return account

def get_account_by_username(db: Session, username: str) -> Optional[models.Account]:
    """Get account by username"""
    return db.query(models.Account).filter(models.Account.username == username).first()

def get_account_by_id(db: Session, account_id: int) -> Optional[models.Account]:
    """Get account by ID"""
    return db.query(models.Account).filter(models.Account.accountID == account_id).first()

def create_account(db: Session, account: schemas.AccountCreate) -> models.Account:
    """Create new account with hashed password"""
    hashed_password = str(hash_password(account.password))
    db_account = models.Account(
        username=account.username,
        email=account.email,
        password=hashed_password,
        firstName=account.firstName,
        lastName=account.lastName,
        phoneNumber=account.phoneNumber,
        dateOfBirth=account.dateOfBirth,
        address=account.address,
        role=UserRole.USER,
        status=AccountStatus.ACTIVE,
        isAuthenticated=False
    )
    db.add(db_account)
    db.commit()
    db.refresh(db_account)
    return db_account

def update_account(db: Session, account_id: int, account_update: schemas.AccountUpdate) -> Optional[models.Account]:
    """Update account information"""
    db_account = get_account_by_id(db, account_id)
    if not db_account:
        return None
    
    update_data = account_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_account, field, value)
    
    db.commit()
    db.refresh(db_account)
    return db_account

def delete_unactivated_account(db: Session, username: str) -> bool:
    """Delete account by username (typically for unactivated accounts)"""
    db_account = get_account_by_username(db, username)
    if not db_account:
        return False
    
    db.delete(db_account)
    db.commit()
    return True
