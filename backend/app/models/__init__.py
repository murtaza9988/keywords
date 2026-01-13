# Import all models here to ensure they're registered with SQLAlchemy
from .project import Project
from .keyword import Keyword, KeywordStatus, BlockedBy
from .merge_operation import MergeOperation, KeywordMergeOperation
from .notes import Note
from .csv_upload import CSVUpload
from .project_activity_log import ProjectActivityLog

# Export for easy importing
__all__ = [
    "Project",
    "Keyword", 
    "KeywordStatus", 
    "BlockedBy",
    "MergeOperation",
    "KeywordMergeOperation",
    "Note",
    "CSVUpload",
    "ProjectActivityLog"
]
