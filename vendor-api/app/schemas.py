from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class VendorProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_id: str
    name: str
    price: Decimal
    currency: str
    updated_at: datetime | None


class PriceUpdateRequest(BaseModel):
    price: Decimal = Field(gt=0, decimal_places=2)


class ResetResponse(BaseModel):
    products: list[VendorProductResponse]
    count: int