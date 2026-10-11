# DocuLens AI

DocuLens AI is a multimodal PDF question-and-answer system. Phase 1 provides
the Flask application foundation, database connection handling, health checks,
and an idempotent Supabase Postgres schema. Phase 2 adds PDF validation,
per-page text and image extraction, OCR, table storage, and document APIs.
Chunking, embeddings, search, models, auth, and the frontend remain out of
scope until their phases.

## Decision log

1. Flask over FastAPI: the first phase needs a small, explicit HTTP foundation
   with minimal framework ceremony.
2. Supabase Postgres + pgvector over SQLite + FAISS: the hosted database and
   RLS also cover vectors and future multi-user access.
3. One multimodal model (Qwen3.5-4B) for text and vision: one model keeps the
   future inference path consistent across document modalities.
4. PyMuPDF plus pdfplumber: native text and table extraction stay separate so
   each page can preserve reliable citation coordinates and structured rows.
5. Supabase Storage only for files: database access remains psycopg-only,
   while private buckets keep original PDFs and page images out of Postgres.

## Local setup

Use Python 3.11 and install the pinned dependencies:

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Set `DATABASE_URL` in `.env` to the Supabase session pooler connection string.
The schema can then be applied with:

```powershell
python scripts/apply_schema.py
```

Run the server with:

```powershell
python run.py
```

The health endpoint is available at `http://127.0.0.1:5000/health`.

Upload multiple PDFs with curl:

```powershell
curl.exe -X POST http://127.0.0.1:5000/documents/upload `
  -F "files=@C:\path\first.pdf" `
  -F "files=@C:\path\second.pdf"
```

Apply the current schema before using document endpoints:

```powershell
python scripts/apply_schema.py
```
