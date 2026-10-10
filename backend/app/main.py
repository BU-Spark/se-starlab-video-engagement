"""
FastAPI entry point for the STAR Lab video engagement backend.
"""

from datetime import datetime

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import AwareDatetime, BaseModel
from supabase import Client

from app.config import get_settings
from app.db import get_supabase

settings = get_settings()

app = FastAPI(title="STAR Lab Video Engagement API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ClickIn(BaseModel):
    # Must include a timezone offset, e.g. 2026-10-10T18:46:14.123Z
    clicked_at: AwareDatetime


class ClickOut(BaseModel):
    id: int
    clicked_at: datetime
    created_at: datetime


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/clicks", status_code=201)
def create_click(click: ClickIn, supabase: Client = Depends(get_supabase)) -> ClickOut:
    result = supabase.table("button_clicks").insert({"clicked_at": click.clicked_at.isoformat()}).execute()
    return ClickOut(**result.data[0])
