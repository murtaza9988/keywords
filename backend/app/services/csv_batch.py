import csv
from typing import Dict, Iterable, List


def combine_csv_files(file_entries: Iterable[Dict[str, str]], output_path: str) -> List[str]:
    entries = list(file_entries)
    if not entries:
        raise ValueError("No CSV files provided for combining.")

    header: List[str] = []
    with open(output_path, "w", newline="", encoding="utf-8") as outfile:
        writer = None
        for entry in entries:
            file_path = entry["file_path"]
            file_name = entry.get("file_name", "CSV file")
            with open(file_path, "r", newline="", encoding="utf-8") as infile:
                reader = csv.reader(infile)
                try:
                    current_header = next(reader)
                except StopIteration as exc:
                    raise ValueError(f"{file_name} is empty.") from exc

                if not header:
                    header = current_header
                    writer = csv.writer(outfile)
                    writer.writerow(header)
                elif current_header != header:
                    raise ValueError(f"CSV header mismatch in {file_name}.")

                if writer is None:
                    raise ValueError("Unable to initialize CSV writer.")

                for row in reader:
                    if row:
                        writer.writerow(row)

    return header
