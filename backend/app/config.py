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
