from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field, validator, field_validator, model_validator
from app.models.keyword import KeywordStatus
import json
from datetime import datetime
from enum import Enum

# Define BlockedBy enum for Pydantic schema
class BlockedBy(str, Enum):
    user = "user"
    system = "system"

class KeywordBase(BaseModel):
    keyword: str
    volume: Optional[int] = 0
    difficulty: Optional[float] = 0
    rating: Optional[int] = None

class KeywordCreateInternal(KeywordBase):
    project_id: int
    tokens: str
    status: KeywordStatus = KeywordStatus.ungrouped
    is_parent: bool = False
    group_id: Optional[str] = None
    group_name: Optional[str] = None
    blocked_by: Optional[BlockedBy] = None
    serp_features: List[str] = Field([], alias="serpFeatures")

class KeywordResponse(KeywordBase):
    id: int
    tokens: List[str] = []
    is_parent: bool = Field(False, alias="isParent")
    group_id: Optional[str] = Field(None, alias="groupId")
    group_name: Optional[str] = Field(None, alias="groupName")
    status: KeywordStatus
    child_count: int = Field(0, alias="childCount")
    blocked_by: Optional[BlockedBy] = None
    serp_features: List[str] = Field([], alias="serpFeatures")

    # Optimized tokens validator
    @field_validator('tokens', mode='before')
    @classmethod
    def parse_json_tokens(cls, v):
        if isinstance(v, str):
            try:
                if not v:
                    return []
                data = json.loads(v)
                if isinstance(data, str):
                    data = json.loads(data)
                return data if isinstance(data, list) else []
            except json.JSONDecodeError:
                return []
        elif isinstance(v, list):
            return v
        return []

    # Optimized serp_features validator
    @field_validator('serp_features', mode='before')
    @classmethod
    def parse_json_serp_features(cls, v):
        if isinstance(v, str):
            try:
                if not v:
                    return []
                data = json.loads(v)
                if isinstance(data, str):
                    data = json.loads(data)
                return data if isinstance(data, list) else []
            except json.JSONDecodeError:
                return []
        elif isinstance(v, list):
            return v
        return []

    model_config = {
        "from_attributes": True,
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
    }

class GroupedKeywordDetail(BaseModel):
    parent: Optional[KeywordResponse] = None 
    children: List[KeywordResponse] = [] 
    
    model_config = {
        "populate_by_name": True,
    }

class PaginationInfo(BaseModel):
    total: int
    page: int
    limit: int
    pages: int

class KeywordListResponse(BaseModel):
    pagination: PaginationInfo
    ungrouped_keywords: List[KeywordResponse] = Field([], alias="ungroupedKeywords")
    grouped_keywords: List[KeywordResponse] = Field([], alias="groupedKeywords")
    blocked_keywords: List[KeywordResponse] = Field([], alias="blockedKeywords")
    confirmed_keywords: List[KeywordResponse] = Field([], alias="confirmedKeywords")
    model_config = {
        "populate_by_name": True,
    }

class KeywordChildrenResponse(BaseModel):
    children: List[KeywordResponse]

class GroupRequest(BaseModel):
    keyword_ids: List[int] = Field(..., alias="keywordIds")
    group_name: str = Field(..., alias="groupName")
    
    model_config = { 
        "populate_by_name": True 
    }

class BlockTokenRequest(BaseModel):
    token: str

class UnblockRequest(BaseModel):
    keyword_ids: List[int] = Field(..., alias="keywordIds")
    
    model_config = { 
        "populate_by_name": True 
    }

class ProcessingStatus(BaseModel):
    status: str
    keyword_count: int = Field(0, alias="keywordCount")
    processed_count: int = Field(0, alias="processedCount")
    skipped_count: int = Field(0, alias="skippedCount")
    keywords: list = Field([], alias="keywords")
    complete: bool = Field(False, alias="complete")
    total_rows: int = Field(0, alias="totalRows")
    progress: float = Field(0.0, alias="progress")
    
    model_config = {
        "populate_by_name": True
    }

# New schemas for optimized endpoints

class ProjectStats(BaseModel):
    ungrouped_count: int = Field(..., alias="ungroupedCount")
    grouped_keywords_count: int = Field(..., alias="groupedKeywordsCount")
    grouped_pages: int = Field(..., alias="groupedPages")
    blocked_count: int = Field(..., alias="blockedCount")
    total_keywords: int = Field(..., alias="totalKeywords")
    ungrouped_percent: float = Field(..., alias="ungroupedPercent")
    grouped_percent: float = Field(..., alias="groupedPercent")
    blocked_percent: float = Field(..., alias="blockedPercent")
    
    model_config = {
        "populate_by_name": True
    }

class ProjectDetail(BaseModel):
    id: int
    name: str
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")
    
    model_config = {
        "populate_by_name": True,
        "from_attributes": True
    }

class KeywordsCacheResponse(BaseModel):
    keywords: List[KeywordResponse]
    timestamp: float
    status: str
    
    model_config = {
        "populate_by_name": True
    }

class InitialDataResponse(BaseModel):
    project: ProjectDetail
    keywords: Dict[str, List[KeywordResponse]]
    stats: ProjectStats
    processing_status: ProcessingStatus = Field(..., alias="processingStatus")
    
    model_config = {
        "populate_by_name": True
    }

# Enhanced response models for token-based operations
class TokenCountResponse(BaseModel):
    count: int
    token: str
    
    model_config = {
        "populate_by_name": True
    }

class TokenOperation(BaseModel):
    token: str
    count: int
    message: str
    
    model_config = {
        "populate_by_name": True
    }

# Models for batch operations
class BatchOperationRequest(BaseModel):
    keyword_ids: List[int] = Field(..., alias="keywordIds")
    operation: str
    parameters: Optional[Dict[str, Any]] = None
    
    model_config = {
        "populate_by_name": True
    }

class BatchOperationResponse(BaseModel):
    success: bool
    message: str
    affected_count: int = Field(..., alias="affectedCount")
    errors: List[str] = []
    
    model_config = {
        "populate_by_name": True
    }

class TokenData(BaseModel):
    tokenName: str
    volume: Optional[int] = None
    difficulty: Optional[float] = None
    count: int
    isParent: bool = False
    hasChildren: bool = False
    childTokens: List[str] = []
    
class TokenListResponse(BaseModel):
    tokens: List[TokenData]
    pagination: PaginationInfo  

class BlockTokensRequest(BaseModel):
    tokens: List[str]

class UnblockTokensRequest(BaseModel):
    tokens: List[str]
    
class MergeTokensRequest(BaseModel):
    parent_token: str
    child_tokens: List[str]

class UnmergeTokenRequest(BaseModel):
    tokenName: str

class CreateTokenRequest(BaseModel):
    search_term: str
    token_name: str