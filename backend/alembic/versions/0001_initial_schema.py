"""create initial retail pricing schema

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-08-24
"""
from alembic import op
import sqlalchemy as sa


revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "products",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("sku", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("category", sa.String(length=100)),
        sa.Column("vendor_product_id", sa.String(length=100), nullable=False),
        sa.Column("current_vendor_cost", sa.Numeric(precision=10, scale=2)),
        sa.Column("current_pos_price", sa.Numeric(precision=10, scale=2)),
        sa.Column("target_margin_pct", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("auto_update_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("sku"),
    )
    op.create_index("ix_products_sku", "products", ["sku"])
    op.create_index("ix_products_vendor_product_id", "products", ["vendor_product_id"])
    op.create_index("ix_products_active", "products", ["active"])

    op.create_table(
        "vendor_price_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id", ondelete="SET NULL")),
        sa.Column("vendor_product_id", sa.String(length=100), nullable=False),
        sa.Column("product_name", sa.String(length=255), nullable=False),
        sa.Column("vendor_price", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("source", sa.String(length=100), nullable=False),
    )
    op.create_index("ix_vendor_price_snapshots_vendor_product_id", "vendor_price_snapshots", ["vendor_product_id"])
    op.create_index("ix_vendor_price_snapshots_fetched_at", "vendor_price_snapshots", ["fetched_at"])

    op.create_table(
        "sync_runs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("vendor_records_received", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("products_matched", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("prices_changed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("prices_updated", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("review_required", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("unmatched_vendor_products", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_message", sa.Text()),
    )
    op.create_index("ix_sync_runs_started_at", "sync_runs", ["started_at"])

    op.create_table(
        "price_change_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("sync_run_id", sa.Integer(), sa.ForeignKey("sync_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id", ondelete="SET NULL")),
        sa.Column("vendor_product_id", sa.String(length=100), nullable=False),
        sa.Column("product_name", sa.String(length=255), nullable=False),
        sa.Column("old_vendor_cost", sa.Numeric(precision=10, scale=2)),
        sa.Column("new_vendor_cost", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("old_pos_price", sa.Numeric(precision=10, scale=2)),
        sa.Column("suggested_pos_price", sa.Numeric(precision=10, scale=2)),
        sa.Column("new_pos_price", sa.Numeric(precision=10, scale=2)),
        sa.Column("change_pct", sa.Numeric(precision=5, scale=2)),
        sa.Column("target_margin_pct", sa.Numeric(precision=5, scale=2)),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_price_change_logs_sync_run_id", "price_change_logs", ["sync_run_id"])
    op.create_index("ix_price_change_logs_product_id", "price_change_logs", ["product_id"])
    op.create_index("ix_price_change_logs_status", "price_change_logs", ["status"])


def downgrade() -> None:
    op.drop_table("price_change_logs")
    op.drop_table("sync_runs")
    op.drop_table("vendor_price_snapshots")
    op.drop_table("products")