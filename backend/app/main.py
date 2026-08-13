from __future__ import annotations
from typing import Iterable

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .config import settings
from .embeddings import EmbeddingStore
from .llm_provider import build_prompt, create_stream
from .schemas import CompareRequest, QueryRequest, RebuildResponse
from .utils import sanitize_text

app = FastAPI(
    title="AI Portfolio Assistant API",
    description="Backend API for Krishna's recruiter-focused portfolio assistant.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

store = EmbeddingStore()


def build_document_context(results: list[dict[str, object]]) -> tuple[str, list[str]]:
    if not results:
        return "", []
    seen: set[str] = set()
    blocks: list[str] = []
    sources: list[str] = []
    for item in results:
        source = str(item["source"])
        excerpt = str(item["excerpt"])
        if source not in seen:
            sources.append(source)
            seen.add(source)
        blocks.append(f"Source: {source}\n{excerpt}")
    return "\n\n".join(blocks), sources


def validate_backend_configuration() -> None:
    if not settings.groq_api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY is required for the backend to serve responses.")


@app.get("/")
async def root() -> dict[str, str]:
    return {"message": "AI Portfolio Assistant backend is running"}


def query_with_context(query_text: str, recruiter_mode: bool, job_description: str | None = None) -> Iterable[str]:
    query_text = sanitize_text(query_text)
    if not query_text:
        raise HTTPException(status_code=400, detail="Query text must not be empty.")

    results = store.search(query_text, top_k=settings.retrieval_top_k)
    if not results:
        yield (
            "I couldn't find verified information about that in Krishna's portfolio or supporting documents.\n"
            "Need more information? Please contact Krishna directly: https://portfolio-alpha-sage-21.vercel.app/#contact\n"
        )
        return

    source_text, sources = build_document_context(results)
    prompt = build_prompt(query_text, source_text, sources, recruiter_mode, job_description)
    yield from create_stream(prompt)


@app.on_event("startup")
async def startup_event() -> None:
    if store.document_count() == 0:
        store.build_index()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "index_count": str(store.document_count())}


@app.post("/rebuild-index", response_model=RebuildResponse)
async def rebuild_index() -> RebuildResponse:
    store.build_index()
    return RebuildResponse(status="ok", documents=len(store.metadata), index_size=store.document_count())


@app.post("/query")
async def query_endpoint(request: QueryRequest) -> StreamingResponse:
    validate_backend_configuration()
    stream = query_with_context(request.query, request.recruiter_mode)
    return StreamingResponse(stream, media_type="text/plain")


@app.post("/compare")
async def compare_endpoint(request: CompareRequest) -> StreamingResponse:
    if not request.job_description.strip():
        raise HTTPException(status_code=400, detail="Job description is required for comparison.")
    validate_backend_configuration()
    stream = query_with_context("Compare against job description", request.recruiter_mode, request.job_description)
    return StreamingResponse(stream, media_type="text/plain")
