"""track the source of price changes

Revision ID: 0003_add_price_change_source
Revises: 0002_unique_vendor_product_id
Create Date: 2026-08-25
"""
from alembic import op
import sqlalchemy as sa


revision = "0003_add_price_change_source"
down_revision = "0002_unique_vendor_product_id"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "price_change_logs",
        sa.Column("source", sa.String(length=40), nullable=False, server_default="vendor_sync"),
    )
    op.alter_column("price_change_logs", "source", server_default=None)


def downgrade() -> None:
    op.drop_column("price_change_logs", "source")
