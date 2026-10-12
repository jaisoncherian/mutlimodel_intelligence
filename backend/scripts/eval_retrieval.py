"""Evaluate retrieval through the running Phase 3 API."""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Any

import requests


def _first_complete_match(
    results: list[dict[str, Any]], expected: list[dict[str, Any]]
) -> int | None:
    """Return the rank where all expected document/page pairs are present."""
    matched_ranks: list[int] = []
    for expected_item in expected:
        rank = next(
            (
                index
                for index, result in enumerate(results, 1)
                if result.get("filename") == expected_item.get("filename")
                and result.get("page_number") == expected_item.get("page")
            ),
            None,
        )
        if rank is None:
            return None
        matched_ranks.append(rank)
    return max(matched_ranks, default=None)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:5000")
    parser.add_argument("--file", default="evaluation/retrieval_queries.json")
    args = parser.parse_args()
    queries = json.loads(Path(args.file).read_text(encoding="utf-8"))
    report: list[str] = [f"# Retrieval report ({date.today().isoformat()})", ""]
    metrics: dict[tuple[str, str], list[float]] = defaultdict(list)
    failures: list[str] = []
    for item in queries:
        for mode in ("vector", "keyword", "hybrid"):
            response = requests.get(
                f"{args.base_url}/search",
                params={"q": item["query"], "k": 5, "mode": mode},
                timeout=120,
            )
            if response.status_code != 200:
                failures.append(f"{item['query']} [{mode}] HTTP {response.status_code}")
                continue
            results = response.json()
            first = _first_complete_match(results, item["expected"])
            for cutoff in (1, 3, 5):
                metrics[(mode, f"hit@{cutoff}")].append(float(first is not None and first <= cutoff))
            metrics[(mode, "mrr")].append(1 / first if first else 0.0)
            if first is None:
                failures.append(f"{item['query']} [{mode}] top hits: {results[:3]}")
    report.extend(["| Mode | Hit@1 | Hit@3 | Hit@5 | MRR |", "|---|---:|---:|---:|---:|"])
    for mode in ("vector", "keyword", "hybrid"):
        values = {key: sum(metrics[(mode, key)]) / len(metrics[(mode, key)]) if metrics[(mode, key)] else 0.0
                  for key in ("hit@1", "hit@3", "hit@5", "mrr")}
        report.append(f"| {mode} | {values['hit@1']:.3f} | {values['hit@3']:.3f} | {values['hit@5']:.3f} | {values['mrr']:.3f} |")
    report.append("")
    report.append("## Failed queries")
    report.extend(f"- {failure}" for failure in failures)
    output = Path("evaluation/reports")
    output.mkdir(parents=True, exist_ok=True)
    report_path = output / f"retrieval_{date.today().isoformat()}.md"
    report_path.write_text("\n".join(report) + "\n", encoding="utf-8")
    print("\n".join(report))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
