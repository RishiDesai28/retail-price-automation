"""enforce one product mapping per vendor product id

Revision ID: 0002_unique_vendor_product_id
Revises: 0001_initial_schema
Create Date: 2026-08-25
"""
from alembic import op


revision = "0002_unique_vendor_product_id"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_products_vendor_product_id",
        "products",
        ["vendor_product_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_products_vendor_product_id", "products", type_="unique")
