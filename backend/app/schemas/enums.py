from enum import Enum

class UserRole(str, Enum):
    USER = "user"
    ADMIN = "admin"

class AccountStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"