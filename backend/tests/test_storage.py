"""Storage-related unit tests."""

from __future__ import annotations

from app.services import storage


class FakeBucket:
    def __init__(self, objects: list[str] | None = None) -> None:
        self.objects = list(objects or [])
        self.remove_calls: list[list[str]] = []

    def list(self, prefix: str, options: dict[str, int] | None = None):
        if options is None:
            return [{"name": name} for name in self.objects]
        limit = options.get("limit", 100)
        offset = options.get("offset", 0)
        return [{"name": name} for name in self.objects[offset : offset + limit]]

    def remove(self, paths: list[str]):
        self.remove_calls.append(list(paths))
        return list(paths)


class FakeStorage:
    def __init__(self, buckets: dict[str, FakeBucket]) -> None:
        self._buckets = buckets

    def from_(self, bucket: str) -> FakeBucket:
        return self._buckets[bucket]


class FakeClient:
    def __init__(self, storage: FakeStorage) -> None:
        self.storage = storage


def test_delete_prefix_uses_full_paths(monkeypatch) -> None:
    page_bucket = FakeBucket(["1.png", "2.png"])
    monkeypatch.setattr(storage, "_client", FakeClient(FakeStorage({"page-images": page_bucket})))

    status = storage.delete_prefix("page-images", "doc-123")

    assert status == "ok"
    assert page_bucket.remove_calls == [["doc-123/1.png", "doc-123/2.png"]]


def test_delete_prefix_paginates_more_than_100_objects(monkeypatch) -> None:
    names = [f"{index}.png" for index in range(1, 151)]
    page_bucket = FakeBucket(names)
    monkeypatch.setattr(storage, "_client", FakeClient(FakeStorage({"page-images": page_bucket})))

    status = storage.delete_prefix("page-images", "doc-123")

    assert status == "ok"
    assert len(page_bucket.remove_calls) == 2
    assert page_bucket.remove_calls[0] == [f"doc-123/{index}.png" for index in range(1, 101)]
    assert page_bucket.remove_calls[1] == [f"doc-123/{index}.png" for index in range(101, 151)]


def test_delete_prefix_reports_partial_cleanup(monkeypatch) -> None:
    page_bucket = FakeBucket(["1.png", "2.png", "3.png"])

    def fake_remove(paths: list[str]):
        page_bucket.remove_calls.append(list(paths))
        return list(paths)[:2]

    page_bucket.remove = fake_remove  # type: ignore[assignment]
    monkeypatch.setattr(storage, "_client", FakeClient(FakeStorage({"page-images": page_bucket})))

    status = storage.delete_prefix("page-images", "doc-123")

    assert status == "partial"
    assert len(page_bucket.remove_calls) == 1
    assert page_bucket.remove_calls[0] == ["doc-123/1.png", "doc-123/2.png", "doc-123/3.png"]


def test_delete_prefix_reports_remove_exception_as_partial(monkeypatch) -> None:
    page_bucket = FakeBucket(["1.png"])

    def failing_remove(paths: list[str]):
        page_bucket.remove_calls.append(list(paths))
        raise RuntimeError("storage unavailable")

    page_bucket.remove = failing_remove  # type: ignore[assignment]
    monkeypatch.setattr(storage, "_client", FakeClient(FakeStorage({"page-images": page_bucket})))

    assert storage.delete_prefix("page-images", "doc-123") == "partial"


def test_cleanup_document_storage_removes_exact_pdf_and_page_paths(monkeypatch) -> None:
    pdf_bucket = FakeBucket()
    page_bucket = FakeBucket(["1.png", "2.png"])
    client = FakeClient(
        FakeStorage({"pdfs": pdf_bucket, "page-images": page_bucket})
    )
    monkeypatch.setattr(storage, "_client", client)

    assert storage.cleanup_document_storage("doc-123") == "ok"
    assert pdf_bucket.remove_calls == [["doc-123.pdf"]]
    assert page_bucket.remove_calls == [["doc-123/1.png", "doc-123/2.png"]]
