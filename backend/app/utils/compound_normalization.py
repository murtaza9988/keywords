from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Tuple

_DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "compound_variants.json"

_COMPOUND_VARIANT_MAP: Dict[str, str] = {}
_OPEN_COMPOUND_VARIANTS: List[Tuple[List[str], str]] = []
_VERSION: int | None = None


def load_compound_variants(data_path: Path | None = None) -> Dict[str, str]:
    """Load compound variants into memory for reuse across runs."""
    global _COMPOUND_VARIANT_MAP, _OPEN_COMPOUND_VARIANTS, _VERSION

    path = data_path or _DATA_PATH
    with path.open("r", encoding="utf-8") as data_file:
        payload = json.load(data_file)

    variants = payload.get("variants", {})
    _VERSION = payload.get("version")
    _COMPOUND_VARIANT_MAP = {key.lower(): value.lower() for key, value in variants.items()}

    open_variants: List[Tuple[List[str], str]] = []
    for variant, canonical in _COMPOUND_VARIANT_MAP.items():
        if " " in variant:
            open_variants.append((variant.split(), canonical))
    open_variants.sort(key=lambda item: len(item[0]), reverse=True)
    _OPEN_COMPOUND_VARIANTS = open_variants

    return _COMPOUND_VARIANT_MAP


def _ensure_compound_variants_loaded() -> None:
    if not _COMPOUND_VARIANT_MAP:
        load_compound_variants()


def normalize_compound_tokens(tokens: List[str]) -> List[str]:
    """Normalize open, closed, and hyphenated compound variants into canonical tokens."""
    if not tokens:
        return []

    _ensure_compound_variants_loaded()

    normalized: List[str] = []
    index = 0
    while index < len(tokens):
        matched = False
        for open_tokens, canonical in _OPEN_COMPOUND_VARIANTS:
            end_index = index + len(open_tokens)
            if tokens[index:end_index] == open_tokens:
                normalized.append(canonical)
                index = end_index
                matched = True
                break
        if matched:
            continue

        token = tokens[index]
        normalized.append(_COMPOUND_VARIANT_MAP.get(token, token))
        index += 1

    return normalized


def compound_variant_version() -> int | None:
    _ensure_compound_variants_loaded()
    return _VERSION
