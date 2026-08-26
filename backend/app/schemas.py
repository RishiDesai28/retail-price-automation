from datetime import datetime
from decimal import Decimal

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sku: str
    name: str
    category: str | None
    vendor_product_id: str
    current_vendor_cost: Decimal | None
    current_pos_price: Decimal | None
    target_margin_pct: Decimal
    auto_update_enabled: bool
    active: bool
    created_at: datetime
    updated_at: datetime


class ProductUpdateRequest(BaseModel):
    target_margin_pct: Decimal | None = Field(default=None, ge=0, lt=100)
    auto_update_enabled: bool | None = None
    active: bool | None = None


class ManualPricingRequest(BaseModel):
    vendor_cost: Decimal | None = Field(default=None, gt=0, decimal_places=2)
    target_margin_pct: Decimal | None = Field(default=None, ge=0, lt=100, decimal_places=2)
    pos_price: Decimal | None = Field(default=None, gt=0, decimal_places=2)
    pricing_mode: Literal["margin_based", "manual_price"]
    reason: str = Field(min_length=1)
    auto_update_enabled: bool | None = None
    active: bool | None = None

    @field_validator("vendor_cost", "target_margin_pct", "pos_price")
    @classmethod
    def require_finite_decimal(cls, value: Decimal | None) -> Decimal | None:
        if value is not None and not value.is_finite():
            raise ValueError("pricing values must be finite decimals")
        return value

    @field_validator("reason")
    @classmethod
    def require_reason(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("reason must not be empty")
        return value.strip()

    @model_validator(mode="after")
    def require_mode_fields(self):
        if self.vendor_cost is None:
            raise ValueError("vendor_cost is required")
        if self.pricing_mode == "margin_based" and self.target_margin_pct is None:
            raise ValueError("target_margin_pct is required for margin_based pricing")
        if self.pricing_mode == "manual_price" and self.pos_price is None:
            raise ValueError("pos_price is required for manual_price pricing")
        return self


class PricingCalculationResponse(BaseModel):
    suggested_pos_price: Decimal | None
    resulting_gross_margin_pct: Decimal
    gross_profit_per_unit: Decimal


class ManualPricingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product: ProductResponse
    previous_vendor_cost: Decimal | None
    previous_pos_price: Decimal | None
    new_vendor_cost: Decimal
    new_pos_price: Decimal
    target_margin_pct: Decimal
    gross_profit_per_unit: Decimal
    gross_margin_pct: Decimal
    pricing_mode: Literal["margin_based", "manual_price"]
    audit_log_id: int


class PriceChangeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sync_run_id: int
    product_id: int | None
    vendor_product_id: str
    product_name: str
    old_vendor_cost: Decimal | None
    new_vendor_cost: Decimal
    old_pos_price: Decimal | None
    suggested_pos_price: Decimal | None
    new_pos_price: Decimal | None
    change_pct: Decimal | None
    target_margin_pct: Decimal | None
    status: str
    source: str
    reason: str
    reviewed_at: datetime | None
    processed_at: datetime


class RejectionRequest(BaseModel):
    rejection_reason: str = Field(min_length=1)

    @field_validator("rejection_reason")
    @classmethod
    def require_non_whitespace(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("rejection reason must not be empty")
        return value


class SyncRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    started_at: datetime
    completed_at: datetime | None
    status: str
    vendor_records_received: int
    products_matched: int
    prices_changed: int
    prices_updated: int
    review_required: int
    unmatched_vendor_products: int
    error_message: str | None


class Pagination(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int


class ProductListResponse(BaseModel):
    items: list[ProductResponse]
    pagination: Pagination


class CategoryListResponse(BaseModel):
    items: list[str]


class PriceChangeListResponse(BaseModel):
    items: list[PriceChangeResponse]
    pagination: Pagination


class SyncRunListResponse(BaseModel):
    items: list[SyncRunResponse]
    pagination: Pagination


class DashboardSummary(BaseModel):
    products_monitored: int
    changes_today: int
    auto_updated_today: int
    review_required_count: int
    unmatched_vendor_products: int
    most_recent_sync: SyncRunResponse | None
    total_price_change_logs: int