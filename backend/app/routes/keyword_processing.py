import asyncio
import csv
import os
import json
import uuid
import unicodedata
import string
import re
import nltk
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from typing import Any, Dict, List, Optional, Set, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text as sql_text
from app.config import settings
from app.database import get_db_context
from app.services.keyword import KeywordService
from app.models.keyword import KeywordStatus
from app.utils.normalization import normalize_numeric_tokens
from nltk.corpus import wordnet

nltk.download('punkt')
nltk.download('stopwords')
nltk.download('wordnet')

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
processing_tasks: Dict[int, str] = {}
processing_results: Dict[int, Dict[str, Any]] = {}
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
        keyword = keyword.strip()
        keyword = keyword.replace("'", "'").replace(""", "\"").replace(""", "\"").replace("–", "-").replace("—", "-")
        keyword = keyword.replace("\\", "")
        keyword = normalize_numeric_tokens(keyword)
        has_non_english = any(
            ord(char) > 127 and unicodedata.category(char).startswith('L')
            for char in keyword
        )
        status = KeywordStatus.blocked if has_non_english else KeywordStatus.ungrouped
        blocked_by = "system" if has_non_english else None
        try:
            tokens = word_tokenize(keyword.lower())
        except Exception as e:
            print(f"Tokenization failed for '{keyword}': {e}")
            tokens = [keyword.lower()]

        lemmatized_tokens = []
        synonym_map = {}
        for token in tokens:
            token_cleaned = token.translate(str.maketrans("", "", EXTENDED_PUNCTUATION))
            token_cleaned = token_cleaned.replace("\\", "")
            if not token_cleaned:
                continue
            
            if any(ord(char) > 127 and unicodedata.category(char).startswith('L') for char in token_cleaned):
                continue
            
            if token_cleaned in question_words:
                lemmatized_tokens.append(token_cleaned)
                continue
                
            if token_cleaned in stop_words and token_cleaned not in question_words:
                continue
            
            verb_lemma = lemmatizer.lemmatize(token_cleaned, pos='v')
            noun_lemma = lemmatizer.lemmatize(token_cleaned, pos='n')
            lemmatized_token = noun_lemma if noun_lemma != token_cleaned else verb_lemma
            
            if lemmatized_token == "tradelines":
                lemmatized_token = "tradeline"
            
            if lemmatized_token in stop_words and lemmatized_token not in question_words:
                continue
                
            synonyms = get_synonyms(lemmatized_token)
            base_token = lemmatized_token
            for syn in synonyms:
                if syn in lemmatized_tokens:
                    base_token = min(syn, lemmatized_token)
                    synonym_map[syn] = base_token
            if lemmatized_token not in synonym_map:
                synonym_map[lemmatized_token] = base_token
                lemmatized_tokens.append(base_token)

        final_tokens = []
        for token in lemmatized_tokens:
            final_tokens.append(synonym_map.get(token, token))
        
        final_tokens = sorted(list(set(final_tokens)))

        volume_str = row_dict.get("Volume")
        difficulty_str = row_dict.get("Difficulty")
        serp_features_str = row_dict.get("SERP Features")
        
        try:
            volume = int(float(str(volume_str).replace(',', ''))) if volume_str is not None and str(volume_str).strip() != '' else 0
        except (ValueError, TypeError):
            volume = 0
        try:
            difficulty = float(difficulty_str) if difficulty_str is not None and str(difficulty_str).strip() != '' else 0.0
        except (ValueError, TypeError):
            difficulty = 0.0
            
        serp_features = []
        if serp_features_str:
            if isinstance(serp_features_str, str):
                serp_features = [f.strip() for f in serp_features_str.split(',') if f.strip()]
            elif isinstance(serp_features_str, list):
                serp_features = serp_features_str
                
        processed_keyword_data = {
            "keyword": keyword,
            "tokens": final_tokens,
            "volume": volume,
            "difficulty": difficulty,
            "status": status,
            "is_parent": False,
            "group_id": None,
            "blocked_by": blocked_by,
            "serp_features": serp_features
        }
        return processed_keyword_data, True
    except Exception as e:
        print(f"Error processing keyword row '{row_dict.get('Keyword')}': {e}")
        return None, False

