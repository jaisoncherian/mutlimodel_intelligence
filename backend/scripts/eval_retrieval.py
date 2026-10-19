"""Evaluate retrieval through the running Phase 3 API."""

from __future__ import annotations

import argparse
from collections import defaultdict
from datetime import datetime
import json
from pathlib import Path
import time
from typing import Any

import requests


def _format_hit(hit: dict[str, Any]) -> str:
    filename = hit.get("filename") or "?"
    page = hit.get("page_number") if hit.get("page_number") is not None else hit.get("page") or "?"
    section = (hit.get("section") or "").replace("\n", " ").strip()
    content_type = hit.get("content_type") or ""
    return f"{filename}:{page}|{section}|{content_type}"


def _shorten_text(text: str, max_len: int = 120) -> str:
    if not text:
        return ""
    cleaned = " ".join(str(text).split())
    if len(cleaned) <= max_len:
        return cleaned
    return cleaned[: max_len - 3] + "..."


def _expected_match(result: dict[str, Any], expected_item: dict[str, Any]) -> bool:
    return result.get("filename") == expected_item.get("filename") and (
        result.get("page_number") == expected_item.get("page")
        or result.get("page") == expected_item.get("page")
    )


def _count_partial(results: list[dict[str, Any]], expected: list[dict[str, Any]]) -> int:
    """Count how many expected pairs appear anywhere in results."""
    found = 0
    for expected_item in expected:
        if any(_expected_match(r, expected_item) for r in results):
            found += 1
    return found


def _first_complete_match(
    results: list[dict[str, Any]], expected: list[dict[str, Any]]
) -> int | None:
    """Return the rank where ALL expected document/page pairs are present."""
    if not expected:
        return None
    matched_ranks: list[int] = []
    for expected_item in expected:
        rank = next(
            (
                index
                for index, result in enumerate(results, 1)
                if _expected_match(result, expected_item)
            ),
            None,
        )
        if rank is None:
            return None
        matched_ranks.append(rank)
    return max(matched_ranks, default=None)


