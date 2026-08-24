from fastapi import FastAPI

app = FastAPI(title="Mock Vendor API")


@app.get("/")
def root() -> dict[str, str]:
    return {"service": "vendor-api", "health_url": "/health", "docs_url": "/docs"}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "vendor-api"}