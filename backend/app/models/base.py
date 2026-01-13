import json
from sqlalchemy import Column, Integer, DateTime, func
from sqlalchemy.ext.declarative import declared_attr
from app.database import Base # <-- IMPORT THE SHARED BASE

class BaseModel(Base): # <-- Inherit from the SHARED Base
    """Base model class for SQLAlchemy models."""
    __abstract__ = True
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
    def as_dict(self):
        """Convert model to dictionary."""
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}
    def to_json(self):
        """Convert model to JSON string."""
        return json.dumps(self.as_dict(), default=str)