from __future__ import annotations
import os
from pathlib import Path
from dotenv import load_dotenv, find_dotenv

BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent.parent

dotenv_path = find_dotenv(filename=".env", raise_error_if_not_found=False)
if dotenv_path:
    load_dotenv(dotenv_path)
else:
    for dotenv_path in [ROOT_DIR / ".env", BASE_DIR / ".env", Path.cwd() / ".env"]:
        if dotenv_path.exists():
            load_dotenv(dotenv_path)
            break

class Settings:
    knowledge_dir: Path = Path(os.getenv("KNOWLEDGE_DIR", ROOT_DIR / "knowledge"))
    embeddings_dir: Path = Path(os.getenv("EMBEDDINGS_DIR", ROOT_DIR / "embeddings"))
    vector_index_path: Path = embeddings_dir / "faiss.index"
    metadata_path: Path = embeddings_dir / "metadata.json"
    groq_api_key: str | None = os.getenv("GROQ_API_KEY")
    groq_model: str = os.getenv("GROQ_MODEL", "qwen/qwen3.6-27b")
    groq_api_url: str = os.getenv("GROQ_API_URL", "https://api.groq.com")
    qdrant_url: str | None = os.getenv("QDRANT_URL")
    qdrant_api_key: str | None = os.getenv("QDRANT_API_KEY")
    qdrant_collection: str = os.getenv("QDRANT_COLLECTION", "ai-portfolio")
    retrieval_top_k: int = int(os.getenv("RETRIEVAL_TOP_K", "4"))
    fallback_threshold: float = float(os.getenv("RETRIEVAL_SCORE_THRESHOLD", "0.14"))


settings = Settings()