def main() -> int:
    default_file = Path(__file__).resolve().parent.parent / "evaluation" / "retrieval_queries.json"

    parser = argparse.ArgumentParser(description="Evaluate retrieval through Phase 3 API.")
    parser.add_argument("--base-url", default="http://127.0.0.1:5000")
    parser.add_argument("--file", default=str(default_file))
    parser.add_argument("--modes", default="vector,keyword,hybrid")
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    modes_list = [m.strip() for m in args.modes.split(",") if m.strip()]

    queries_path = Path(args.file)
    queries = json.loads(queries_path.read_text(encoding="utf-8"))
    if args.limit is not None:
        queries = queries[: args.limit]

    answerable_queries = [
        q for q in queries if not (q.get("unanswerable") or len(q.get("expected", [])) == 0)
    ]
    unanswerable_queries = [
        q for q in queries if q.get("unanswerable") or len(q.get("expected", [])) == 0
    ]

    all_types: defaultdict[str, int] = defaultdict(int)
    ans_types: defaultdict[str, int] = defaultdict(int)
    unans_types: defaultdict[str, int] = defaultdict(int)
    for q in queries:
        all_types[q.get("type", "unknown")] += 1
    for q in answerable_queries:
        ans_types[q.get("type", "unknown")] += 1
    for q in unanswerable_queries:
        unans_types[q.get("type", "unknown")] += 1

    all_type_str = ", ".join(f"{k}={v}" for k, v in sorted(all_types.items())) or "none"
    ans_type_str = ", ".join(f"{k}={v}" for k, v in sorted(ans_types.items())) or "none"
    unans_type_str = ", ".join(f"{k}={v}" for k, v in sorted(unans_types.items())) or "none"

    total_expected_pairs = sum(len(q.get("expected", [])) for q in answerable_queries)

    report: list[str] = [
        f"# Retrieval report ({datetime.now().isoformat(timespec='seconds')})",
        "",
        "**Hit rule**: A query with several expected (filename, page) pairs is a HIT only when ALL expected pairs appear in the top k. If multiple expected pairs exist, the reported rank is the maximum rank among all matched expected pairs.",
        "**Partial matches**: Shows how many of the expected (filename, page) pairs were found in top k results.",
        "**Unanswerable queries**: Reported in a separate section with top-hit vector similarity and RRF scores (excluded from hit@k and MRR metrics).",
        "",
    ]

    metrics: dict[tuple[str, str], list[float]] = defaultdict(list)
    unanswerable_metrics: list[dict[str, Any]] = []
    failures_answerable: list[str] = []
    partial_counts: dict[str, int] = defaultdict(int)

    session = requests.Session()
    start_total = time.time()

    initial_failures: list[tuple[int | None, str]] = []
    total_requests_made = 0

    for qi, item in enumerate(queries):
        qstart = time.time()
        is_unanswerable = bool(item.get("unanswerable")) or len(item.get("expected", [])) == 0

        for mode in modes_list:
            total_requests_made += 1
            status_code: int | None = None
            body_text: str = ""
            response_json: Any = None

            try:
                response = session.get(
                    f"{args.base_url}/search",
                    params={"q": item["query"], "k": 5, "mode": mode},
                    timeout=120,
                )
                status_code = response.status_code
                body_text = response.text[:200]
                if status_code != 200:
                    failures_answerable.append(
                        f"**Query**: \"{item['query']}\" [{mode}] HTTP {status_code}: {body_text}"
                    )
                    if total_requests_made <= 3:
                        initial_failures.append((status_code, body_text))
                else:
                    response_json = response.json()
            except Exception as e:
                body_text = str(e)
                failures_answerable.append(
                    f"**Query**: \"{item['query']}\" [{mode}] request error: {e}"
                )
                if total_requests_made <= 3:
                    initial_failures.append((None, body_text))

            if total_requests_made == 3 and len(initial_failures) == 3:
                print("First 3 requests all failed. Aborting.")
                for idx, (sc, b) in enumerate(initial_failures, 1):
                    sc_desc = f"status {sc}" if sc is not None else "connection/request error"
                    print(f"  Request {idx}: {sc_desc}, response: {b}")
                return 1

            if status_code != 200 or response_json is None:
                continue

            results: list[dict[str, Any]] = response_json

            if is_unanswerable:
                top_hit = results[0] if results else {}
                unanswerable_metrics.append(
                    {
                        "query": item["query"],
                        "mode": mode,
                        "vector_similarity": top_hit.get("scores", {}).get("vector_similarity"),
                        "rrf": top_hit.get("scores", {}).get("rrf"),
                        "top_hit": top_hit,
                    }
                )
            else:
                expected = item.get("expected", [])
                first = _first_complete_match(results, expected)
                partial = _count_partial(results, expected)
                partial_counts[mode] += partial

                for cutoff in (1, 3, 5):
                    metrics[(mode, f"hit@{cutoff}")].append(float(first is not None and first <= cutoff))
                metrics[(mode, "mrr")].append(1 / first if first else 0.0)

                if first is None:
                    top3 = results[:3]
                    expected_str = "; ".join(f"{e.get('filename')}:{e.get('page')}" for e in expected)
                    if top3:
                        top3_str = "; ".join(
                            f"{_format_hit(h)} \"{_shorten_text(h.get('text') or '', 120)}\""
                            for h in top3
                        )
                    else:
                        top3_str = "no hits"
                    failures_answerable.append(
                        f"**Query**: \"{item['query']}\" [{mode}] | **Expected**: [{expected_str}] (found {partial}/{len(expected)}) | **Top 3**: {top3_str}"
                    )

        qelapsed = time.time() - qstart
        print(f"[{qi + 1}/{len(queries)}] {qelapsed:.2f}s: {item['query'][:60]}")

    elapsed_total = time.time() - start_total

    report.append(f"Elapsed: {elapsed_total:.2f}s")
    report.append("")

    # Answerable queries section
    report.append("## Answerable queries (metrics)")
    report.append(
        f"- **Sample sizes**: {len(answerable_queries)} answerable, {len(unanswerable_queries)} unanswerable (total: {len(queries)})"
    )
    report.append(f"- **Query types (answerable)**: {ans_type_str}")
    report.append(f"- **Query types (all)**: {all_type_str}")
    report.append("")
    report.append("| Mode | Hit@1 | Hit@3 | Hit@5 | MRR | Partial Found | n |")
    report.append("|---|---:|---:|---:|---:|---:|---:|")
    for mode in modes_list:
        def avg(key: str) -> float:
            lst = metrics.get((mode, key), [])
            return sum(lst) / len(lst) if lst else 0.0

        n = len(metrics.get((mode, "hit@1"), []))
        partial_str = f"{partial_counts.get(mode, 0)}/{total_expected_pairs}"
        report.append(
            f"| {mode} | {avg('hit@1'):.3f} | {avg('hit@3'):.3f} | {avg('hit@5'):.3f} | {avg('mrr'):.3f} | {partial_str} | {n} |"
        )
    report.append("")

    # Unanswerable queries section
    report.append("## Unanswerable queries (top hit scores, excluded from metrics)")
    report.append(
        f"- **Sample sizes**: {len(unanswerable_queries)} unanswerable, {len(answerable_queries)} answerable (total: {len(queries)})"
    )
    report.append(f"- **Query types (unanswerable)**: {unans_type_str}")
    report.append(f"- **Query types (all)**: {all_type_str}")
    report.append("")
    report.append("| Query | Mode | vector_similarity | RRF | Top Hit (filename:page|section|content_type) |")
    report.append("|---|---|---:|---:|---|")
    for um in unanswerable_metrics:
        th = um["top_hit"]
        th_str = _format_hit(th) if th else "no hits"
        v_sim = um["vector_similarity"]
        v_sim_str = f"{v_sim:.4f}" if isinstance(v_sim, (int, float)) else "n/a"
        rrf = um["rrf"]
        rrf_str = f"{rrf:.4f}" if isinstance(rrf, (int, float)) else "n/a"
        report.append(
            f"| {_shorten_text(um['query'], 60)} | {um['mode']} | {v_sim_str} | {rrf_str} | {th_str} |"
        )
    report.append("")

    if failures_answerable:
        report.append("## Failed answerable queries (expected vs top3)")
        for failure in failures_answerable:
            report.append(f"- {failure}")
        report.append("")

    output_dir = Path(__file__).resolve().parent.parent / "evaluation" / "reports"
    output_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    report_path = output_dir / f"retrieval_{ts}.md"
    report_content = "\n".join(report) + "\n"
    report_path.write_text(report_content, encoding="utf-8")
    print(f"\nReport written to: {report_path}")
    print(report_content)

    return 1 if failures_answerable else 0


if __name__ == "__main__":
    raise SystemExit(main())
