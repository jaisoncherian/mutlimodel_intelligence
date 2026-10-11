"""Application configuration."""

import os

from dotenv import load_dotenv

load_dotenv()


class Config:
    """Default configuration loaded from environment variables."""

    DATABASE_URL = os.getenv("DATABASE_URL", "")
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    MAX_CONTENT_LENGTH = 25 * 1024 * 1024
