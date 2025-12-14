from pydantic_settings import BaseSettings
from typing import List, Optional

class AppSettings(BaseSettings):
    
    # Database
    DATABASE_URL: str
    # DATABASE_URL: str = "postgresql://auction_user:auction_pass@localhost:5432/auction_db"
    
    # Security
    JWT_SECRET_KEY: str = "your-super-secret-key-change-this-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 35
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    SALT : str = "your-salt-string-change-this-in-production"
    
    # Email
    SMTP_HOST: str 
    SMTP_PORT: int 
    SMTP_USER: Optional[str]
    SMTP_PASSWORD: Optional[str]
    EMAIL_FROM: str
    EMAIL_FROM_NAME: str
    
    # Application
    APP_NAME: str = "Auction System"
    API_VERSION: str = "2.0.0"
    API_PREFIX: str = "api/v1"
    DEBUG: bool = True
    ENVIRONMENT: str = "development"
    
    # CORS
    ALLOWED_ORIGINS: list = ["http://localhost:3000", "http://localhost:5173", "http://localhost:8080"]
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
    
settings = AppSettings()