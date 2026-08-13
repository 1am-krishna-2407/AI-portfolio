from __future__ import annotations
import json
import os
import re
from pathlib import Path
from typing import Any

import faiss
import numpy as np
from pypdf import PdfReader
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from sentence_transformers import SentenceTransformer

from .config import settings

SUPPORTED_EXTENSIONS = {".md", ".txt", ".pdf", ".docx"}
CHUNK_SIZE = 800
CHUNK_OVERLAP = 200


def clean_text(text: str) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    return text


def split_chunks(text: str) -> list[str]:
    tokens = text.split()
    if len(tokens) <= CHUNK_SIZE:
        return [clean_text(text)]

    chunks: list[str] = []
    start = 0
    while start < len(tokens):
        end = min(start + CHUNK_SIZE, len(tokens))
        chunk = " ".join(tokens[start:end]).strip()
        chunks.append(clean_text(chunk))
        start += CHUNK_SIZE - CHUNK_OVERLAP
    return [chunk for chunk in chunks if chunk]


def load_pdf(path: Path) -> str:
    reader = PdfReader(path)
    parts: list[str] = []
    for page in reader.pages:
        text = page.extract_text() or ""
        parts.append(text)
    return "\n\n".join(parts)


def load_docx(path: Path) -> str:
    try:
        import docx
    except ImportError:
        return ""
    document = docx.Document(path)
    paragraphs = [paragraph.text for paragraph in document.paragraphs if paragraph.text]
    return "\n\n".join(paragraphs)


def load_text(path: Path) -> str:
    if path.suffix.lower() == ".pdf":
        return load_pdf(path)
    if path.suffix.lower() == ".docx":
        return load_docx(path)
    return path.read_text(encoding="utf-8", errors="ignore")


