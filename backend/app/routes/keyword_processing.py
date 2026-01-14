import asyncio
import csv
import os
import json
import uuid
from collections import deque
import unicodedata
import string
import re
import nltk
from nltk import data as nltk_data
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from typing import Any, Dict, List, Optional, Set, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text as sql_text
from app.config import settings
from app.database import get_db_context
from app.services.keyword import KeywordService
from nltk.tokenize import word_tokenize
from app.services.keyword_processing import (
    apply_stopwords,
    build_keyword_payload,
    get_synonyms,
    lemmatizer,
    lemmatize,
    map_synonyms,
    normalize_text,
    parse_metrics,
    stop_words,
    tokenize,
)
from app.models.keyword import KeywordStatus

processing_tasks: Dict[int, str] = {}
processing_results: Dict[int, Dict[str, Any]] = {}
processing_queue: Dict[int, deque] = {}
processing_current_files: Dict[int, Dict[str, str]] = {}
from app.services.processing_queue import processing_queue_service
from app.models.keyword import KeywordStatus
from app.utils.token_normalization import normalize_compound_tokens
from app.utils.normalization import normalize_numeric_tokens
from app.utils.compound_normalization import normalize_compound_tokens
from nltk.corpus import wordnet

REQUIRED_NLTK_RESOURCES = {
    "punkt": "tokenizers/punkt",
    "stopwords": "corpora/stopwords",
    "wordnet": "corpora/wordnet",
}


def _verify_nltk_resources() -> None:
    def _resource_present(resource_path: str) -> bool:
        try:
            nltk_data.find(resource_path)
            return True
        except LookupError:
            # Some environments keep corpora as `<resource>.zip` (e.g. wordnet.zip).
            try:
                nltk_data.find(f"{resource_path}.zip")
                return True
            except LookupError:
                return False

    missing = []
    for resource_name, resource_path in REQUIRED_NLTK_RESOURCES.items():
        if not _resource_present(resource_path):
            missing.append(resource_name)
    if missing:
        missing_list = ", ".join(sorted(missing))
        raise RuntimeError(
            "NLTK resources missing: "
            f"{missing_list}. Run `python -m app.scripts.setup_nltk` "
            "or start the API to download them."
        )


_verify_nltk_resources()

nltk_stop_words = set(stopwords.words('english'))
custom_stop_words_list = [
    'about', 'above', 'across', 'after', 'against', 'along', 'among', 'around', 'at', 'before',
    'behind', 'below', 'beneath', 'beside', 'between', 'beyond', 'by', 'down', 'during', 'except',
    'for', 'from', 'in', 'inside', 'into', 'like', 'near', 'of', 'off', 'on', 'onto', 'outside',
    'over', 'since', 'through', 'throughout', 'till', 'to', 'toward', 'under', 'until', 'up',
    'upon', 'with', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
    'had', 'having', 'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'may', 'might',
    'can', 'could', 'must', 'ought', 'very', 'really', 'quite', 'rather', 'somewhat', 'too',
    'so', 'more', 'most', 'less', 'least', 'much', 'many', 'few', 'little', 'well', 'better',
    'best', 'worse', 'worst', 'here', 'there', 'now', 'then', 'today', 'yesterday', 'tomorrow',
    'always', 'never', 'sometimes', 'often', 'usually', 'rarely', 'seldom', 'again', 'still',
    'yet', 'already', 'just', 'only', 'also', 'even', 'almost', 'nearly', 'quite', 'rather',
    'pretty', 'fairly', 'actually', 'basically', 'essentially', 'fundamentally', 'generally',
    'normally', 'typically', 'usually', 'often', 'sometimes', 'rarely', 'never', 'always',
    'definitely', 'certainly', 'probably', 'possibly', 'maybe', 'perhaps', 'obviously',
    'clearly', 'apparently', 'supposedly', 'allegedly', 'all', 'any', 'both', 'each', 'every',
    'few', 'many', 'much', 'no', 'none', 'one', 'several', 'some', 'such', 'another', 'other',
    'either', 'neither', 'enough', 'little', 'less', 'more', 'most', 'own', 'same', 'and',
    'but', 'or', 'nor', 'yet', 'oh', 'ah', 'um', 'uh', 'well', 'yes', 'no', 'okay', 'ok',
    'sure', 'right'
]
stop_words = nltk_stop_words.union(set(custom_stop_words_list))
lemmatizer = WordNetLemmatizer()

