"""Application configuration."""

import os

from dotenv import load_dotenv

load_dotenv()


class Config:
    """Default configuration loaded from environment variables."""

    DATABASE_URL = os.getenv("DATABASE_URL", "")
    SUPABASE_URL = os.getenv("SUPABASE_URL", "")
    SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY", "")
    TESSERACT_CMD = os.getenv("TESSERACT_CMD", "")
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    MAX_FILE_SIZE = 25 * 1024 * 1024
    MAX_CONTENT_LENGTH = 25 * 1024 * 1024
    MAX_REQUEST_CONTENT_LENGTH = 300 * 1024 * 1024

    # --- Phase 4: Ollama LLM settings ---
    # Base URL where Ollama is listening (no trailing slash).
    OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen3.5:4b")
    OLLAMA_VISION_MODEL = os.getenv("OLLAMA_VISION_MODEL", os.getenv("OLLAMA_MODEL", "qwen3.5:4b"))
    # When True, pass "think": false is the default; set True to enable Qwen's
    # chain-of-thought reasoning (costs more tokens and time).
    OLLAMA_THINK = os.getenv("OLLAMA_THINK", "false").lower() == "true"

    # Minimum vector similarity score for a retrieval hit to be trusted.
    # Hits that only come from keyword search have no similarity score (None)
    # and are NOT blocked by this guard; only hits with a score below this
    # threshold are blocked.
    MIN_SIMILARITY = float(os.getenv("MIN_SIMILARITY", "0.15"))

    # Phase 4C: set to false to disable multimodal image context entirely.
    VISION_ENABLED = os.getenv("VISION_ENABLED", "true").lower() == "true"
