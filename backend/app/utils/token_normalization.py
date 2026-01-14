import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Dict, Iterable, List, Set, Tuple

COMPOUND_VARIANTS_PATH = Path(__file__).with_name("compound_variants.json")
UNICODE_DASH_PATTERN = re.compile(r"[–—]")


def _normalize_variant_text(text: str) -> str:
    normalized = UNICODE_DASH_PATTERN.sub("-", text.lower().strip())
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized


def _variant_sequences(variant: str) -> Iterable[Tuple[str, ...]]:
    normalized = _normalize_variant_text(variant)
    expanded_variants = {normalized, normalized.replace("-", " ")}
    sequences: Set[Tuple[str, ...]] = set()
    for entry in expanded_variants:
        tokens = tuple(entry.split())
        if tokens:
            sequences.add(tokens)
    collapsed = normalized.replace("-", "").replace(" ", "")
    if collapsed:
        sequences.add((collapsed,))
    return sequences


@lru_cache(maxsize=1)
def _compound_lookup() -> Tuple[Dict[Tuple[str, ...], str], int]:
    with COMPOUND_VARIANTS_PATH.open("r", encoding="utf-8") as handle:
        variants = json.load(handle)

    lookup: Dict[Tuple[str, ...], str] = {}
    max_len = 1
    for canonical, variant_list in variants.items():
        canonical_normalized = _normalize_variant_text(canonical)
        all_variants = [canonical_normalized] + list(variant_list)
        for variant in all_variants:
            for sequence in _variant_sequences(variant):
                lookup[sequence] = canonical_normalized
                max_len = max(max_len, len(sequence))
    return lookup, max_len


def normalize_compound_tokens(tokens: List[str]) -> List[str]:
    if not tokens:
        return []

    lookup, max_len = _compound_lookup()
    normalized_tokens = [
        _normalize_variant_text(token) for token in tokens if token and token.strip()
    ]
    output: List[str] = []
    index = 0
    while index < len(normalized_tokens):
        matched = False
        for length in range(max_len, 0, -1):
            if index + length > len(normalized_tokens):
                continue
            sequence = tuple(normalized_tokens[index : index + length])
            canonical = lookup.get(sequence)
            if canonical:
                output.append(canonical)
                index += length
                matched = True
                break
        if not matched:
            output.append(normalized_tokens[index])
            index += 1
    return output
