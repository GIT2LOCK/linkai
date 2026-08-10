"""Local FastAPI server for browser-based frontend development."""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.api.desktop_bridge import DesktopBridge


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
