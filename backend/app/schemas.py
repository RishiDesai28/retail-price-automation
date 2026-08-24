from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


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
    reason: str
    reviewed_at: datetime | None
    processed_at: datetime


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