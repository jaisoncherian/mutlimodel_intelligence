"""Regression tests for smoke_test CLI argument parsing under pytest."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch

from scripts import smoke_test


def test_smoke_main_argv_empty_ignores_pytest_sys_argv(monkeypatch):
    """When pytest passes arbitrary flags via sys.argv, main([]) must not crash with SystemExit: 2."""
    # Simulate pytest invoking the runner with pytest-specific arguments
    monkeypatch.setattr(
        sys,
        "argv",
        ["pytest", "backend/scripts/smoke_test.py::test_smoke_e2e", "-vv", "--tb=long", "-s"],
    )

    with patch.object(
        smoke_test,
        "upload_documents",
        return_value=(True, {}, "SKIP: mocked for regression test"),
    ) as mock_upload:
        exit_code = smoke_test.main([])

    assert exit_code == 0
    mock_upload.assert_called_once()
    base_url_arg, dir_path_arg, timeout_arg = mock_upload.call_args[0]
    assert base_url_arg == smoke_test.DEFAULT_BASE_URL
    assert dir_path_arg == Path(smoke_test.DEFAULT_DIR).expanduser().resolve()
    assert timeout_arg == smoke_test.DEFAULT_TIMEOUT_SECONDS


def test_smoke_main_respects_custom_argv():
    """main(argv=[...]) must parse and honour custom arguments."""
    custom_url = "http://mock-service.local:9000"
    custom_timeout = 75

    with patch.object(
        smoke_test,
        "upload_documents",
        return_value=(True, {}, "SKIP: mocked for custom argv test"),
    ) as mock_upload:
        exit_code = smoke_test.main(["--base-url", custom_url, "--timeout", str(custom_timeout), "--keep"])

    assert exit_code == 0
    mock_upload.assert_called_once()
    base_url_arg, _, timeout_arg = mock_upload.call_args[0]
    assert base_url_arg == custom_url
    assert timeout_arg == custom_timeout


def test_smoke_main_default_uses_sys_argv(monkeypatch):
    """Direct CLI invocation main() without arguments must parse sys.argv[1:]."""
    custom_url = "http://direct-cli:5555"
    monkeypatch.setattr(sys, "argv", ["smoke_test.py", "--base-url", custom_url])

    with patch.object(
        smoke_test,
        "upload_documents",
        return_value=(True, {}, "SKIP: mocked for direct sys.argv test"),
    ) as mock_upload:
        exit_code = smoke_test.main()

    assert exit_code == 0
    mock_upload.assert_called_once()
    assert mock_upload.call_args[0][0] == custom_url