EXTENDED_PUNCTUATION = string.punctuation + "®–—™"
question_words = {'what', 'why', 'how', 'when', 'where', 'who', 'which', 'whose', 'whom','can'}

def get_synonyms(word: str) -> Set[str]:
    synonyms = set()
    for syn in wordnet.synsets(word):
        for lemma in syn.lemmas():
            synonym = lemma.name().lower().replace('_', ' ')
            synonyms.add(synonym)
    return synonyms

def process_keyword(row_dict: Dict[str, Any]) -> Tuple[Optional[Dict[str, Any]], bool]:
    try:
        keyword = row_dict.get("Keyword")
        if not keyword or not isinstance(keyword, str) or len(keyword.strip()) == 0:
            return None, False
        keyword = normalize_text(keyword)
        tokens = tokenize(keyword, tokenizer=word_tokenize)
        lemmatized_tokens = lemmatize(
            tokens,
            lemmatizer_override=lemmatizer,
            stop_words_override=stop_words,
        )
        lemmatized_tokens = apply_stopwords(
            lemmatized_tokens,
            stop_words_override=stop_words,
        )
        final_tokens = map_synonyms(lemmatized_tokens)
        metrics = parse_metrics(row_dict)
        processed_keyword_data = build_keyword_payload(
            keyword,
            final_tokens,
            metrics,
        )
        return processed_keyword_data, True
    except Exception as e:
        print(f"Error processing keyword row '{row_dict.get('Keyword')}': {e}")
        return None, False

def enqueue_processing_file(
    project_id: int,
    file_path: str,
    file_name: str,
    *,
    file_names: Optional[List[str]] = None,
) -> None:
    processing_queue_service.enqueue(
        project_id,
        file_path,
        file_name,
        file_names=file_names,
    )

async def start_next_processing(project_id: int) -> None:
    next_item = processing_queue_service.start_next(project_id)
    if not next_item:
        return
    processing_queue_service.start_file_processing(
        project_id,
        message=f"Processing {next_item.get('file_name')}" if next_item.get("file_name") else "Processing CSV",
    )
    asyncio.create_task(
        process_csv_file(
            next_item["file_path"],
            project_id,
            next_item.get("file_name"),
            file_names=next_item.get("file_names"),
        )
    )

