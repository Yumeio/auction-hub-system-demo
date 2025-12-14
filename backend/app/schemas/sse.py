from pydantic import BaseModel
from typing import Optional


class SSEEvent(BaseModel):
    event: str
    data: dict
    id: Optional[str] = None
    retry: Optional[int] = 3000