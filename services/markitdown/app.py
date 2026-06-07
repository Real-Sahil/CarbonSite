"""
MarkItDown microservice for CarbonSite.

Converts uploaded files (PDF, DOCX, XLSX, images) to Markdown text.
Used by the BullMQ imports worker to pre-process documents before field extraction.

Endpoints:
  POST /convert   — upload a file, get Markdown back
  GET  /health    — health check
"""

import io
import tempfile
import os
from pathlib import Path
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from markitdown import MarkItDown

app = FastAPI(title="CarbonSite MarkItDown Service")
md = MarkItDown()

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc", ".xlsx", ".xls", ".csv", ".png", ".jpg", ".jpeg", ".webp"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/convert")
async def convert_file(file: UploadFile = File(...)):
    suffix = Path(file.filename or "upload").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{suffix}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    content = await file.read()

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        result = md.convert(tmp_path)
        return JSONResponse({
            "filename": file.filename,
            "markdown": result.text_content,
            "title": result.title,
        })
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    finally:
        os.unlink(tmp_path)
