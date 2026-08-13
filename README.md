# AI Portfolio Assistant (Recruiter Edition)

A production-quality portfolio assistant built with a FastAPI backend and a Next.js frontend. The assistant answers recruiter questions using verified documents in the local knowledge base and prevents hallucinations by only responding to indexed information.

## Features

- FastAPI backend with FAISS and SentenceTransformers
- Local document ingestion (Markdown, TXT, PDF, DOCX)
- Semantic search and Retrieval-Augmented Generation (RAG)
- Streaming chat responses
- Job description comparison mode
- Light / dark theme support
- Recruiter-friendly responses
- Simple deployment using free services

## Repository Layout

```
AI_Portfolio/
├── backend/
│   ├── app/
│   ├── pyproject.toml
├── frontend/
│   ├── app/
│   ├── components/
│   ├── package.json
│   ├── tsconfig.json
├── knowledge/
│   ├── resume/
├── embeddings/
├── scripts/
├── .env.example
└── README.md
```

## Getting Started

### 1. Clone repository

```powershell
cd C:\Users\edith\OneDrive\Desktop\AI_Portfolio
```

### 2. Install backend dependencies

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -U pip
pip install -e .
```

### 3. Install frontend dependencies

```powershell
cd ..\frontend
npm install
```

### 4. Configure environment variables

Copy `.env.example` to `.env` in the repository root, then add your credentials:

```powershell
copy .env.example .env
```

Required variables:

- `GROQ_API_KEY`
- `GROQ_MODEL` (`qwen/qwen3.6-27b`)
- `LLM_PROVIDER` (`groq`, `gemini`, or `ollama`)
- `QDRANT_URL`
- `QDRANT_API_KEY`
- `NEXT_PUBLIC_API_BASE_URL`

Optional local defaults are available, but the backend requires an LLM provider key.

### 5. Add documents

Place verified documents in `knowledge/`:

- `knowledge/resume/`
- `knowledge/linkedin/`
- `knowledge/github/`
- `knowledge/certificates/`
- `knowledge/projects/`
- `knowledge/blogs/`

Supported formats: `.md`, `.txt`, `.pdf`, `.docx`

### 6. Build the search index

```powershell
cd ..\scripts
python build_index.py
```

### 7. Run backend

```powershell
cd ..\backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 8. Run frontend

```powershell
cd ..\frontend
npm run dev
```

Open `http://localhost:3000` in your browser.

## Rebuild the Vector Index

Any time you add or update documents in `knowledge/`, run:

```powershell
cd scripts
python build_index.py
```

## Deployment

- Frontend: Deploy `frontend/` to Vercel.
- Backend: Deploy `backend/` to Render, Railway, or another free Python hosting platform.

### Backend deployment notes

Use the repository root `.env` values in your hosting platform environment config.
Set `NEXT_PUBLIC_API_BASE_URL` for the frontend to point to the hosted backend URL.

## Troubleshooting

- If responses are empty, ensure the FAISS index exists in `embeddings/` and rebuild it.
- If the backend fails to start, verify `OPENAI_API_KEY`, `LLM_PROVIDER`, and `NEXT_PUBLIC_API_BASE_URL`.
- If the frontend cannot call the backend, update `NEXT_PUBLIC_API_BASE_URL` and restart the dev server.

## Security

- The assistant never uses prompt injection from user queries.
- If no verified answer is found, the assistant returns a strict fallback CTA.

## Adding Documents

1. Save files under `knowledge/`.
2. Run `python scripts/build_index.py`.
3. Reload the backend and frontend.