async def process_csv_file(file_path: str, project_id: int) -> None:
    """Process the CSV file in the background with optimized performance using new merge operations structure."""
    processing_tasks[project_id] = "processing"
    processing_results[project_id] = {
        "processed_count": 0,
        "skipped_count": 0,
        "duplicate_count": 0,
        "keywords": [],
        "complete": False,
        "total_rows": 0,
        "progress": 0.0
    }

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
            
            async def refresh_existing_token_groups() -> Dict[str, str]:
                """Get existing token groups from keywords table (for legacy support)"""
                existing_token_groups = {}
                keywords_query = """
                    SELECT id, group_id, tokens 
                    FROM keywords 
                    WHERE project_id = :project_id 
                    AND group_id IS NOT NULL 
                    AND status = 'grouped'
                """
                result = await db.execute(sql_text(keywords_query), {"project_id": project_id})
                existing_keywords = result.fetchall()                
                for kw in existing_keywords:
                    if kw.group_id and kw.tokens:
                        token_key = json.dumps(sorted(kw.tokens))
                        existing_token_groups[token_key] = kw.group_id
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
                headers = [str(col).strip() for col in headers]
                valid_columns = [col for col in headers if not col.isdigit()]
                
                if not valid_columns:
                    raise ValueError(f"No valid non-numeric column headers found. Found: {headers}")
                
                lower_headers = [h.lower() for h in valid_columns]
                potential_keyword_cols = [i for i, c in enumerate(lower_headers) if 'keyword' in c or 'phrase' in c]
                potential_volume_cols = [i for i, c in enumerate(lower_headers) if 
                    'volume' in c or 'vol' in c or 'search' in c or 
                    c == 'search volume' or c == 'search_volume' or
                    'traffic' in c or 'impressions' in c]
                potential_difficulty_cols = [i for i, c in enumerate(lower_headers) if 
                    'difficulty' in c or 'diff' in c or 'kd' in c or 
                    c == 'overall' or c == 'overall difficulty' or
                    'competition' in c or 'competition level' in c]
                potential_serp_cols = [i for i, c in enumerate(lower_headers) if c == 'serp features']

                if not potential_keyword_cols:
                    raise ValueError(f"CSV must contain a 'keyword' or 'phrase' column. Found: {valid_columns}")
                
                keyword_idx = potential_keyword_cols[0]
                volume_idx = potential_volume_cols[0] if potential_volume_cols else -1
                difficulty_idx = potential_difficulty_cols[0] if potential_difficulty_cols else -1
                serp_idx = potential_serp_cols[0] if potential_serp_cols else -1
                
                for _ in reader:
                    row_count += 1
            
            total_rows = row_count
            processing_results[project_id]["total_rows"] = total_rows
            print(f"Total rows to process: {total_rows}")
            
            if total_rows == 0:
                processing_tasks[project_id] = "complete"
                processing_results[project_id]["complete"] = True
                return
            
            # Processing variables
            batch_size = 200 
            processed_count = 0
            skipped_count = 0
            duplicate_count = 0
            token_groups = {}
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
                                    processing_results[project_id]["duplicate_count"] = duplicate_count
                                    continue
                                
                                seen_keywords.add(keyword_lower)
                                
                                processed_keyword_data["project_id"] = project_id
                                processed_keyword_data["original_volume"] = processed_keyword_data["volume"]
                                token_key = json.dumps(sorted(processed_keyword_data["tokens"]))                            
                                
                                # Check if tokens match existing groups (legacy support)
                                if token_key in existing_token_groups:
                                    processed_keyword_data["group_id"] = existing_token_groups[token_key]
                                    processed_keyword_data["is_parent"] = False
                                    processed_keyword_data["status"] = KeywordStatus.grouped
                                elif token_key in token_groups:
                                    token_groups[token_key].append(processed_keyword_data)
                                else:
                                    token_groups[token_key] = [processed_keyword_data]
                                
                                processed_count += 1
                                chunk_results.append(processed_keyword_data)
                            else:
                                skipped_count += 1
                        
                        # Update progress
                        current_progress = (processed_count + skipped_count + duplicate_count) / total_rows * 100
                        processing_results[project_id]["progress"] = current_progress
                        processing_results[project_id]["processed_count"] = processed_count
                        processing_results[project_id]["skipped_count"] = skipped_count
                        processing_results[project_id]["duplicate_count"] = duplicate_count
                        
                        # Save keywords when batch is full or at end
                        if len(chunk_results) >= batch_size or i == total_rows - 1:
                            final_keywords_to_save = []
                            
                            # Handle keywords going into existing groups
                            keywords_for_existing_groups = [kw for kw in chunk_results if kw.get("group_id") and kw["group_id"] in existing_token_groups.values()]                            
                            for keyword in keywords_for_existing_groups:
                                keyword["original_state"] = json.dumps({
                                    "keyword": keyword["keyword"],
                                    "volume": keyword["original_volume"],
                                    "difficulty": keyword["difficulty"],
                                    "is_parent": keyword["is_parent"],
                                    "group_id": keyword["group_id"],
                                    "status": keyword["status"].value,
                                    "serp_features": keyword.get("serp_features", [])
                                })
                                final_keywords_to_save.append(keyword)
                            
                            # Handle new groups (create keyword groups, not merge operations)
                            for token_key, group_members in token_groups.items():
                                if not group_members:
                                    continue
                                
                                new_group_id = f"group_{project_id}_{uuid.uuid4().hex}"
                                
                                if len(group_members) == 1:
                                    # Single keyword stays ungrouped
                                    keyword = group_members[0]
                                    keyword["is_parent"] = True
                                    keyword["group_id"] = None
                                    keyword["status"] = KeywordStatus.ungrouped
                                    keyword["original_state"] = json.dumps({
                                        "keyword": keyword["keyword"],
                                        "volume": keyword["original_volume"],
                                        "difficulty": keyword["difficulty"],
                                        "is_parent": keyword["is_parent"],
                                        "group_id": keyword["group_id"],
                                        "status": keyword["status"].value,
                                        "serp_features": keyword.get("serp_features", [])
                                    })
                                    final_keywords_to_save.append(keyword)
                                else:
                                    # Multi-keyword group
                                    group_members.sort(key=lambda k: (k.get("volume", 0), -(k.get("difficulty", 0))), reverse=True)
                                    total_volume = sum(k.get("volume", 0) for k in group_members)
                                    difficulties = [k.get("difficulty", 0) for k in group_members if k.get("difficulty") is not None]
                                    avg_difficulty = sum(difficulties) / len(difficulties) if difficulties else 0.0
                                    
                                    for j, keyword in enumerate(group_members):
                                        keyword["group_id"] = new_group_id
                                        keyword["status"] = KeywordStatus.grouped
                                        if j == 0:
                                            keyword["is_parent"] = True
                                            keyword["volume"] = total_volume
                                            keyword["difficulty"] = round(avg_difficulty, 2)
                                        else:
                                            keyword["is_parent"] = False
                                            keyword["volume"] = keyword["original_volume"]
                                        
                                        keyword["original_state"] = json.dumps({
                                            "keyword": keyword["keyword"],
                                            "volume": keyword["original_volume"],
                                            "difficulty": keyword["difficulty"],
                                            "is_parent": keyword["is_parent"],
                                            "group_id": keyword["group_id"],
                                            "status": keyword["status"].value,
                                            "serp_features": keyword.get("serp_features", [])
                                        })
                                        final_keywords_to_save.append(keyword)
                            
                            # Save keywords to database
                            if final_keywords_to_save:
                                await KeywordService.create_many(db, final_keywords_to_save)
                                
                                # Update existing group parents if needed
                                affected_group_ids = {kw["group_id"] for kw in final_keywords_to_save if kw["group_id"] in existing_token_groups.values()}
                                for group_id in affected_group_ids:
                                    await KeywordService.update_group_parent(db, project_id, group_id)
                                await db.commit()
                                
                                # Refresh existing groups for next iteration
                                existing_token_groups = await refresh_existing_token_groups()                                
                                token_groups.clear()
                                
                                processing_results[project_id]["keywords"] = final_keywords_to_save[-50:]
                            
                            await asyncio.sleep(0.005)
                        
                        current_chunk = []
            
            # Mark processing as complete
            processing_results[project_id]["complete"] = True
            processing_results[project_id]["progress"] = 100.0
            processing_tasks[project_id] = "complete"
            
            # Final grouping pass for any remaining ungrouped keywords
            await group_remaining_ungrouped_keywords(db, project_id)

            # Clean up temporary index
            drop_index_query = f"DROP INDEX IF EXISTS temp_tokens_idx_{project_id}"
            await db.execute(sql_text(drop_index_query))
            await db.commit()

    except Exception as e:
        print(f"Error during CSV processing for project {project_id}: {e}")
        import traceback
        traceback.print_exc()
        processing_tasks[project_id] = "error"
        processing_results[project_id]["complete"] = True
        processing_results[project_id]["progress"] = 0.0
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
                                is_parent = :is_parent,
                                volume = :volume,
                                difficulty = :difficulty,
                                status = :status
                            WHERE id = :id
                        """
                        await db.execute(sql_text(update_query), {
                            'id': update['id'],
                            'group_id': update['group_id'],
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
    return processing_tasks.get(project_id, "not_started")

def get_processing_results(project_id: int) -> Dict[str, Any]:
    return processing_results.get(project_id, {
        "processed_count": 0,
        "skipped_count": 0,
        "duplicate_count": 0,
        "keywords": [],
        "complete": False,
        "total_rows": 0,
        "progress": 0.0
    })

def cleanup_processing_data(project_id: int) -> None:
    """Clean up processing data for a project."""
    if project_id in processing_tasks:
        del processing_tasks[project_id]
    if project_id in processing_results:
        del processing_results[project_id]
