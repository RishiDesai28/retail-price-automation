import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    database_url: str
    vendor_api_url: str
    cors_allowed_origins: tuple[str, ...]


settings = Settings(
    database_url=os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://retail_app:change-me-locally@localhost:5432/retail_price_automation",
    ),
    vendor_api_url=os.getenv("VENDOR_API_URL", "http://localhost:8001"),
    cors_allowed_origins=tuple(
        origin.strip()
        for origin in os.getenv(
            "CORS_ALLOWED_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://0.0.0.0:5173",
        ).split(",")
        if origin.strip()
    ),
)