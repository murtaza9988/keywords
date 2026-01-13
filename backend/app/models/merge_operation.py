from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func, Index, Text
from sqlalchemy.dialects.postgresql import JSONB
from app.database import Base
from sqlalchemy.orm import relationship

class MergeOperation(Base):
    __tablename__ = "merge_operations"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    parent_token = Column(String, nullable=False, index=True)
    child_tokens = Column(JSONB, nullable=False)  # Array of child tokens
    operation_id = Column(String, unique=True, nullable=False, index=True)  # Unique identifier for this merge
    created_at = Column(DateTime, default=func.now(), nullable=False)
    created_by = Column(String, nullable=True)  # User who created the merge
    
    # Relationships
    project = relationship("Project")
    keyword_operations = relationship("KeywordMergeOperation", back_populates="merge_operation", cascade="all, delete-orphan")
    
    # Indexes
    __table_args__ = (
        Index('idx_merge_operations_project_parent', 'project_id', 'parent_token'),
        Index('idx_merge_operations_operation_id', 'operation_id'),
    )

class KeywordMergeOperation(Base):
    __tablename__ = "keyword_merge_operations"
    
    id = Column(Integer, primary_key=True, index=True)
    keyword_id = Column(Integer, ForeignKey("keywords.id", ondelete="CASCADE"), nullable=False)
    merge_operation_id = Column(Integer, ForeignKey("merge_operations.id", ondelete="CASCADE"), nullable=False)
    original_tokens_snapshot = Column(JSONB, nullable=True)  # Snapshot of tokens before this merge
    created_at = Column(DateTime, default=func.now(), nullable=False)
    
    # Relationships
    keyword = relationship("Keyword", back_populates="merge_operations")
    merge_operation = relationship("MergeOperation", back_populates="keyword_operations")
    
    # Indexes
    __table_args__ = (
        Index('idx_keyword_merge_ops_keyword', 'keyword_id'),
        Index('idx_keyword_merge_ops_merge', 'merge_operation_id'),
        Index('idx_keyword_merge_ops_composite', 'keyword_id', 'merge_operation_id'),
    )