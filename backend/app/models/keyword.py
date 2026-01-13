from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, Enum, Index
from sqlalchemy.dialects.postgresql import JSONB
from app.database import Base
from sqlalchemy.orm import relationship
import enum

class KeywordStatus(enum.Enum):
    ungrouped = "ungrouped"
    grouped = "grouped"
    confirmed = "confirmed"
    blocked = "blocked"

class BlockedBy(enum.Enum):
    user = "user"
    system = "system"
    merge_hidden = "merge_hidden"

class Keyword(Base):
    __tablename__ = "keywords"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    keyword = Column(String, index=True)
    volume = Column(Integer, nullable=True)
    difficulty = Column(Float, nullable=True)
    rating = Column(Integer, nullable=True)
    tokens = Column(JSONB, nullable=False, default="[]")
    original_tokens = Column(JSONB, nullable=True)
    is_parent = Column(Boolean, default=False)
    group_id = Column(String, nullable=True, index=True)
    group_name = Column(String, nullable=True)
    status = Column(String, default=KeywordStatus.ungrouped.value, index=True)
    original_volume = Column(Integer, nullable=True)
    original_state = Column(String, nullable=True)
    blocked_by = Column(Enum(BlockedBy, name="blocked_by_enum", native_enum=True, create_type=False), nullable=True)
    blocked_token = Column(String, nullable=True, index=True)
    serp_features = Column(JSONB, nullable=True, default="[]")
    
    # Relationships
    project = relationship("Project", back_populates="keywords")
    merge_operations = relationship("KeywordMergeOperation", back_populates="keyword", cascade="all, delete-orphan")

    # Composite indexes for common query patterns
    __table_args__ = (
        Index('idx_keywords_project_status', 'project_id', 'status'),
        Index('idx_keywords_project_parent_group', 'project_id', 'is_parent', 'group_id'),
        Index('idx_keywords_tokens_gin', tokens, postgresql_using='gin'),
        Index('idx_keywords_project_volume', 'project_id', 'volume'),
        Index('idx_keywords_project_rating', 'project_id', 'rating'),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "project_id": self.project_id,
            "keyword": self.keyword,
            "volume": self.volume,
            "difficulty": self.difficulty,
            "rating": self.rating,
            "tokens": self.tokens,
            "original_tokens": self.original_tokens,
            "is_parent": self.is_parent,
            "group_id": self.group_id,
            "group_name": self.group_name,
            "status": self.status,
            "original_volume": self.original_volume,
            "original_state": self.original_state,
            "blocked_by": self.blocked_by.value if self.blocked_by else None,
            "serp_features": self.serp_features
        }