"""Apply the DocuLens database schema."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import psycopg
from dotenv import load_dotenv


def main() -> int:
    """Apply schema SQL, optionally resetting all DocuLens tables."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="drop and recreate all tables")
    args = parser.parse_args()
    load_dotenv()
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL is required.", file=sys.stderr)
        return 1

    if args.reset:
        confirmation = input("Type RESET to drop all DocuLens tables: ")
        if confirmation != "RESET":
            print("Reset cancelled.")
            return 1

    schema_path = Path(__file__).parents[2] / "database" / "schema.sql"
    schema_sql = schema_path.read_text(encoding="utf-8")
    with psycopg.connect(database_url) as connection:
        with connection.cursor() as cursor:
            if args.reset:
                cursor.execute(
                    "drop table if exists eval_results, citations, messages, "
                    "conversations, chunks, pages, documents cascade"
                )
            cursor.execute(schema_sql)
        connection.commit()
    print("Schema applied.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
