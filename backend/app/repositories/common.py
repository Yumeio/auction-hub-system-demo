from sqlalchemy.orm import Session
from typing import Optional

from .. import models, schemas


def get_item(db: Session, item_id: int) -> Optional[schemas.Item]:
    """Get item by ID"""
    return db.query(models.Item).filter(models.Item.id == item_id).first()


def create_item(db: Session, item: schemas.ItemCreate) -> models.Item:
    """Create new item"""
    db_item = models.Item(title=item.title, description=item.description)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item