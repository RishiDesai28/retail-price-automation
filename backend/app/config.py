import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    database_url: str
    vendor_api_url: str


settings = Settings(
    database_url=os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://retail_app:change-me-locally@localhost:5432/retail_price_automation",
    ),
    vendor_api_url=os.getenv("VENDOR_API_URL", "http://localhost:8001"),
)