def ensure_directory(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


class EmbeddingStore:
    def __init__(self) -> None:
        self.knowledge_dir = settings.knowledge_dir
        self.embeddings_dir = settings.embeddings_dir
        self.index_path = settings.vector_index_path
        self.metadata_path = settings.metadata_path
        self._model: SentenceTransformer | None = None
        self.qdrant_client: QdrantClient | None = None
        self.collection_name = settings.qdrant_collection
        self.dimension = 384  # all-MiniLM-L6-v2 dimension is always 384
        self.index = None
        self.metadata: list[dict[str, Any]] = self._load_metadata()

        if settings.qdrant_url and settings.qdrant_api_key:
            try:
                self.qdrant_client = QdrantClient(
                    url=settings.qdrant_url,
                    api_key=settings.qdrant_api_key,
                    prefer_grpc=False,
                )
                self._ensure_qdrant_collection()
            except Exception:
                self.qdrant_client = None
                self.index = self._load_or_create_index()
        else:
            self.index = self._load_or_create_index()

    def _ensure_qdrant_collection(self) -> None:
        assert self.qdrant_client is not None
        try:
            self.qdrant_client.get_collection(collection_name=self.collection_name)
        except Exception:
            self.qdrant_client.recreate_collection(
                collection_name=self.collection_name,
                vectors_config=qmodels.VectorParams(size=self.dimension, distance=qmodels.Distance.COSINE),
            )

    def _load_or_create_index(self) -> faiss.IndexIDMap:
        ensure_directory(self.embeddings_dir)
        if self.index_path.exists():
            try:
                index = faiss.read_index(str(self.index_path))
                return faiss.IndexIDMap(index)
            except Exception:
                pass

        dim = self.dimension
        base_index = faiss.IndexFlatIP(dim)
        return faiss.IndexIDMap(base_index)

    def _load_metadata(self) -> list[dict[str, Any]]:
        if self.metadata_path.exists():
            try:
                return json.loads(self.metadata_path.read_text(encoding="utf-8"))
            except Exception:
                return []
        return []

    def _save_metadata(self) -> None:
        self.metadata_path.write_text(json.dumps(self.metadata, indent=2, ensure_ascii=False), encoding="utf-8")

    @property
    def model(self) -> SentenceTransformer:
        if self._model is None:
            self._model = SentenceTransformer("all-MiniLM-L6-v2")
        return self._model

    def _embed_texts(self, texts: list[str]) -> np.ndarray:
        embeddings = self.model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
        if embeddings.ndim == 1:
            embeddings = np.expand_dims(embeddings, axis=0)
        return embeddings.astype("float32")

    def _document_chunks(self, path: Path) -> list[dict[str, str]]:
        raw_text = load_text(path)
        raw_text = clean_text(raw_text)
        if not raw_text:
            return []
        chunks = split_chunks(raw_text)
        return [
            {
                "content": chunk,
                "source": path.name,
                "path": str(path.relative_to(self.knowledge_dir)),
            }
            for chunk in chunks
        ]

    def build_index(self) -> None:
        documents: list[dict[str, str]] = []
        for path in sorted(self.knowledge_dir.rglob("*")):
            if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS:
                documents.extend(self._document_chunks(path))

        if not documents:
            return

        texts = [item["content"] for item in documents]
        embeddings = self._embed_texts(texts)

        if self.qdrant_client is not None:
            self.qdrant_client.recreate_collection(
                collection_name=self.collection_name,
                vectors_config=qmodels.VectorParams(size=self.dimension, distance=qmodels.Distance.COSINE),
            )
            points = [
                qmodels.PointStruct(
                    id=int(idx),
                    vector=embeddings[idx].tolist(),
                    payload={
                        "source": doc["source"],
                        "path": doc["path"],
                        "excerpt": doc["content"][:300],
                        "content": doc["content"],
                    },
                )
                for idx, doc in enumerate(documents)
            ]
            self.qdrant_client.upsert(collection_name=self.collection_name, points=points)
            self.metadata = [
                {
                    "id": int(idx),
                    "source": doc["source"],
                    "path": doc["path"],
                    "excerpt": doc["content"][:300],
                    "content": doc["content"],
                }
                for idx, doc in enumerate(documents)
            ]
            self._save_metadata()
            return

        self.index = self._load_or_create_index()
        self.metadata = []
        ids = np.arange(len(texts), dtype=np.int64)
        self.index.reset()
        self.index.add_with_ids(embeddings, ids)
        self.metadata = [
            {
                "id": int(idx),
                "source": doc["source"],
                "path": doc["path"],
                "excerpt": doc["content"][:300],
                "content": doc["content"],
            }
            for idx, doc in enumerate(documents)
        ]
        faiss.write_index(self.index.index, str(self.index_path))
        self._save_metadata()

    def search(self, query: str, top_k: int = 4) -> list[dict[str, Any]]:
        cleaned = clean_text(query)
        if not cleaned:
            return []

        query_embedding = self._embed_texts([cleaned])[0]
        results: list[dict[str, Any]] = []

        if self.qdrant_client is not None:
            response = self.qdrant_client.query_points(
                collection_name=self.collection_name,
                query=query_embedding.tolist(),
                limit=top_k,
                with_payload=True,
            )
            for point in getattr(response, "points", []) or []:
                payload = getattr(point, "payload", {}) or {}
                results.append(
                    {
                        "score": float(getattr(point, "score", 0.0) or 0.0),
                        "source": str(payload.get("source", "unknown")),
                        "path": str(payload.get("path", "unknown")),
                        "excerpt": str(payload.get("content", payload.get("excerpt", ""))),
                    }
                )
            return results

        if self.index.ntotal == 0:
            return []

        scores, ids = self.index.search(np.expand_dims(query_embedding, axis=0), top_k)
        for score, identifier in zip(scores[0], ids[0]):
            if identifier < 0:
                continue
            metadata = next((item for item in self.metadata if item["id"] == int(identifier)), None)
            if metadata is None:
                continue
            results.append(
                {
                    "score": float(score),
                    "source": metadata["source"],
                    "path": metadata["path"],
                    "excerpt": metadata.get("content", metadata.get("excerpt", "")),
                }
            )
        return results

    def get_source_text(self, top_k: int = 4) -> tuple[str, list[str]]:
        if self.document_count() == 0:
            return "", []
        sources: dict[str, list[str]] = {}
        for item in self.metadata[:top_k]:
            sources.setdefault(item["source"], []).append(item["excerpt"])
        lines: list[str] = []
        for source, excerpts in sources.items():
            lines.append(f"Source: {source}")
            for excerpt in excerpts:
                lines.append(excerpt)
                lines.append("")
        return "\n".join(lines), list(sources.keys())

    def document_count(self) -> int:
        if self.qdrant_client is not None:
            try:
                count_response = self.qdrant_client.count(collection_name=self.collection_name)
                return int(count_response.count or 0)
            except Exception:
                return len(self.metadata)
        return int(self.index.ntotal if self.index is not None else 0)
