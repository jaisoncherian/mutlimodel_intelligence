import base64
from pathlib import Path
import pytest
import requests


@pytest.mark.integration
def test_direct_ollama_vision():
    image_path = Path(__file__).resolve().parent / "page3.png"
    if not image_path.exists():
        pytest.skip("page3.png not found")
    try:
        with open(image_path, "rb") as f:
            image_b64 = base64.b64encode(f.read()).decode("utf-8")

        response = requests.post(
            "http://localhost:11434/api/chat",
            json={
                "model": "qwen3.5:4b",
                "messages": [
                    {
                        "role": "user",
                        "content": (
                            "Read the quarterly financial table in this image. "
                            "Report Q1 2025 revenue, operating cost, and units "
                            "produced. If anything is unclear, say so."
                        ),
                        "images": [image_b64],
                    }
                ],
                "stream": False,
                "think": False,
            },
            timeout=30,
        )
        response.raise_for_status()
        content = response.json().get("message", {}).get("content", "")
        print(content)
        assert len(content) > 0
    except requests.exceptions.RequestException as exc:
        pytest.skip(f"Ollama vision test skipped: {exc}")


if __name__ == "__main__":
    test_direct_ollama_vision()
