import csv
from typing import Dict, Iterable, List, Optional, Sequence, Tuple


_ENCODINGS_TO_TRY: Sequence[str] = (
    "utf-8-sig",
    "utf-8",
    "utf-16",
    "utf-16-le",
    "utf-16-be",
    "latin-1",
    "iso-8859-1",
    "cp1252",
)


def _detect_csv_dialect_and_encoding(file_path: str) -> Tuple[str, str]:
    """
    Best-effort detect encoding + delimiter for a CSV file.
    Returns (encoding, delimiter).
    """
    for encoding in _ENCODINGS_TO_TRY:
        try:
            with open(file_path, "r", newline="", encoding=encoding) as infile:
                sample = infile.read(4096)
                try:
                    dialect = csv.Sniffer().sniff(sample)
                    delimiter = dialect.delimiter
                except csv.Error:
                    delimiter = ","
                return encoding, delimiter
        except UnicodeDecodeError:
            continue
    # Fallback: treat as utf-8 w/ commas.
    return "utf-8", ","


def _normalize_header(header: List[str]) -> List[str]:
    # Normalize only for comparison; keep original casing in output.
    return [str(col).strip().lstrip("\ufeff") for col in header]


def _normalize_header_key(header: List[str]) -> List[str]:
    return [col.strip().lower() for col in _normalize_header(header)]


def combine_csv_files(file_entries: Iterable[Dict[str, str]], output_path: str) -> List[str]:
    entries = list(file_entries)
    if not entries:
        raise ValueError("No CSV files provided for combining.")

    header: List[str] = []
    header_key: Optional[List[str]] = None
    with open(output_path, "w", newline="", encoding="utf-8") as outfile:
        writer = None
        for entry in entries:
            file_path = entry["file_path"]
            file_name = entry.get("file_name", "CSV file")
            encoding, delimiter = _detect_csv_dialect_and_encoding(file_path)
            with open(file_path, "r", newline="", encoding=encoding) as infile:
                reader = csv.reader(infile, delimiter=delimiter)
                try:
                    current_header = next(reader)
                except StopIteration as exc:
                    raise ValueError(f"{file_name} is empty.") from exc

                if not header:
                    header = _normalize_header(current_header)
                    header_key = _normalize_header_key(current_header)
                    writer = csv.writer(outfile)
                    writer.writerow(header)
                else:
                    current_key = _normalize_header_key(current_header)
                    if header_key is None:
                        header_key = _normalize_header_key(header)
                    if current_key != header_key:
                        raise ValueError(
                            "CSV header mismatch in "
                            f"{file_name}. Expected: {header}; Got: {_normalize_header(current_header)}"
                        )

                if writer is None:
                    raise ValueError("Unable to initialize CSV writer.")

                for row in reader:
                    if row:
                        writer.writerow(row)

    return header
