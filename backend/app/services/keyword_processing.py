import string
import unicodedata
from typing import Any, Callable, Dict, List, Set

import nltk
from nltk.corpus import stopwords, wordnet
from nltk.stem import WordNetLemmatizer
from nltk.tokenize import word_tokenize

from app.models.keyword import KeywordStatus
from app.utils.compound_normalization import normalize_compound_tokens
from app.utils.normalization import normalize_numeric_tokens

nltk.download("punkt")
nltk.download("stopwords")
nltk.download("wordnet")

EXTENDED_PUNCTUATION = string.punctuation + "®–—™"
QUESTION_WORDS = {"what", "why", "how", "when", "where", "who", "which", "whose", "whom", "can"}

_CUSTOM_STOP_WORDS = {
    "about",
    "above",
    "across",
    "after",
    "against",
    "along",
    "among",
    "around",
    "at",
    "before",
    "behind",
    "below",
    "beneath",
    "beside",
    "between",
    "beyond",
    "by",
    "down",
    "during",
    "except",
    "for",
    "from",
    "in",
    "inside",
    "into",
    "like",
    "near",
    "of",
    "off",
    "on",
    "onto",
    "outside",
    "over",
    "since",
    "through",
    "throughout",
    "till",
    "to",
    "toward",
    "under",
    "until",
    "up",
    "upon",
    "with",
    "am",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "having",
    "do",
    "does",
    "did",
    "will",
    "would",
    "shall",
    "should",
    "may",
    "might",
    "can",
    "could",
    "must",
    "ought",
    "very",
    "really",
    "quite",
    "rather",
    "somewhat",
    "too",
    "so",
    "more",
    "most",
    "less",
    "least",
    "much",
    "many",
    "few",
    "little",
    "well",
    "better",
    "best",
    "worse",
    "worst",
    "here",
    "there",
    "now",
    "then",
    "today",
    "yesterday",
    "tomorrow",
    "always",
    "never",
    "sometimes",
    "often",
    "usually",
    "rarely",
    "seldom",
    "again",
    "still",
    "yet",
    "already",
    "just",
    "only",
    "also",
    "even",
    "almost",
    "nearly",
    "pretty",
    "fairly",
    "actually",
    "basically",
    "essentially",
    "fundamentally",
    "generally",
    "normally",
    "typically",
    "definitely",
    "certainly",
    "probably",
    "possibly",
    "maybe",
    "perhaps",
    "obviously",
    "clearly",
    "apparently",
    "supposedly",
    "allegedly",
    "all",
    "any",
    "both",
    "each",
    "every",
    "no",
    "none",
    "one",
    "several",
    "some",
    "such",
    "another",
    "other",
    "either",
    "neither",
    "enough",
    "own",
    "same",
    "and",
    "but",
    "or",
    "nor",
    "yet",
    "oh",
    "ah",
    "um",
    "uh",
    "yes",
    "no",
    "okay",
    "ok",
    "sure",
    "right",
}

stop_words = set(stopwords.words("english")).union(_CUSTOM_STOP_WORDS)
lemmatizer = WordNetLemmatizer()


def _has_non_english_letters(text: str) -> bool:
    return any(
        ord(char) > 127 and unicodedata.category(char).startswith("L")
        for char in text
    )


def get_synonyms(word: str) -> Set[str]:
    synonyms = set()
    for syn in wordnet.synsets(word):
        for lemma in syn.lemmas():
            synonym = lemma.name().lower().replace("_", " ")
            synonyms.add(synonym)
    return synonyms


def normalize_text(keyword: str) -> str:
    cleaned = keyword.strip()
    cleaned = (
        cleaned.replace("'", "'")
        .replace("“", '"')
        .replace("”", '"')
        .replace("–", "-")
        .replace("—", "-")
    )
    cleaned = cleaned.replace("\\", "")
    cleaned = normalize_numeric_tokens(cleaned)
    return cleaned


def tokenize(
    keyword: str,
    tokenizer: Callable[[str], List[str]] | None = None,
) -> List[str]:
    try:
        tokenize_fn = tokenizer or word_tokenize
        tokens = tokenize_fn(keyword.lower())
    except Exception as exc:  # pragma: no cover - best effort fallback
        print(f"Tokenization failed for '{keyword}': {exc}")
        tokens = [keyword.lower()]
    return normalize_compound_tokens(tokens)


