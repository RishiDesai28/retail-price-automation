from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        Index("ix_products_vendor_product_id", "vendor_product_id"),
        Index("ix_products_active", "active"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sku: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str | None] = mapped_column(String(100))
    vendor_product_id: Mapped[str] = mapped_column(String(100), nullable=False)
    current_vendor_cost: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    current_pos_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    target_margin_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    auto_update_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    vendor_price_snapshots: Mapped[list["VendorPriceSnapshot"]] = relationship(back_populates="product")
    price_change_logs: Mapped[list["PriceChangeLog"]] = relationship(back_populates="product")


class VendorPriceSnapshot(Base):
    __tablename__ = "vendor_price_snapshots"
    __table_args__ = (
        Index("ix_vendor_price_snapshots_vendor_product_id", "vendor_product_id"),
        Index("ix_vendor_price_snapshots_fetched_at", "fetched_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id", ondelete="SET NULL"))
    vendor_product_id: Mapped[str] = mapped_column(String(100), nullable=False)
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    vendor_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    source: Mapped[str] = mapped_column(String(100), nullable=False)

    product: Mapped[Product | None] = relationship(back_populates="vendor_price_snapshots")


class SyncRun(Base):
    __tablename__ = "sync_runs"
    __table_args__ = (Index("ix_sync_runs_started_at", "started_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    vendor_records_received: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    products_matched: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    prices_changed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    prices_updated: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    review_required: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    unmatched_vendor_products: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_message: Mapped[str | None] = mapped_column(Text)

    price_change_logs: Mapped[list["PriceChangeLog"]] = relationship(back_populates="sync_run")


class PriceChangeLog(Base):
    __tablename__ = "price_change_logs"
    __table_args__ = (
        Index("ix_price_change_logs_sync_run_id", "sync_run_id"),
        Index("ix_price_change_logs_product_id", "product_id"),
        Index("ix_price_change_logs_status", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sync_run_id: Mapped[int] = mapped_column(ForeignKey("sync_runs.id", ondelete="CASCADE"), nullable=False)
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id", ondelete="SET NULL"))
    vendor_product_id: Mapped[str] = mapped_column(String(100), nullable=False)
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    old_vendor_cost: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    new_vendor_cost: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    old_pos_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    suggested_pos_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    new_pos_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    change_pct: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    target_margin_pct: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    processed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    sync_run: Mapped[SyncRun] = relationship(back_populates="price_change_logs")
    product: Mapped[Product | None] = relationship(back_populates="price_change_logs")