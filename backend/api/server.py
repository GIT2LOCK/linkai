"""Local FastAPI server for browser-based frontend development."""

from __future__ import annotations

import shutil
import uuid
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.api.desktop_bridge import DesktopBridge
from lumina_bot.config import PROJECT_ROOT


class InvokeRequest(BaseModel):
    """Request body used by the React frontend during web development."""

    action: str
    payload: dict[str, Any] = Field(default_factory=dict)


app = FastAPI(
    title="LinkAI Local API",
    version="0.2.0",
    description="Local API used only when the frontend runs outside Tauri.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    """Return local API health status."""
    return {"status": "ok"}


@app.post("/invoke")
def invoke_backend(request: InvokeRequest) -> dict[str, Any]:
    """Invoke backend services using the same command bridge used by Tauri."""
    result = DesktopBridge().handle(request.action, request.payload)
    return result.to_dict()


@app.post("/uploads/pdfs")
async def upload_pdfs(files: list[UploadFile] = File(...)) -> dict[str, Any]:
    """Receive PDFs selected in the browser and store them as local temp files."""
    upload_dir = PROJECT_ROOT / "output" / "temp" / "uploads" / uuid.uuid4().hex
    upload_dir.mkdir(parents=True, exist_ok=True)

    saved_paths: list[str] = []

    for uploaded_file in files:
        original_name = Path(uploaded_file.filename or "documento.pdf").name

        if Path(original_name).suffix.lower() != ".pdf":
            continue

        destination = upload_dir / original_name

        with destination.open("wb") as buffer:
            shutil.copyfileobj(uploaded_file.file, buffer)

        saved_paths.append(str(destination))

    return {
        "paths": saved_paths,
        "count": len(saved_paths),
    }
