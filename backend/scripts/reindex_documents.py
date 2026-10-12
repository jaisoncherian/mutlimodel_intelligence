"""Reindex existing documents from stored pages without re-uploading PDFs."""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path
from uuid import UUID

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app import create_app
from app.repositories import documents
from app.services.indexing import index_document

logger = logging.getLogger(__name__)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--document-id",
        action="append",
        dest="document_ids",
        help="Document UUID to reindex; repeat for multiple documents.",
    )
    args = parser.parse_args()

    app = create_app()
    with app.app_context():
        if args.document_ids:
            try:
                document_ids = [UUID(value) for value in args.document_ids]
            except ValueError as error:
                logger.error("A document-id is not a valid UUID.")
                return 1
        else:
            document_ids = [
                row["id"]
                for row in documents.list_documents()
                if row.get("status") == "ready"
            ]

        for document_id in document_ids:
            count = index_document(document_id)
            logger.info("Reindexed document %s: %s chunks", document_id, count)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
