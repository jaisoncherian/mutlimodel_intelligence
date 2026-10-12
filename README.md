# DocuLens AI

DocuLens AI is a multimodal PDF question-and-answer system. Phase 1 provides
the Flask application foundation, database connection handling, health checks,
and an idempotent Supabase Postgres schema. Phase 2 adds PDF validation,
per-page text and image extraction, OCR, table storage, and document APIs.
Phase 3 adds page-local chunks, CPU embeddings, and hybrid retrieval. Answer
generation, models beyond the embedding model, auth, and the frontend remain
out of scope.

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
6. Hybrid retrieval uses reciprocal rank fusion (RRF): vector and keyword
   results remain independently useful, then combine without a learned
   reranker.
7. Chunks are capped at 240 model tokens and overlap by about 30 words to
   preserve context while fitting the embedding/model context budget.
8. Keyword retrieval uses sanitized OR queries so natural-language questions
   can match any useful term rather than requiring every term.
9. Embeddings run on CPU and load lazily because CI and the Phase 1-2 tests do
   not need a model download.

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

## Running the smoke test

Generate the live PDF fixtures from the backend folder, copy the example expected values, and run the end-to-end checks against the running server and real Supabase services:

```powershell
cd backend
python scripts/make_fixtures.py --source C:\path\to\source.pdf
Copy-Item scripts\expected.example.json data\sample_pdfs\expected.json
python scripts/smoke_test.py --base-url http://127.0.0.1:5000 --dir data\sample_pdfs
```

Use `--keep` to keep uploaded documents in Supabase after the smoke run.

## Phase 3 retrieval

Install optional machine-learning dependencies only when indexing documents:

```powershell
pip install -r requirements-ml.txt
python scripts/apply_schema.py
python run.py
```

Inspect chunks, rebuild an index, and search through the running API:

```powershell
curl.exe "http://127.0.0.1:5000/documents/<document-id>/chunks?limit=50"
curl.exe -X POST "http://127.0.0.1:5000/documents/<document-id>/reindex"
curl.exe "http://127.0.0.1:5000/search?q=quarterly%20revenue&k=5&mode=hybrid"
python scripts/eval_retrieval.py --file evaluation/retrieval_queries.json
```

Verify Phase 3 in Supabase by checking `documents.chunk_count`,
`documents.indexed_at`, and `chunks`. Embeddings should be populated, sections
should be readable, and `content_type` should distinguish text, OCR, and table
chunks. Use `select content_type, count(*), avg(token_count) from chunks group
by content_type` for basic statistics.
