"""
Recipe Companion API - FastAPI Application

Main entry point with routes and CopilotKit integration.
"""

from __future__ import annotations

import logging
import uuid
from io import BytesIO
from typing import Any

# Load .env before any import that reads os.getenv() at module scope
# (e.g. src.agents captures LLM_MODEL at import time).
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, File, HTTPException, UploadFile  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from pydantic import BaseModel, ConfigDict, Field  # noqa: E402
from pydantic_ai.ag_ui import StateDeps  # noqa: E402
from pypdf import PdfReader  # noqa: E402
from pypdf.errors import PdfReadError  # noqa: E402

from .agents import (  # noqa: E402
    RecipeImageGenerationError,
    generate_recipe_image,
    parse_recipe_from_text,
    recipe_agent,
)
from .models import Recipe, RecipeContext  # noqa: E402


class UploadResponse(BaseModel):
    """CopilotKit-shaped envelope returned by POST /upload."""

    threadId: str
    runId: str
    state: RecipeContext
    tools: list[Any] = Field(default_factory=list)
    context: list[Any] = Field(default_factory=list)
    forwardedProps: dict[str, Any] = Field(default_factory=dict)
    messages: list[Any] = Field(default_factory=list)


class RecipeImageRequest(BaseModel):
    """Request body for finished recipe image generation."""

    recipe: Recipe


class RecipeImageResponse(BaseModel):
    """Browser-ready generated image payload."""

    model_config = ConfigDict(populate_by_name=True)

    data_url: str = Field(..., alias="dataUrl")
    mime_type: str = Field(..., alias="mimeType")
    prompt: str


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# =============================================================================
# FastAPI Application
# =============================================================================

app = FastAPI(title="Recipe Companion API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# File Upload Endpoint
# =============================================================================
@app.post("/upload", response_model=UploadResponse)
async def upload_document(file: UploadFile = File(...)) -> UploadResponse:
    """
    Upload a recipe document (PDF or text), parse it, and return the parsed recipe.

    The frontend stores the recipe in CopilotKit state via useCoAgent.
    """
    content = await file.read()
    filename = file.filename or ""

    try:
        if filename.endswith(".pdf"):
            reader = PdfReader(BytesIO(content))
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
        else:
            text = content.decode("utf-8")
    except PdfReadError as e:
        raise HTTPException(status_code=422, detail=f"Could not read PDF: {e}")
    except UnicodeDecodeError as e:
        raise HTTPException(
            status_code=422, detail=f"File is not valid UTF-8 text: {e}"
        )

    recipe = await parse_recipe_from_text(text)
    if recipe is None:
        raise HTTPException(
            status_code=422,
            detail="Could not parse a recipe from the uploaded file.",
        )

    return UploadResponse(
        threadId=str(uuid.uuid4()),
        runId=str(uuid.uuid4()),
        state=RecipeContext(document_text=text, recipe=recipe),
    )


# =============================================================================
# Recipe Image Endpoint
# =============================================================================
@app.post("/recipe-image", response_model=RecipeImageResponse)
async def recipe_image(request: RecipeImageRequest) -> RecipeImageResponse:
    """Generate an image of the finished recipe."""
    try:
        image = await generate_recipe_image(request.recipe)
    except RecipeImageGenerationError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e)) from e

    return RecipeImageResponse(
        data_url=image.data_url,
        mime_type=image.mime_type,
        prompt=image.prompt,
    )


# =============================================================================
# AG-UI Integration (pydantic-ai)
# =============================================================================

# Create AG-UI app from the recipe agent and mount it
ag_ui_app = recipe_agent.to_ag_ui(deps=StateDeps(RecipeContext()))
app.mount("/copilotkit", ag_ui_app)


# =============================================================================
# Health Check
# =============================================================================


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "recipe-companion"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)
