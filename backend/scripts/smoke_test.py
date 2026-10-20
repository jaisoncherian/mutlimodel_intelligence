"""Live end-to-end smoke test for DocuLens AI.

This script is not a pytest test. It exercises the running Flask app and real
Supabase services, including Storage, against a live database and server.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app import create_app
from app.services import storage

import pytest


DEFAULT_TIMEOUT_SECONDS = 300
DEFAULT_BASE_URL = "http://127.0.0.1:5000"
DEFAULT_DIR = ROOT / "data" / "sample_pdfs"


def print_result(name: str, status: str, reason: str) -> None:
    print(f"{status}: {name} - {reason}")


def load_expected(dir_path: Path) -> dict[str, Any]:
    expected_path = dir_path / "expected.json"
    if not expected_path.exists():
        return {}
    with expected_path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def normalize_text(value: Any) -> str:
    return " ".join(str(value).split())


def get_app() -> Any:
    app = create_app()
    return app


def storage_download(bucket: str, object_path: str) -> bytes:
    app = get_app()
    with app.app_context():
        return storage.download(bucket, object_path)


def storage_exists(bucket: str, object_path: str) -> bool:
    try:
        storage_download(bucket, object_path)
        return True
    except Exception:
        return False


def maybe_skip(expected: dict[str, Any], filename: str, required: list[str]) -> str | None:
    missing = [key for key in required if key not in expected.get(filename, {})]
    if missing:
        return f"SKIP: missing expected values for {filename}: {', '.join(missing)}"
    return None


def wait_for_status(document_id: str, base_url: str, timeout_seconds: int) -> tuple[str, dict[str, Any]]:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        response = requests.get(f"{base_url}/documents/{document_id}", timeout=30)
        if response.status_code == 404:
            return "missing", {}
        data = response.json()
        status = str(data.get("status", "")).lower()
        if status in {"ready", "failed"}:
            return status, data
        time.sleep(5)
    return "timeout", {}


def upload_documents(base_url: str, dir_path: Path, timeout_seconds: int) -> tuple[bool, dict[str, str], str]:
    required_files = ["text_table.pdf", "two_column.pdf", "scan.pdf", "fake.pdf"]
    missing = [name for name in required_files if not (dir_path / name).exists()]
    if missing:
        return False, {}, f"SKIP: missing fixture files: {', '.join(missing)}"

    files = []
    for name in required_files:
        files.append(("files", (name, (dir_path / name).read_bytes(), "application/pdf")))

    response = requests.post(f"{base_url}/documents/upload", files=files, timeout=timeout_seconds)
    if response.status_code != 202:
        return False, {}, f"FAIL: upload status={response.status_code}, body={response.text}"

    try:
        payload = response.json()
    except ValueError:
        return False, {}, f"FAIL: upload response was not JSON, raw body={response.text}"

    def is_accepted(row: dict[str, Any]) -> bool:
        document_id = row.get("document_id")
        error = row.get("error")
        if not isinstance(document_id, str):
            return False
        if not document_id.strip():
            return False
        if error is None:
            return True
        return not str(error).strip()

    def is_rejected(row: dict[str, Any]) -> bool:
        error = row.get("error")
        return isinstance(error, str) and bool(error.strip())

    accepted = [row for row in payload if isinstance(row, dict) and is_accepted(row)]
    rejected = [row for row in payload if isinstance(row, dict) and is_rejected(row)]

    if len(accepted) != 3:
        return False, {row["filename"]: str(row["document_id"]) for row in accepted}, (
            f"FAIL: expected 3 accepted documents, got {len(accepted)}; raw body={response.text}"
        )
    if len(rejected) != 1:
        return False, {row["filename"]: str(row["document_id"]) for row in accepted}, (
            f"FAIL: expected 1 rejected document, got {len(rejected)}; raw body={response.text}"
        )

    fake_row = next((row for row in rejected if row.get("filename") == "fake.pdf"), None)
    if fake_row is None or not is_rejected(fake_row):
        return False, {row["filename"]: str(row["document_id"]) for row in accepted}, (
            "FAIL: fake.pdf was not rejected with an error; raw body=" + response.text
        )

    accepted_map = {row["filename"]: str(row["document_id"]) for row in accepted}
    if set(accepted_map) != {"text_table.pdf", "two_column.pdf", "scan.pdf"}:
        return False, accepted_map, f"FAIL: unexpected accepted files {sorted(accepted_map)}; raw body={response.text}"

    return True, accepted_map, "PASS: accepted 3 docs and rejected fake.pdf"


def poll_documents(base_url: str, accepted_map: dict[str, str], timeout_seconds: int) -> tuple[bool, str]:
    if not accepted_map:
        return False, "SKIP: no accepted documents"

    reasons: list[str] = []
    start = time.time()
    remaining = dict(accepted_map)
    last_bodies: dict[str, str] = {}

    while remaining:
        elapsed = time.time() - start
        if elapsed >= timeout_seconds:
            waited = int(elapsed)
            for filename in sorted(remaining):
                reasons.append(
                    f"{filename} timed out after {waited} seconds; "
                    f"last response body: {last_bodies.get(filename, '<none>')}"
                )
            break

        for filename, document_id in list(remaining.items()):
            response = requests.get(f"{base_url}/documents/{document_id}", timeout=30)
            last_bodies[filename] = response.text
            if response.status_code == 404:
                reasons.append(f"{filename} was not found while processing")
                del remaining[filename]
                continue

            payload = response.json()
            status = str(payload.get("status", "")).lower()
            if status == "failed":
                message = payload.get("error_message") or "unknown failure"
                reasons.append(f"{filename} failed: {message}")
                del remaining[filename]
            elif status == "ready":
                del remaining[filename]

        if not remaining:
            break

        remaining_seconds = timeout_seconds - (time.time() - start)
        time.sleep(min(5, max(0, remaining_seconds)))

    if not reasons:
        return True, "PASS: all accepted documents reached ready"
    return False, "FAIL: " + "; ".join(reasons)


def document_page_numbers(base_url: str, accepted_map: dict[str, str], expected: dict[str, Any]) -> tuple[bool, str]:
    if not accepted_map:
        return False, "SKIP: no accepted documents"

    failures: list[str] = []
    skip_for: list[str] = []

    for filename, document_id in accepted_map.items():
        doc_expected = expected.get(filename, {})
        if "page_count" not in doc_expected:
            skip_for.append(filename)
            continue

        detail_response = requests.get(f"{base_url}/documents/{document_id}", timeout=30)
        if detail_response.status_code != 200:
            failures.append(f"{filename}: document detail status {detail_response.status_code}")
            continue
        detail = detail_response.json()
        stored_count = int(detail.get("page_count") or 0)
        expected_count = int(doc_expected["page_count"])

        if stored_count != expected_count:
            failures.append(f"{filename}: page_count mismatch: stored={stored_count}, expected={expected_count}")
            continue

        numbers: list[int] = []
        for page_number in range(1, stored_count + 1):
            page_response = requests.get(f"{base_url}/documents/{document_id}/pages/{page_number}", timeout=30)
            if page_response.status_code != 200:
                failures.append(f"{filename}: page {page_number} status {page_response.status_code}")
                break
            page_data = page_response.json()
            actual_number = int(page_data.get("page_number"))
            numbers.append(actual_number)
            if actual_number != page_number:
                failures.append(f"{filename}: expected page_number {page_number}, got {actual_number}")
                break
        if numbers and numbers != list(range(1, stored_count + 1)):
            failures.append(f"{filename}: gaps or duplicates in page numbers: {numbers}")

    if skip_for and not failures:
        return False, f"SKIP: missing expected page_count for {', '.join(skip_for)}"
    if failures:
        return False, "FAIL: " + "; ".join(failures)
    return True, "PASS: page numbers are exactly 1..N and match stored counts"


def scan_document(base_url: str, accepted_map: dict[str, str], expected: dict[str, Any]) -> tuple[bool, str]:
    scan_id = accepted_map.get("scan.pdf")
    if scan_id is None:
        return False, "SKIP: scan.pdf was not accepted"
    if "scan.pdf" not in expected:
        return False, "SKIP: missing expected values for scan.pdf"

    page_response = requests.get(f"{base_url}/documents/{scan_id}/pages/1", timeout=30)
    if page_response.status_code != 200:
        return False, f"FAIL: scan page fetch status {page_response.status_code}"
    page_data = page_response.json()

    text = str(page_data.get("text") or "")
    ocr_confidence = page_data.get("ocr_confidence")
    extraction_method = str(page_data.get("extraction_method") or "")
    is_scanned = bool(page_data.get("is_scanned"))

    if not is_scanned:
        return False, "FAIL: scan page is not marked as scanned"
    if extraction_method not in {"ocr", "mixed"}:
        return False, f"FAIL: extraction_method={extraction_method!r}"
    if not text.strip():
        return False, "FAIL: OCR text is empty"
    if ocr_confidence is None or float(ocr_confidence) <= 0:
        return False, "FAIL: ocr_confidence is missing or invalid"

    expected_words = [str(item).lower() for item in expected["scan.pdf"].get("expected_words", [])]
    if not expected_words:
        return False, "SKIP: expected_words missing for scan.pdf"
    matches = sum(1 for word in expected_words if word in text.lower())
    if matches < 2:
        return False, f"FAIL: expected at least 2 scan words, found {matches}"
    return True, f"PASS: OCR fields valid and {matches} expected words detected"


def check_table_values(base_url: str, accepted_map: dict[str, str], expected: dict[str, Any]) -> tuple[bool, str]:
    document_id = accepted_map.get("text_table.pdf")
    if document_id is None:
        return False, "SKIP: text_table.pdf was not accepted"
    if "text_table.pdf" not in expected:
        return False, "SKIP: missing expected values for text_table.pdf"

    table_meta = expected["text_table.pdf"]
    table_page = int(table_meta.get("table_page") or 0)
    expected_values = [str(value) for value in table_meta.get("table_values", [])]
    if not expected_values or table_page <= 0:
        return False, "SKIP: table expectations missing for text_table.pdf"

    response = requests.get(f"{base_url}/documents/{document_id}/pages/{table_page}", timeout=30)
    if response.status_code != 200:
        return False, f"FAIL: table page fetch status {response.status_code}"
    page_data = response.json()
    tables = page_data.get("tables") or []
    if not tables:
        return False, "FAIL: no tables were extracted"

    flattened: list[str] = []
    for table in tables:
        rows = table.get("rows") or []
        for row in rows:
            if isinstance(row, list):
                flattened.extend(str(item) for item in row)
            elif isinstance(row, dict):
                flattened.extend(str(item) for item in row.values())
    normalized = [normalize_text(value).lower() for value in flattened]

    missing = [value for value in expected_values if normalize_text(value).lower() not in normalized]
    if missing:
        return False, f"FAIL: missing expected table values: {missing}"
    return True, "PASS: all expected table values were found in extracted rows"


def check_column_order(base_url: str, accepted_map: dict[str, str], expected: dict[str, Any]) -> tuple[bool, str]:
    document_id = accepted_map.get("two_column.pdf")
    if document_id is None:
        return False, "SKIP: two_column.pdf was not accepted"
    if "two_column.pdf" not in expected:
        return False, "SKIP: missing expected values for two_column.pdf"

    row = expected["two_column.pdf"]
    left_phrase = str(row.get("left_phrase") or "")
    right_phrase = str(row.get("right_phrase") or "")
    if not left_phrase or not right_phrase:
        return False, "SKIP: left/right phrases missing for two_column.pdf"

    page_response = requests.get(f"{base_url}/documents/{document_id}/pages/1", timeout=30)
    if page_response.status_code != 200:
        return False, f"FAIL: column page fetch status {page_response.status_code}"
    text = str(page_response.json().get("text") or "").lower()
    left_index = text.find(left_phrase.lower())
    right_index = text.find(right_phrase.lower())
    if left_index < 0 or right_index < 0:
        return False, f"FAIL: missing expected phrases (left={left_index}, right={right_index})"
    if left_index >= right_index:
        return False, "FAIL: left phrase appears after the right phrase"
    return True, "PASS: left phrase appears before right phrase"


def check_page_image(base_url: str, accepted_map: dict[str, str]) -> tuple[bool, str]:
    document_id = next(iter(accepted_map.values()), None)
    if document_id is None:
        return False, "SKIP: no accepted document available"

    image_endpoint = requests.get(f"{base_url}/documents/{document_id}/pages/1/image", timeout=30)
    if image_endpoint.status_code != 200:
        return False, f"FAIL: image endpoint status {image_endpoint.status_code}"
    payload = image_endpoint.json()
    url = payload.get("url")
    if not url:
        return False, "FAIL: image endpoint did not return a signed URL"

    image_response = requests.get(url, timeout=60)
    if image_response.status_code != 200:
        return False, f"FAIL: signed URL status {image_response.status_code}"
    if not image_response.content.startswith(b"\x89PNG"):
        return False, "FAIL: signed URL content is not PNG"
    if len(image_response.content) <= 10 * 1024:
        return False, f"FAIL: page image size too small ({len(image_response.content)} bytes)"
    return True, f"PASS: page image is PNG and {len(image_response.content)} bytes"


def check_storage(base_url: str, accepted_map: dict[str, str]) -> tuple[bool, str]:
    if not accepted_map:
        return False, "SKIP: no accepted documents"

    failures: list[str] = []
    for filename, document_id in accepted_map.items():
        for bucket, object_path in ( ("pdfs", f"{document_id}.pdf"), ("page-images", f"{document_id}/1.png") ):
            if not storage_exists(bucket, object_path):
                failures.append(f"{filename}: missing {bucket}/{object_path}")

    if failures:
        return False, "FAIL: " + "; ".join(failures)
    return True, "PASS: original PDFs and page-1 images exist in Storage"


def reprocess_document(base_url: str, accepted_map: dict[str, str], expected: dict[str, Any]) -> tuple[bool, str]:
    document_id = accepted_map.get("text_table.pdf")
    if document_id is None:
        return False, "SKIP: text_table.pdf was not accepted"

    detail_before = requests.get(f"{base_url}/documents/{document_id}", timeout=30)
    if detail_before.status_code != 200:
        return False, f"FAIL: pre-reprocess detail status {detail_before.status_code}"
    prior_count = int(detail_before.json().get("page_count") or 0)

    reprocess_response = requests.post(f"{base_url}/documents/{document_id}/reprocess", timeout=120)
    if reprocess_response.status_code != 202:
        return False, f"FAIL: reprocess status {reprocess_response.status_code}"

    status, payload = wait_for_status(document_id, base_url, 180)
    if status != "ready":
        message = payload.get("error_message") if isinstance(payload, dict) else "unknown"
        return False, f"FAIL: reprocess did not finish ready: {status} {message}"

    detail_after = requests.get(f"{base_url}/documents/{document_id}", timeout=30)
    if detail_after.status_code != 200:
        return False, f"FAIL: post-reprocess detail status {detail_after.status_code}"
    page_count_after = int(detail_after.json().get("page_count") or 0)
    if page_count_after != prior_count:
        return False, f"FAIL: page_count changed from {prior_count} to {page_count_after}"
    return True, f"PASS: reprocess kept page_count at {prior_count}"


def cleanup_documents(base_url: str, accepted_map: dict[str, str], *, keep: bool) -> None:
    if keep or not accepted_map:
        return
    for filename, document_id in accepted_map.items():
        try:
            requests.delete(f"{base_url}/documents/{document_id}", timeout=60)
        except Exception:
            pass
        try:
            storage_download("pdfs", f"{document_id}.pdf")
            storage_download("page-images", f"{document_id}/1.png")
        except Exception:
            pass

        response = requests.get(f"{base_url}/documents/{document_id}", timeout=30)
        if response.status_code == 404:
            continue

        for bucket, object_path in (("pdfs", f"{document_id}.pdf"), ("page-images", f"{document_id}/1.png")):
            try:
                storage_download(bucket, object_path)
            except Exception:
                continue


def delete_documents(base_url: str, accepted_map: dict[str, str]) -> tuple[bool, str]:
    if not accepted_map:
        return False, "SKIP: no accepted documents"

    failures: list[str] = []
    for filename, document_id in accepted_map.items():
        delete_response = requests.delete(f"{base_url}/documents/{document_id}", timeout=60)
        if delete_response.status_code not in {200, 202, 204}:
            failures.append(f"{filename}: delete status {delete_response.status_code}")
            continue
        get_response = requests.get(f"{base_url}/documents/{document_id}", timeout=30)
        if get_response.status_code != 404:
            failures.append(f"{filename}: document still visible at GET /documents/{document_id}")
        for bucket, object_path in (("pdfs", f"{document_id}.pdf"), ("page-images", f"{document_id}/1.png")):
            if storage_exists(bucket, object_path):
                failures.append(f"{filename}: object still exists in {bucket}/{object_path}")

    if failures:
        return False, "FAIL: " + "; ".join(failures)
    return True, "PASS: accepted documents were deleted and files removed from Storage"


def main() -> int:
    load_dotenv(ROOT / ".env")
    parser = argparse.ArgumentParser(description="Smoke test the live DocuLens AI backend.")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="Base URL for the running Flask app")
    parser.add_argument("--dir", default=str(DEFAULT_DIR), help="Directory containing fixture PDFs and expected.json")
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT_SECONDS, help="Overall timeout in seconds")
    parser.add_argument("--keep", action="store_true", help="Keep created documents and files after the smoke test")
    args = parser.parse_args()

    dir_path = Path(args.dir).expanduser().resolve()
    expected = load_expected(dir_path)
    accepted: dict[str, str] = {}
    failures = 0

    checks = [
        ("A. Multi-file upload", lambda: upload_documents(args.base_url, dir_path, args.timeout)),
        ("B. Processing", lambda: (poll_documents(args.base_url, accepted, args.timeout) if accepted else (False, "SKIP: upload did not return accepted documents"))),
        ("C. Page numbering", lambda: document_page_numbers(args.base_url, accepted, expected)),
        ("D. OCR", lambda: scan_document(args.base_url, accepted, expected)),
        ("E. Tables", lambda: check_table_values(args.base_url, accepted, expected)),
        ("F. Column order", lambda: check_column_order(args.base_url, accepted, expected)),
        ("G. Page image", lambda: check_page_image(args.base_url, accepted)),
        ("H. Storage", lambda: check_storage(args.base_url, accepted)),
        ("I. Reprocess", lambda: reprocess_document(args.base_url, accepted, expected)),
        ("J. Delete", lambda: delete_documents(args.base_url, accepted)),
    ]

    try:
        for name, check in checks:
            try:
                if name == "A. Multi-file upload":
                    ok, accepted, reason = check()
                else:
                    ok, reason = check()
                if reason.startswith("FAIL:"):
                    status = "FAIL"
                    failures += 1
                elif reason.startswith("SKIP:"):
                    status = "SKIP"
                else:
                    status = "PASS"
                print_result(name, status, reason)
            except Exception as exc:  # pragma: no cover - safety net for live smoke tests
                failures += 1
                print_result(name, "FAIL", f"unexpected exception: {exc}")
    finally:
        if not args.keep:
            try:
                cleanup_documents(args.base_url, accepted)
            except Exception:
                pass

    return 1 if failures else 0


@pytest.mark.integration
def test_smoke_e2e():
    """Live end-to-end smoke test integration runner."""
    try:
        resp = requests.get(f"{DEFAULT_BASE_URL}/health", timeout=5)
        if resp.status_code != 200:
            pytest.skip(f"Live server at {DEFAULT_BASE_URL} returned status {resp.status_code}")
    except requests.exceptions.RequestException:
        pytest.skip(f"Live server not reachable at {DEFAULT_BASE_URL}")

    exit_code = main()
    assert exit_code == 0, "Smoke test failed"


if __name__ == "__main__":
    raise SystemExit(main())
