"""Application configuration."""

import os

from dotenv import load_dotenv

load_dotenv()


class Config:
    """Default configuration loaded from environment variables."""

    DATABASE_URL = os.getenv("DATABASE_URL", "")
    DB_POOL_TIMEOUT = float(os.getenv("DB_POOL_TIMEOUT", "30.0"))
    SUPABASE_URL = os.getenv("SUPABASE_URL", "")
    SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY", "")
    TESSERACT_CMD = (
        os.getenv("TESSERACT_CMD")
        or (
            r"C:\Program Files\Tesseract-OCR\tesseract.exe"
            if os.path.exists(r"C:\Program Files\Tesseract-OCR\tesseract.exe")
            else ""
        )
    )
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

    # -------------------------------------------------------------------------
    # Phase 5A: Verification layer
    # -------------------------------------------------------------------------
    # VERIFY_MODE controls which verification passes run after each answer.
    #   off     – skip all verification (confidence="unchecked")
    #   lexical – lexical claim-support check only; no LLM calls
    #   llm     – run LLM check on ALL claims (expensive; use only for eval)
    #   both    – lexical first; LLM only for borderline claims (default)
    VERIFY_MODE = os.getenv("VERIFY_MODE", "both")

    # Maximum number of borderline claims sent to the LLM per answer.
    # Keeps VRAM usage bounded. Remaining borderline claims are left as "weak".
    VERIFY_MAX_CLAIMS_LLM = int(os.getenv("VERIFY_MAX_CLAIMS_LLM", "5"))

    # Policy when the verification layer itself errors (requirement 8):
    #   flag   – return the answer clearly marked state="error", confidence="unverified"
    #   refuse – return status="insufficient_evidence" instead of the answer
    VERIFY_FAIL_POLICY = os.getenv("VERIFY_FAIL_POLICY", "flag")

    # Lexical overlap thresholds for claim-support check.
    # UNCALIBRATED guesses – not validated against a labelled dataset.
    # Do not treat these numbers as meaningful accuracy indicators.
    VERIFY_LEXICAL_HIGH = float(os.getenv("VERIFY_LEXICAL_HIGH", "0.60"))  # UNCALIBRATED
    VERIFY_LEXICAL_LOW = float(os.getenv("VERIFY_LEXICAL_LOW", "0.35"))   # UNCALIBRATED

    # When True, /ask honours the optional "options" request field
    # (verify_mode, vision, retrieval_mode, k, think).
    # MUST be False in production; only enable for evaluation runs.
    ALLOW_EVAL_OVERRIDES = os.getenv("ALLOW_EVAL_OVERRIDES", "false").lower() == "true"