def apply_stopwords(
    tokens: List[str],
    stop_words_override: Set[str] | None = None,
) -> List[str]:
    active_stop_words = stop_words_override or stop_words
    return [
        token
        for token in tokens
        if token and (token not in active_stop_words or token in QUESTION_WORDS)
    ]


def lemmatize(
    tokens: List[str],
    lemmatizer_override: WordNetLemmatizer | None = None,
    stop_words_override: Set[str] | None = None,
) -> List[str]:
    active_lemmatizer = lemmatizer_override or lemmatizer
    active_stop_words = stop_words_override or stop_words
    lemmatized_tokens: List[str] = []
    for token in tokens:
        token_cleaned = token.translate(str.maketrans("", "", EXTENDED_PUNCTUATION))
        token_cleaned = token_cleaned.replace("\\", "")
        if not token_cleaned:
            continue
        if _has_non_english_letters(token_cleaned):
            continue
        if token_cleaned in QUESTION_WORDS:
            lemmatized_tokens.append(token_cleaned)
            continue
        if token_cleaned not in apply_stopwords(
            [token_cleaned], stop_words_override=active_stop_words
        ):
            continue
        verb_lemma = active_lemmatizer.lemmatize(token_cleaned, pos="v")
        noun_lemma = active_lemmatizer.lemmatize(token_cleaned, pos="n")
        lemmatized_token = noun_lemma if noun_lemma != token_cleaned else verb_lemma
        if lemmatized_token == "tradelines":
            lemmatized_token = "tradeline"
        if lemmatized_token not in apply_stopwords(
            [lemmatized_token], stop_words_override=active_stop_words
        ):
            continue
        lemmatized_tokens.append(lemmatized_token)
    return lemmatized_tokens


def map_synonyms(tokens: List[str]) -> List[str]:
    synonym_map: Dict[str, str] = {}
    mapped_tokens: List[str] = []
    for token in tokens:
        synonyms = get_synonyms(token)
        base_token = token
        for synonym in synonyms:
            if synonym in mapped_tokens:
                base_token = min(synonym, token)
                synonym_map[synonym] = base_token
        if token not in synonym_map:
            synonym_map[token] = base_token
            mapped_tokens.append(base_token)
    final_tokens = [synonym_map.get(token, token) for token in mapped_tokens]
    return sorted(set(final_tokens))


def parse_metrics(row_dict: Dict[str, Any]) -> Dict[str, Any]:
    volume_str = row_dict.get("Volume")
    difficulty_str = row_dict.get("Difficulty")
    serp_features_str = row_dict.get("SERP Features")

    try:
        volume = (
            int(float(str(volume_str).replace(",", "")))
            if volume_str is not None and str(volume_str).strip() != ""
            else 0
        )
    except (ValueError, TypeError):
        volume = 0
    try:
        difficulty = (
            float(difficulty_str)
            if difficulty_str is not None and str(difficulty_str).strip() != ""
            else 0.0
        )
    except (ValueError, TypeError):
        difficulty = 0.0

    serp_features: List[str] = []
    if serp_features_str:
        if isinstance(serp_features_str, str):
            serp_features = [f.strip() for f in serp_features_str.split(",") if f.strip()]
        elif isinstance(serp_features_str, list):
            serp_features = serp_features_str

    return {
        "volume": volume,
        "difficulty": difficulty,
        "serp_features": serp_features,
    }


def build_keyword_payload(
    keyword: str,
    tokens: List[str],
    metrics: Dict[str, Any],
) -> Dict[str, Any]:
    has_non_english = _has_non_english_letters(keyword)
    status = KeywordStatus.blocked if has_non_english else KeywordStatus.ungrouped
    blocked_by = "system" if has_non_english else None
    return {
        "keyword": keyword,
        "tokens": tokens,
        "volume": metrics["volume"],
        "difficulty": metrics["difficulty"],
        "status": status,
        "is_parent": False,
        "group_id": None,
        "blocked_by": blocked_by,
        "serp_features": metrics["serp_features"],
    }
