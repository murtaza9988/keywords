import nltk

REQUIRED_NLTK_RESOURCES = {
    "punkt": "tokenizers/punkt",
    "stopwords": "corpora/stopwords",
    "wordnet": "corpora/wordnet",
}


def ensure_nltk_resources() -> None:
    for resource_name, resource_path in REQUIRED_NLTK_RESOURCES.items():
        try:
            nltk.data.find(resource_path)
        except LookupError:
            nltk.download(resource_name)


if __name__ == "__main__":
    ensure_nltk_resources()
