import time
from typing import Dict

keyword_cache: Dict[int, Dict[str, Dict]] = {}
keyword_cache_timestamp: Dict[int, float] = {}
CACHE_TTL = 300 

async def cleanup_old_caches():
    """Remove expired caches to prevent memory leaks."""
    current_time = time.time()
    
    for project_id in list(keyword_cache_timestamp.keys()):
        if current_time - keyword_cache_timestamp[project_id] > CACHE_TTL:
            if project_id in keyword_cache:
                del keyword_cache[project_id]
            del keyword_cache_timestamp[project_id]