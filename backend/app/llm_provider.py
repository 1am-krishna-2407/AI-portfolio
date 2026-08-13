from __future__ import annotations
import json
import os
import re
from typing import Any, Dict, Iterable, Generator

import requests
from requests.exceptions import RequestException
from .config import settings

BASE_PROMPT = (
    "You are a sharp, recruiter-friendly assistant for Krishna's AI portfolio. "
    "Your job is to answer questions ONLY about what is explicitly asked — nothing more.\n\n"

    "## Core Rules\n"
    "1. **Answer only what is asked.** If asked about experience, give experience. Do NOT volunteer tech stack, "
    "projects, or unrelated details unless specifically asked.\n"
    "2. **Be concise.** Recruiters skim. Keep answers short, scannable, and to the point. "
    "Avoid long paragraphs — use bullet points, tables, or short sentences instead.\n"
    "3. **No hallucination.** If information is not present in the provided documents, do NOT infer, guess, or fill gaps. "
    "Reply exactly: \"I couldn't find verified information about that in Krishna's portfolio.\" "
    "Then add: \"For more details, reach out at: https://portfolio-alpha-sage-21.vercel.app/#contact\"\n"
    "4. **No filler.** Skip intros like 'Great question!' or summaries that restate the question.\n"
    "5. **No raw HTML.** Never output `<br>`, `<p>`, `<div>`, or any HTML tags. Use markdown line breaks and bullets instead.\n"
    "6. **No file citations.** Do NOT include brackets, filenames, or references like 【resume.pdf】 in your output.\n\n"

    "## Formatting\n"
    "- Use **Markdown tables** when comparing or listing multiple items (skills, projects, experience).\n"
    "- Use **bullet points** for lists of 3 or more items.\n"
    "- Use **bold** for key terms.\n"
    "- Include project/portfolio links only if they exist in the source documents.\n"
    "- Aim for answers under 150 words unless the question genuinely requires more depth.\n"
)

COMPARE_PROMPT = (
    "You are comparing a job description against Krishna's verified portfolio documents. "
    "Use ONLY information explicitly present in the retrieved documents. Do not invent skills or experience.\n\n"
    "Format your response with these sections (only include a section if relevant data exists):\n\n"
    "| Section | What to include |\n"
    "|---|---|\n"
    "| ✅ Matching Skills | Skills and tools present in both JD and portfolio |\n"
    "| 📁 Relevant Projects | Projects that demonstrate required skills |\n"
    "| 💼 Supporting Experience | Work experience that aligns with the role |\n"
    "| ❌ Missing Skills | JD requirements not found in the portfolio |\n"
    "| 🎯 Interview Talking Points | 2–3 concise points Krishna can lead with |\n\n"
    "Keep each section brief and scannable — use bullet points, not paragraphs.\n"
    "If a section has no verified data, omit it entirely.\n"
    "Do NOT include inline file citations, brackets, or filenames (e.g. 【resume.pdf】) anywhere in your output."
)


def build_prompt(query: str, source_text: str, sources: Iterable[str], recruiter_mode: bool, job_description: str | None = None) -> str:
    source_block = "\n\nDocuments used:\n" + "\n".join(f"- {item}" for item in sources)
    if job_description:
        prompt = (
            f"{COMPARE_PROMPT}\n\nJob Description:\n{job_description}\n\n"
            f"Context from verified documents:\n{source_text}\n\n{source_block}"
        )
    else:
        recruiter_hint = (
            "\nThis is a recruiter context — prioritize clarity and scannability over completeness."
            if recruiter_mode else ""
        )
        prompt = (
            f"{BASE_PROMPT}{recruiter_hint}\n\n"
            f"Question: {query}\n\n"
            f"Context from verified documents:\n{source_text}\n\n{source_block}\n\n"
            "Answer the question directly and concisely. "
            "Only include what is relevant to the question asked. "
            "Do not add extra sections or unrelated information."
        )
    return prompt


_HTML_TAG_RE = re.compile(r"<br\s*/?>|</?(?:p|div|span|b|i|u|strong|em)\s*/?>", re.IGNORECASE)


def _sanitize_output(text: str) -> str:
    """Strip stray HTML tags that the LLM may copy verbatim from source documents."""
    return _HTML_TAG_RE.sub(" ", text)


def groq_stream(prompt: str) -> Generator[str, None, None]:
    if not settings.groq_api_key:
        raise ValueError("GROQ_API_KEY is required for Groq provider.")

    url = settings.groq_api_url.rstrip("/") + "/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.groq_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.groq_model,
        "messages": [
            {"role": "system", "content": "You are a concise, fact-grounded portfolio assistant for Krishna. Answer only what is asked. Do not fabricate information. Use bullet points or tables instead of paragraphs."},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": 1024,
        "temperature": 0.0,
        "stream": True,
    }

    response = requests.post(url, headers=headers, json=payload, stream=True, timeout=90)
    response.raise_for_status()

    for line in response.iter_lines():
        if not line:
            continue
        decoded = line.decode("utf-8")
        if decoded.startswith("data:"):
            chunk = decoded.removeprefix("data:").strip()
            if chunk == "[DONE]":
                break
            try:
                data = json.loads(chunk)
                delta = data.get("choices", [{}])[0].get("delta", {})
                text = delta.get("content")
                if text:
                    yield _sanitize_output(text)
            except (json.JSONDecodeError, IndexError, KeyError):
                continue


def create_stream(prompt: str) -> Generator[str, None, None]:
    """Stream LLM output directly."""
    yield from groq_stream(prompt)
