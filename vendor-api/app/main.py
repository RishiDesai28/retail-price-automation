from fastapi import FastAPI

app = FastAPI(title="Mock Vendor API")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "vendor-api"}