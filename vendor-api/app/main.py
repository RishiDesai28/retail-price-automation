from fastapi import APIRouter, FastAPI, HTTPException

from app.repository import VendorProduct, VendorRepository
from app.schemas import PriceUpdateRequest, ResetResponse, VendorProductResponse

app = FastAPI(title="Mock Vendor API")
router = APIRouter(prefix="/vendor", tags=["vendor products"])
repository = VendorRepository()


@app.get("/")
def root() -> dict[str, str]:
    return {"service": "vendor-api", "health_url": "/health", "docs_url": "/docs"}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "vendor-api"}


@router.get("/products", response_model=list[VendorProductResponse])
def list_products() -> list[VendorProduct]:
    return repository.list()


@router.get("/products/{product_id}", response_model=VendorProductResponse)
def get_product(product_id: str) -> VendorProduct:
    product = repository.get(product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Vendor product not found")
    return product


@router.patch("/products/{product_id}/price", response_model=VendorProductResponse)
def update_price(product_id: str, request: PriceUpdateRequest) -> VendorProduct:
    product = repository.update_price(product_id, request.price)
    if product is None:
        raise HTTPException(status_code=404, detail="Vendor product not found")
    return product


@router.post("/reset", response_model=ResetResponse)
def reset_vendor_data() -> ResetResponse:
    products = repository.reset()
    return ResetResponse(products=products, count=len(products))


app.include_router(router)