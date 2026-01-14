import nltk

REQUIRED_NLTK_RESOURCES = {
    "punkt": "tokenizers/punkt",
    "stopwords": "corpora/stopwords",
    "wordnet": "corpora/wordnet",
}


def ensure_nltk_resources() -> None:
    def _resource_present(resource_path: str) -> bool:
        try:
            nltk.data.find(resource_path)
            return True
        except LookupError:
            try:
                nltk.data.find(f"{resource_path}.zip")
                return True
            except LookupError:
                return False

    for resource_name, resource_path in REQUIRED_NLTK_RESOURCES.items():
        if not _resource_present(resource_path):
            nltk.download(resource_name)


if __name__ == "__main__":
    ensure_nltk_resources()
