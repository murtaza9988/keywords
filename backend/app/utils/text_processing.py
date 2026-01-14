import re
import json
from typing import Dict, List, Tuple, Any
import nltk
from nltk.tokenize import word_tokenize
from nltk.stem import LancasterStemmer
from app.utils.normalization import normalize_numeric_tokens

from app.utils.compound_normalization import normalize_compound_tokens

# Download necessary NLTK resources
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')

# Lancaster stemmer for lemmatization
stemmer = LancasterStemmer()

def is_english(text: str) -> bool:
    """Check if a text is English-like."""
    if not text:
        return False
    # Simple check for non-English characters
    return bool(re.match(r'^[A-Za-z0-9\s.,\'"!?-]*$', text))

def tokenize_and_lemmatize(keyword: str) -> Tuple[List[str], List[str]]:
    """Tokenize and lemmatize a keyword."""
    if not keyword:
        return [], []
    
    try:
        keyword = normalize_numeric_tokens(keyword)
        # Tokenize
        tokens = word_tokenize(keyword.lower())
        tokens = normalize_compound_tokens(tokens)

        # Lemmatize (using stemming as a simple approach)
        lemmatized_tokens = [stemmer.stem(token) for token in tokens]
        
        return tokens, lemmatized_tokens
    except Exception as e:
        print(f"Error processing keyword '{keyword}': {e}")
        return [], []

def get_token_key(lemmatized_tokens: List[str]) -> str:
    """Get a sorted token key for grouping similar keywords."""
    if not lemmatized_tokens:
        return ""
    
    return "|".join(sorted(lemmatized_tokens))

def process_keyword(keyword_data: Dict[str, Any]) -> Tuple[Dict[str, Any], bool]:
    """Process a keyword row from CSV."""
    try:
        # Validate and extract keyword
        keyword = keyword_data.get("Keyword", "").strip()
        if not keyword or not is_english(keyword):
            return None, False
        
        # Process numerical values
        volume = int(keyword_data.get("Volume", 0) or 0)
        difficulty = float(keyword_data.get("Difficulty", 0) or 0)
        cpc = float(keyword_data.get("CPC", 0) or 0)
        cps = float(keyword_data.get("CPS", 0) or 0)
        global_volume = int(keyword_data.get("Global volume", 0) or 0)
        traffic_potential = float(keyword_data.get("Traffic potential", 0) or 0)
        global_traffic_potential = float(keyword_data.get("Global traffic potential", 0) or 0)
        
        # Process text fields
        country = keyword_data.get("Country", "")
        parent_keyword = keyword_data.get("Parent Keyword", "")
        last_update = keyword_data.get("Last Update", "")
        serp_features = keyword_data.get("SERP Features", "")
        first_seen = keyword_data.get("First seen", "")
        intents = keyword_data.get("Intents", "")
        
        # Tokenize and lemmatize
        tokens, lemmatized_tokens = tokenize_and_lemmatize(keyword)
        token_key = get_token_key(lemmatized_tokens)
        
        # Create processed data
        processed = {
            "keyword": keyword,
            "country": country,
            "difficulty": difficulty,
            "volume": volume,
            "cpc": cpc,
            "cps": cps,
            "parentKeyword": parent_keyword,
            "lastUpdate": last_update,
            "serpFeatures": serp_features,
            "globalVolume": global_volume,
            "trafficPotential": traffic_potential,
            "globalTrafficPotential": global_traffic_potential,
            "firstSeen": first_seen,
            "intents": intents,
            "tokens": tokens,
            "lemmatizedTokens": lemmatized_tokens,
            "tokenKey": token_key,
            "isParent": False,
            "groupId": ""
        }
        
        return processed, True
        
    except Exception as e:
        print(f"Error processing keyword data: {e}")
        return None, False
