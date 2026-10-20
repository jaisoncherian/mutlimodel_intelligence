"""All SQL for conversations, messages, and citations.

Each function opens its own connection via get_conn() so it can be called
independently from any thread.  The pattern mirrors repositories/documents.py.
"""

from __future__ import annotations

import json
from typing import Any
from uuid import UUID

from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from ..db import get_conn


# ---------------------------------------------------------------------------
# Conversations
# ---------------------------------------------------------------------------

def create_conversation(title: str, user_id: UUID | None = None) -> UUID:
    """Insert a new conversation row and return its UUID."""
    with get_conn() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                insert into conversations (user_id, title)
                values (%s, %s)
                returning id
                """,
                (user_id, title),
            )
            row = cur.fetchone()
            return UUID(str(row["id"]))


def get_conversation(conversation_id: UUID) -> dict[str, Any] | None:
    """Return a single conversation row or None."""
    with get_conn() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                select id, user_id, title, created_at
                from conversations
                where id = %s
                """,
                (conversation_id,),
            )
            return cur.fetchone()


def list_conversations() -> list[dict[str, Any]]:
    """Return all conversations, newest first."""
    with get_conn() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                select id, user_id, title, created_at
                from conversations
                order by created_at desc
                """
            )
            return list(cur.fetchall())


def delete_conversation(conversation_id: UUID) -> None:
    """Delete a conversation (cascades to messages and citations)."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "delete from conversations where id = %s",
                (conversation_id,),
            )


# ---------------------------------------------------------------------------
# Messages
# ---------------------------------------------------------------------------

def insert_message(
    conversation_id: UUID,
    role: str,
    content: str,
    verification: dict[str, Any] | None = None,
    used_vision: bool = False,
) -> int:
    """Insert a message and return its integer id."""
    with get_conn() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                insert into messages
                    (conversation_id, role, content, verification, used_vision)
                values (%s, %s, %s, %s, %s)
                returning id
                """,
                (
                    conversation_id,
                    role,
                    content,
                    Jsonb(verification) if verification is not None else None,
                    used_vision,
                ),
            )
            row = cur.fetchone()
            return int(row["id"])


def list_messages(conversation_id: UUID) -> list[dict[str, Any]]:
    """Return all messages for a conversation in chronological order,
    each annotated with its citations."""
    with get_conn() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                select m.id, m.conversation_id, m.role, m.content,
                       m.verification, m.used_vision, m.created_at
                from messages m
                where m.conversation_id = %s
                order by m.created_at, m.id
                """,
                (conversation_id,),
            )
            messages = list(cur.fetchall())

            # Fetch citations for all messages in one query.
            if messages:
                message_ids = [m["id"] for m in messages]
                cur.execute(
                    """
                    select c.id, c.message_id, c.doc_id, d.filename,
                           c.page_number, c.section, c.snippet, c.content_type
                    from citations c
                    join documents d on d.id = c.doc_id
                    where c.message_id = any(%s)
                    order by c.id
                    """,
                    (message_ids,),
                )
                citations = cur.fetchall()
                # Group by message_id for easy attachment.
                citation_map: dict[int, list[dict[str, Any]]] = {}
                for cit in citations:
                    citation_map.setdefault(int(cit["message_id"]), []).append(dict(cit))
                for msg in messages:
                    msg["citations"] = citation_map.get(int(msg["id"]), [])
            else:
                for msg in messages:
                    msg["citations"] = []

            return messages


# ---------------------------------------------------------------------------
# Citations
# ---------------------------------------------------------------------------

def insert_citations(
    message_id: int,
    citations: list[dict[str, Any]],
) -> None:
    """Bulk-insert citation rows for one assistant message.

    Each dict in `citations` must have:
        doc_id, page_number, section (may be None), snippet (may be None),
        content_type (may be None).
    """
    if not citations:
        return
    with get_conn() as conn:
        with conn.cursor() as cur:
            for cit in citations:
                cur.execute(
                    """
                    insert into citations
                        (message_id, doc_id, page_number, section, snippet, content_type)
                    values (%s, %s, %s, %s, %s, %s)
                    """,
                    (
                        message_id,
                        cit["doc_id"],
                        cit["page_number"],
                        cit.get("section"),
                        cit.get("snippet"),
                        cit.get("content_type"),
                    ),
                )
