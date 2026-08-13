from __future__ import annotations

from pydantic import BaseModel, Field


class QueryRequest(BaseModel):
    query: str = Field(..., min_length=1, description="The recruiter-friendly question to ask.")
    recruiter_mode: bool = Field(False, description="Enable recruiter mode for shorter answers.")


class CompareRequest(BaseModel):
    job_description: str = Field(..., min_length=1, description="The job description to compare against verified documents.")
    recruiter_mode: bool = Field(True, description="Enable recruiter mode for the comparison summary.")


class RebuildResponse(BaseModel):
    status: str
    documents: int
    index_size: int
