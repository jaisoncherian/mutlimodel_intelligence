from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from app.repositories import chunks


class FakeCursor:
    def __init__(self) -> None:
        self.query = ""
        self.params: list[object] = []

    def __enter__(self) -> "FakeCursor":
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def execute(self, query: str, params: list[object]) -> None:
        self.query = query
        self.params = params

    def fetchall(self) -> list[dict[str, object]]:
        return []


class FakeConnection:
    def __init__(self, cursor: FakeCursor) -> None:
        self.fake_cursor = cursor

    def __enter__(self) -> "FakeConnection":
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def cursor(self, **kwargs: object) -> FakeCursor:
        return self.fake_cursor


def test_search_sql_parameter_counts_match_placeholders(monkeypatch) -> None:
    vector_cursor = FakeCursor()
    monkeypatch.setattr(
        chunks,
        "get_conn",
        lambda: FakeConnection(vector_cursor),
    )
    chunks.vector_search(
        [0.1, 0.2],
        doc_ids=[uuid4()],
        content_types=["table"],
        user_id=uuid4(),
    )
    assert vector_cursor.query.count("%s") == len(vector_cursor.params)

    keyword_cursor = FakeCursor()
    monkeypatch.setattr(
        chunks,
        "get_conn",
        lambda: FakeConnection(keyword_cursor),
    )
    chunks.keyword_search(
        "revenue | cost",
        doc_ids=[uuid4()],
        content_types=["table"],
        user_id=uuid4(),
    )
    assert keyword_cursor.query.count("%s") == len(keyword_cursor.params)


def test_schema_has_phase3_chunk_columns() -> None:
    schema_path = Path(__file__).parents[2] / "database" / "schema.sql"
    schema = schema_path.read_text(encoding="utf-8")
    assert "alter table chunks add column if not exists chunk_index" in schema
    assert "alter table chunks add column if not exists table_index" in schema
    assert "alter table chunks add column if not exists token_count" in schema
