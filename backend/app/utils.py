from __future__ import annotations
import re
from typing import Iterable

def normalize_text(value: str) -> str:
    text = value.strip()
    text = re.sub(r"\s+", " ", text)
    return text

def sanitize_text(value: str | None) -> str:
    if value is None:
        return ""
    cleaned = normalize_text(value)
    cleaned = re.sub(r"[<>\"']", "", cleaned)
    cleaned = re.sub(r"\{\{.*?\}\}", "", cleaned)
    return cleaned


def format_sources(sources: Iterable[str]) -> str:
    document_list = "\n".join(f"- {source}" for source in sources)
    return document_list
