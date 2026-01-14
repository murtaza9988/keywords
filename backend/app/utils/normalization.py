import re
import unicodedata
from decimal import Decimal, InvalidOperation

SUFFIX_MULTIPLIERS = {
    "k": Decimal("1000"),
    "m": Decimal("1000000"),
    "b": Decimal("1000000000"),
}


def normalize_numeric_tokens(text: str) -> str:
    """Normalize numeric expressions for consistent tokenization.

    Examples:
        "$1,500" -> "1500"
        "1 200" -> "1200"
        "1.5k" -> "1500"
        "2m" -> "2000000"
    """
    if not text:
        return text

    cleaned = "".join(
        char for char in text if unicodedata.category(char) != "Sc"
    )
    cleaned = re.sub(r"(?<=\d)[,\s]+(?=\d)", "", cleaned)

    def expand_suffix(match: re.Match) -> str:
        number_str = match.group(1)
        suffix = match.group(2).lower()
        multiplier = SUFFIX_MULTIPLIERS.get(suffix)
        if not multiplier:
            return match.group(0)
        try:
            value = Decimal(number_str) * multiplier
        except InvalidOperation:
            return match.group(0)

        if value == value.to_integral():
            return str(value.quantize(Decimal("1")))
        return format(value.normalize(), "f").rstrip("0").rstrip(".")

    cleaned = re.sub(r"(?i)(\d+(?:\.\d+)?)(?:\s*)([kmb])\b", expand_suffix, cleaned)
    return cleaned