async def process_csv_file(
    file_path: str,
    project_id: int,
    file_name: Optional[str] = None,
    *,
    file_names: Optional[List[str]] = None,
) -> None:
    """Process the CSV file in the background with optimized performance using new merge operations structure."""
    processing_queue_service.start_file_processing(
        project_id,
        message=f"Processing {file_name}" if file_name else "Processing CSV",
    )
    processing_queue_service.update_progress(
        project_id,
        processed_count=0,
        skipped_count=0,
        duplicate_count=0,
        progress=0.0,
        total_rows=0,
        keywords=[],
        message=f"Processing {file_name}" if file_name else "Processing CSV",
    )

    try:
        async with get_db_context() as db:
            # Create temporary index for performance
            index_query = f"""
                CREATE INDEX IF NOT EXISTS temp_tokens_idx_{project_id} ON keywords 
                USING gin(tokens) 
                WHERE project_id = {project_id}
            """
            await db.execute(sql_text(index_query))
            await db.commit()            
            
            async def refresh_existing_token_groups() -> Dict[str, Dict[str, str]]:
                """
                Get existing grouped parents keyed by token set.
                We only need parent rows so we can also derive a stable display group_name.
                """
                existing_token_groups: Dict[str, Dict[str, str]] = {}
                keywords_query = """
                    SELECT group_id, group_name, keyword, tokens
                    FROM keywords
                    WHERE project_id = :project_id
                      AND group_id IS NOT NULL
                      AND status = 'grouped'
                      AND is_parent = TRUE
                """
                result = await db.execute(sql_text(keywords_query), {"project_id": project_id})
                existing_parents = result.fetchall()
                for kw in existing_parents:
                    if kw.group_id and kw.tokens:
                        token_key = json.dumps(sorted(kw.tokens))
                        display_name = kw.group_name or kw.keyword
                        existing_token_groups[token_key] = {
                            "group_id": kw.group_id,
                            "group_name": display_name,
                        }
                return existing_token_groups
            
            existing_token_groups = await refresh_existing_token_groups()
            
            # Get existing keywords to avoid duplicates
            existing_keywords_query = """
                SELECT keyword
                FROM keywords
                WHERE project_id = :project_id
            """
            result = await db.execute(sql_text(existing_keywords_query), {"project_id": project_id})
            existing_keyword_texts = {row[0].lower() for row in result.fetchall()}
            
            # Detect file encoding and delimiter
            detected_encoding = None
            detected_delimiter = None
            encodings_to_try = ['utf-8', 'utf-16', 'utf-16-le', 'utf-16-be', 'latin-1', 'iso-8859-1', 'cp1252']
            for encoding in encodings_to_try:
                try:
                    with open(file_path, 'r', encoding=encoding) as f:
                        sample = f.read(4096)
                        try:
                            dialect = csv.Sniffer().sniff(sample)
                            detected_delimiter = dialect.delimiter
                            detected_encoding = encoding
                            break
                        except csv.Error:
                            detected_delimiter = ','
                            detected_encoding = encoding
                            break
                except UnicodeDecodeError:
                    continue
                except Exception as e:
                    print(f"Error with encoding {encoding}: {e}")
                    continue
            
            if not detected_encoding:
                detected_encoding = 'utf-8'
                detected_delimiter = ','
            
            # Count total rows
            row_count = 0
            with open(file_path, 'r', encoding=detected_encoding) as f:
                reader = csv.reader(f, delimiter=detected_delimiter)
                headers = next(reader)
                headers = [str(col).strip().lstrip("\ufeff") for col in headers]

                # IMPORTANT: keep ORIGINAL header indexes to avoid index drift.
                searchable_headers = [
                    (idx, header)
                    for idx, header in enumerate(headers)
                    if header and not header.isdigit()
                ]
                if not searchable_headers:
                    raise ValueError(f"No valid non-numeric column headers found. Found: {headers}")

                lower_headers = [(idx, header.lower()) for idx, header in searchable_headers]
                potential_keyword_cols = [idx for idx, c in lower_headers if "keyword" in c or "phrase" in c]
                potential_volume_cols = [
                    idx
                    for idx, c in lower_headers
                    if "volume" in c
                    or "vol" in c
                    or "search" in c
                    or c == "search volume"
                    or c == "search_volume"
                    or "traffic" in c
                    or "impressions" in c
                ]
                potential_difficulty_cols = [
                    idx
                    for idx, c in lower_headers
                    if "difficulty" in c
                    or "diff" in c
                    or "kd" in c
                    or c == "overall"
                    or c == "overall difficulty"
                    or "competition" in c
                    or "competition level" in c
                ]
                potential_serp_cols = [idx for idx, c in lower_headers if c == "serp features"]

                if not potential_keyword_cols:
                    available_headers = [h for _, h in searchable_headers]
                    raise ValueError(
                        "CSV must contain a 'keyword' or 'phrase' column. "
                        f"Found: {available_headers}"
                    )

                keyword_idx = potential_keyword_cols[0]
                volume_idx = potential_volume_cols[0] if potential_volume_cols else -1
                difficulty_idx = potential_difficulty_cols[0] if potential_difficulty_cols else -1
                serp_idx = potential_serp_cols[0] if potential_serp_cols else -1
                
                for _ in reader:
                    row_count += 1
            
            total_rows = row_count
            processing_queue_service.update_progress(
                project_id,
                processed_count=0,
                skipped_count=0,
                duplicate_count=0,
                progress=0.0,
                total_rows=total_rows,
            )
            print(f"Total rows to process: {total_rows}")
            
            if total_rows == 0:
                processing_queue_service.mark_complete(
                    project_id,
                    message=f"No rows found in {file_name}" if file_name else "No rows found in CSV",
                )
                return
            
            # Processing variables
            batch_size = 200 
            processed_count = 0
            skipped_count = 0
            duplicate_count = 0
            seen_keywords = set()
            
            # Process the CSV file
            with open(file_path, 'r', encoding=detected_encoding) as f:
                reader = csv.reader(f, delimiter=detected_delimiter)
                next(reader)  # Skip headers
                
                current_chunk = []
                for i, row in enumerate(reader):
                    if len(row) < len(headers):
                        row.extend([''] * (len(headers) - len(row)))
                    
                    row_dict_std = {
                        "Keyword": row[keyword_idx] if keyword_idx < len(row) else '',
                        "Volume": row[volume_idx] if volume_idx >= 0 and volume_idx < len(row) else None,
                        "Difficulty": row[difficulty_idx] if difficulty_idx >= 0 and difficulty_idx < len(row) else None,
                        "SERP Features": row[serp_idx] if serp_idx >= 0 and serp_idx < len(row) else None
                    }
                    
                    current_chunk.append(row_dict_std)
                    if len(current_chunk) >= batch_size or i == total_rows - 1:
                        chunk_results = []
                        
                        # Process each row in the chunk
                        for row_data in current_chunk:
                            processed_keyword_data, success = process_keyword(row_data)
                            if success and processed_keyword_data:
                                keyword_lower = processed_keyword_data["keyword"].lower()
                                
                                # Check for duplicates
                                if keyword_lower in existing_keyword_texts or keyword_lower in seen_keywords:
                                    duplicate_count += 1
                                    processing_queue_service.update_progress(
                                        project_id,
                                        processed_count=processed_count,
                                        skipped_count=skipped_count,
                                        duplicate_count=duplicate_count,
                                        progress=(processed_count + skipped_count + duplicate_count)
                                        / total_rows
                                        * 100,
                                    )
                                    continue
                                
                                seen_keywords.add(keyword_lower)
                                
                                processed_keyword_data["project_id"] = project_id
                                processed_keyword_data["original_volume"] = processed_keyword_data["volume"]
                                token_key = json.dumps(sorted(processed_keyword_data["tokens"]))

                                # Attach to an existing group (cross-file clustering)
                                existing_group = existing_token_groups.get(token_key)
                                if existing_group:
                                    processed_keyword_data["group_id"] = existing_group["group_id"]
                                    processed_keyword_data["group_name"] = existing_group["group_name"]
                                    processed_keyword_data["is_parent"] = False
                                    processed_keyword_data["status"] = KeywordStatus.grouped
                                else:
                                    # Default: import as an ungrouped parent keyword.
                                    processed_keyword_data["group_id"] = None
                                    processed_keyword_data["group_name"] = None
                                    processed_keyword_data["is_parent"] = True
                                    processed_keyword_data["status"] = KeywordStatus.ungrouped
                                
                                processed_count += 1
                                chunk_results.append(processed_keyword_data)
                            else:
                                skipped_count += 1
                        
                        # Update progress
                        current_progress = (processed_count + skipped_count + duplicate_count) / total_rows * 100
                        processing_queue_service.update_progress(
                            project_id,
                            processed_count=processed_count,
                            skipped_count=skipped_count,
                            duplicate_count=duplicate_count,
                            progress=current_progress,
                        )
                        
                        # Save keywords when batch is full or at end
                        if len(chunk_results) >= batch_size or i == total_rows - 1:
                            final_keywords_to_save = list(chunk_results)

                            if final_keywords_to_save:
                                await KeywordService.create_many(db, final_keywords_to_save)

                                # Update existing group parents if we appended children.
                                affected_group_ids = {
                                    kw["group_id"]
                                    for kw in final_keywords_to_save
                                    if kw.get("group_id")
                                }
                                for group_id in affected_group_ids:
                                    await KeywordService.update_group_parent(db, project_id, group_id)
                                await db.commit()

                                # Refresh existing groups for next iteration (helps later chunks attach).
                                existing_token_groups = await refresh_existing_token_groups()

                                processing_queue_service.update_progress(
                                    project_id,
                                    processed_count=processed_count,
                                    skipped_count=skipped_count,
                                    duplicate_count=duplicate_count,
                                    progress=current_progress,
                                    keywords=final_keywords_to_save[-50:],
                                )
                            
                            await asyncio.sleep(0.005)
                        
                        current_chunk = []
            
            # Final grouping pass for any remaining ungrouped keywords (global clustering)
            await group_remaining_ungrouped_keywords(db, project_id)

            # Clean up temporary index
            drop_index_query = f"DROP INDEX IF EXISTS temp_tokens_idx_{project_id}"
            await db.execute(sql_text(drop_index_query))
            await db.commit()

            # Mark processing as complete after final grouping and cleanup
            remaining_queue = processing_queue_service.get_queue(project_id)
            processing_queue_service.mark_complete(
                project_id,
                message=f"Completed processing {file_name}" if file_name else "Processing complete.",
                file_name=file_name,
                file_names=file_names,
                has_more_in_queue=len(remaining_queue) > 0,
            )

    except Exception as e:
        print(f"Error during CSV processing for project {project_id}: {e}")
        import traceback
        traceback.print_exc()
        processing_queue_service.mark_error(
            project_id,
            message=f"Failed processing {file_name}: {e}" if file_name else f"Failed processing CSV: {e}",
        )
        try:
            async with get_db_context() as db:
                drop_index_query = f"DROP INDEX IF EXISTS temp_tokens_idx_{project_id}"
                await db.execute(sql_text(drop_index_query))
                await db.commit()
        except Exception as cleanup_error:
            print(f"Error during cleanup: {cleanup_error}")
    finally:
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
                print(f"Removed temporary file: {file_path}")
            except OSError as e:
                print(f"Error removing file {file_path}: {e}")
        await start_next_processing(project_id)

