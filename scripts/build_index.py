from __future__ import annotations
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from app.embeddings import EmbeddingStore


def main() -> None:
    store = EmbeddingStore()
    store.build_index()
    print(f"Built FAISS index with {store.index.ntotal} chunks.")


if __name__ == "__main__":
    main()
