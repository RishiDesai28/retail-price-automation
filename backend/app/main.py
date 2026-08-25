from datetime import datetime, timezone

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, or_, select, text
from sqlalchemy.orm import Session

from app.config import settings
from app.database import engine, get_db
from app.models import PriceChangeLog, Product, SyncRun
from app.schemas import (
    DashboardSummary,
    Pagination,
    PriceChangeListResponse,
    PriceChangeResponse,
    ProductListResponse,
    ProductResponse,
    ProductUpdateRequest,
    RejectionRequest,
    SyncRunListResponse,
    SyncRunResponse,
)
from app.sync_service import run_vendor_price_sync
from app.review_service import approve_price_change, reject_price_change

app = FastAPI(title="Retail Price Automation API")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|0\.0\.0\.0):5173",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root() -> dict[str, str]:
    return {"service": "retail-api", "health_url": "/health", "docs_url": "/docs"}


@app.get("/health")
def health() -> dict[str, str]:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception:
        return {"status": "degraded", "service": "retail-api", "database": "unreachable"}

    return {"status": "ok", "service": "retail-api", "database": "reachable"}


def _pagination(page: int, page_size: int, total: int) -> Pagination:
    return Pagination(page=page, page_size=page_size, total=total, total_pages=(total + page_size - 1) // page_size)


@app.post("/api/sync/vendor-prices", response_model=SyncRunResponse, tags=["sync"], status_code=200)
def sync_vendor_prices(session: Session = Depends(get_db)) -> SyncRun:
    sync_run = run_vendor_price_sync(session, settings.vendor_api_url)
    if sync_run.status == "failed":
        raise HTTPException(status_code=502, detail=sync_run.error_message or "Vendor price sync failed")
    return sync_run


@app.get("/api/dashboard/summary", response_model=DashboardSummary, tags=["dashboard"])
def dashboard_summary(session: Session = Depends(get_db)) -> DashboardSummary:
    today = datetime.now(timezone.utc).date()
    changes_today = session.scalar(select(func.count(PriceChangeLog.id)).where(
        func.date(PriceChangeLog.processed_at) == today,
        PriceChangeLog.status.in_(["updated", "review_required"]),
    )) or 0
    auto_updated_today = session.scalar(select(func.count(PriceChangeLog.id)).where(
        func.date(PriceChangeLog.processed_at) == today, PriceChangeLog.status == "updated"
    )) or 0
    most_recent_sync = session.scalar(select(SyncRun).order_by(SyncRun.started_at.desc()).limit(1))
    return DashboardSummary(
        products_monitored=session.scalar(select(func.count(Product.id)).where(Product.active.is_(True))) or 0,
        changes_today=changes_today,
        auto_updated_today=auto_updated_today,
        review_required_count=session.scalar(select(func.count(PriceChangeLog.id)).where(
            PriceChangeLog.status == "review_required"
        )) or 0,
        unmatched_vendor_products=session.scalar(select(func.count(PriceChangeLog.id)).where(
            PriceChangeLog.status == "unmatched"
        )) or 0,
        most_recent_sync=most_recent_sync,
        total_price_change_logs=session.scalar(select(func.count(PriceChangeLog.id))) or 0,
    )


@app.get("/api/products", response_model=ProductListResponse, tags=["products"])
def list_products(
    search: str | None = None,
    category: str | None = None,
    active: bool | None = None,
    auto_update_enabled: bool | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    session: Session = Depends(get_db),
) -> ProductListResponse:
    query = select(Product)
    if search:
        term = f"%{search}%"
        query = query.where(or_(Product.name.ilike(term), Product.sku.ilike(term), Product.vendor_product_id.ilike(term)))
    if category:
        query = query.where(Product.category == category)
    if active is not None:
        query = query.where(Product.active.is_(active))
    if auto_update_enabled is not None:
        query = query.where(Product.auto_update_enabled.is_(auto_update_enabled))
    total = session.scalar(select(func.count()).select_from(query.subquery())) or 0
    products = session.scalars(query.order_by(Product.id).offset((page - 1) * page_size).limit(page_size)).all()
    return ProductListResponse(items=products, pagination=_pagination(page, page_size, total))


@app.get("/api/products/{product_id}", response_model=ProductResponse, tags=["products"])
def get_product(product_id: int, session: Session = Depends(get_db)) -> Product:
    product = session.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@app.patch("/api/products/{product_id}", response_model=ProductResponse, tags=["products"])
def update_product(product_id: int, request: ProductUpdateRequest, session: Session = Depends(get_db)) -> Product:
    product = session.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    for field, value in request.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    session.commit()
    session.refresh(product)
    return product


@app.get("/api/price-changes", response_model=PriceChangeListResponse, tags=["price changes"])
def list_price_changes(
    status: str | None = None,
    category: str | None = None,
    product_id: int | None = None,
    search: str | None = None,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    sort_by: str = Query("processed_at"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    session: Session = Depends(get_db),
) -> PriceChangeListResponse:
    sort_columns = {
        "processed_at": PriceChangeLog.processed_at, "status": PriceChangeLog.status,
        "change_pct": PriceChangeLog.change_pct, "product_name": PriceChangeLog.product_name,
    }
    if sort_by not in sort_columns:
        raise HTTPException(status_code=400, detail="Unsupported sort_by")
    query = select(PriceChangeLog).outerjoin(Product, PriceChangeLog.product_id == Product.id)
    if status:
        query = query.where(PriceChangeLog.status == status)
    if category:
        query = query.where(Product.category == category)
    if product_id is not None:
        query = query.where(PriceChangeLog.product_id == product_id)
    if search:
        term = f"%{search}%"
        query = query.where(or_(PriceChangeLog.product_name.ilike(term), PriceChangeLog.vendor_product_id.ilike(term)))
    if from_date:
        query = query.where(PriceChangeLog.processed_at >= from_date)
    if to_date:
        query = query.where(PriceChangeLog.processed_at <= to_date)
    total = session.scalar(select(func.count()).select_from(query.subquery())) or 0
    sort_column = sort_columns[sort_by]
    sort_column = sort_column.asc() if sort_order == "asc" else sort_column.desc()
    logs = session.scalars(query.order_by(sort_column, PriceChangeLog.id.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size)).all()
    return PriceChangeListResponse(items=logs, pagination=_pagination(page, page_size, total))


@app.get("/api/price-changes/{log_id}", response_model=PriceChangeResponse, tags=["price changes"])
def get_price_change(log_id: int, session: Session = Depends(get_db)) -> PriceChangeLog:
    log = session.get(PriceChangeLog, log_id)
    if log is None:
        raise HTTPException(status_code=404, detail="Price change log not found")
    return log


@app.post("/api/price-changes/{log_id}/approve", response_model=PriceChangeResponse, tags=["price changes"])
def approve_price_change_endpoint(log_id: int, session: Session = Depends(get_db)) -> PriceChangeLog:
    try:
        return approve_price_change(session, log_id)
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@app.post("/api/price-changes/{log_id}/reject", response_model=PriceChangeResponse, tags=["price changes"])
def reject_price_change_endpoint(
    log_id: int, request: RejectionRequest, session: Session = Depends(get_db)
) -> PriceChangeLog:
    try:
        return reject_price_change(session, log_id, request.rejection_reason)
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@app.get("/api/sync-runs", response_model=SyncRunListResponse, tags=["sync"])
def list_sync_runs(
    page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100),
    session: Session = Depends(get_db),
) -> SyncRunListResponse:
    total = session.scalar(select(func.count(SyncRun.id))) or 0
    runs = session.scalars(select(SyncRun).order_by(SyncRun.started_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size)).all()
    return SyncRunListResponse(items=runs, pagination=_pagination(page, page_size, total))