async def group_remaining_ungrouped_keywords(db: AsyncSession, project_id: int) -> None:
    """Group any remaining ungrouped keywords with identical tokens."""
    try:
        ungrouped_keywords_query = """
            SELECT id, keyword, tokens, volume, difficulty, serp_features, original_volume
            FROM keywords 
            WHERE project_id = :project_id 
            AND status = 'ungrouped'
            ORDER BY volume DESC, difficulty ASC
        """
        result = await db.execute(sql_text(ungrouped_keywords_query), {"project_id": project_id})
        all_ungrouped_keywords = result.fetchall()
        
        if all_ungrouped_keywords:
            token_groups_final = {}
            for kw in all_ungrouped_keywords:
                if kw.tokens:
                    token_key = json.dumps(sorted(kw.tokens))
                    if token_key not in token_groups_final:
                        token_groups_final[token_key] = []
                    token_groups_final[token_key].append({
                        'id': kw.id,
                        'keyword': kw.keyword,
                        'tokens': kw.tokens,
                        'volume': kw.volume,
                        'difficulty': kw.difficulty,
                        'serp_features': kw.serp_features,
                        'original_volume': kw.original_volume or kw.volume
                    })
            
            # Create groups for keywords with identical tokens
            updates_to_apply = []
            for token_key, group_members in token_groups_final.items():
                if len(group_members) > 1:
                    group_members.sort(key=lambda k: (k['volume'], -k['difficulty']), reverse=True)
                    
                    new_group_id = f"group_{project_id}_{uuid.uuid4().hex}"
                    group_name = group_members[0]["keyword"]
                    total_volume = sum(k['volume'] for k in group_members)
                    difficulties = [k['difficulty'] for k in group_members if k['difficulty'] is not None]
                    avg_difficulty = sum(difficulties) / len(difficulties) if difficulties else 0.0
                    
                    for i, keyword_data in enumerate(group_members):
                        is_parent = (i == 0)
                        volume_to_use = total_volume if is_parent else keyword_data['original_volume']
                        difficulty_to_use = round(avg_difficulty, 2) if is_parent else keyword_data['difficulty']
                        
                        updates_to_apply.append({
                            'id': keyword_data['id'],
                            'group_id': new_group_id,
                            'group_name': group_name,
                            'is_parent': is_parent,
                            'volume': volume_to_use,
                            'difficulty': difficulty_to_use,
                            'status': KeywordStatus.grouped.value
                        })
            
            # Apply updates in batches
            if updates_to_apply:
                batch_size = 100
                for i in range(0, len(updates_to_apply), batch_size):
                    batch = updates_to_apply[i:i + batch_size]
                    
                    for update in batch:
                        update_query = """
                            UPDATE keywords 
                            SET group_id = :group_id, 
                                group_name = :group_name,
                                is_parent = :is_parent,
                                volume = :volume,
                                difficulty = :difficulty,
                                status = :status
                            WHERE id = :id
                        """
                        await db.execute(sql_text(update_query), {
                            'id': update['id'],
                            'group_id': update['group_id'],
                            'group_name': update['group_name'],
                            'is_parent': update['is_parent'],
                            'volume': update['volume'],
                            'difficulty': update['difficulty'],
                            'status': update['status']
                        })
                    
                    await db.commit()
                    await asyncio.sleep(0.01)
    except Exception as e:
        print(f"Error grouping remaining ungrouped keywords: {e}")
        import traceback
        traceback.print_exc()

# Status check functions (unchanged)
def get_processing_status(project_id: int) -> str:
    return processing_queue_service.get_status(project_id)

def get_processing_results(project_id: int) -> Dict[str, Any]:
    return processing_queue_service.get_result(project_id)

def cleanup_processing_data(project_id: int) -> None:
    """Clean up processing data for a project."""
    processing_queue_service.cleanup(project_id)
