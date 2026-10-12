"""Deterministic cleanup for extracted page text."""

from __future__ import annotations

import re
import unicodedata

_LIGATURES = str.maketrans({
    "ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl", "ﬃ": "ffi",
    "ﬄ": "ffl", "ﬅ": "st", "ﬆ": "st",
})


def clean_text(text: str) -> str:
    """Clean extraction artifacts without rewriting mathematical symbols."""
    value = unicodedata.normalize("NFC", text.translate(_LIGATURES))
    value = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", value)
    value = re.sub(r"(?<=[a-z])-\s*\n\s*(?=[a-z])", "", value)
    value = re.sub(r"[ \t]+", " ", value)
    lines = [line.strip() for line in value.replace("\r\n", "\n").replace("\r", "\n").split("\n")]
    lines = [line for line in lines if not re.fullmatch(r"\d+", line)]
    paragraphs: list[str] = []
    current: list[str] = []
    for line in lines:
        if line:
            current.append(line)
        elif current:
            paragraphs.append(" ".join(current))
            current = []
    if current:
        paragraphs.append(" ".join(current))
    return "\n\n".join(paragraphs).strip()
