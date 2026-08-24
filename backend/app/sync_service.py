import json
from datetime import datetime, timezone
from decimal import Decimal
from urllib.request import Request, urlopen

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import PriceChangeLog, Product, SyncRun, VendorPriceSnapshot
from app.pricing_engine import evaluate_price_change


def fetch_vendor_products(vendor_api_url: str) -> list[dict]:
    request = Request(f"{vendor_api_url.rstrip('/')}/vendor/products")
    with urlopen(request, timeout=30) as response:
        return json.loads(response.read())


def run_vendor_price_sync(session: Session, vendor_api_url: str) -> SyncRun:
    sync_run = SyncRun(
        status="running",
        vendor_records_received=0,
        products_matched=0,
        prices_changed=0,
        prices_updated=0,
        review_required=0,
        unmatched_vendor_products=0,
    )
    session.add(sync_run)
    session.commit()
    session.refresh(sync_run)

    try:
        vendor_products = fetch_vendor_products(vendor_api_url)
        local_products = {
            product.vendor_product_id: product
            for product in session.scalars(select(Product)).all()
        }
        sync_run.vendor_records_received = len(vendor_products)

        for vendor_product in vendor_products:
            vendor_product_id = vendor_product["product_id"]
            vendor_cost = Decimal(str(vendor_product["price"]))
            product = local_products.get(vendor_product_id)
            session.add(VendorPriceSnapshot(
                product_id=product.id if product else None,
                vendor_product_id=vendor_product_id,
                product_name=vendor_product["name"],
                vendor_price=vendor_cost,
                currency=vendor_product.get("currency", "USD"),
                source="vendor-api",
            ))

            if product is None:
                sync_run.unmatched_vendor_products += 1
                session.add(PriceChangeLog(
                    sync_run_id=sync_run.id,
                    vendor_product_id=vendor_product_id,
                    product_name=vendor_product["name"],
                    new_vendor_cost=vendor_cost,
                    status="unmatched",
                    reason="No local product matches this vendor product ID.",
                ))
                continue

            sync_run.products_matched += 1
            old_cost = product.current_vendor_cost
            decision = evaluate_price_change(
                old_cost, vendor_cost, product.target_margin_pct, product.auto_update_enabled
            )
            old_pos_price = product.current_pos_price
            if decision.outcome == "no_change":
                status = "no_change"
                reason = "Vendor cost is unchanged."
                sync_run.prices_changed += 0
            elif decision.outcome == "updated":
                status = "updated"
                reason = "Cost changed within the automatic-update threshold."
                product.current_vendor_cost = vendor_cost
                product.current_pos_price = decision.new_retail_price
                sync_run.prices_changed += 1
                sync_run.prices_updated += 1
            else:
                status = "review_required"
                reason = "Cost changed outside the automatic-update rules and requires review."
                sync_run.prices_changed += 1
                sync_run.review_required += 1

            session.add(PriceChangeLog(
                sync_run_id=sync_run.id,
                product_id=product.id,
                vendor_product_id=vendor_product_id,
                product_name=vendor_product["name"],
                old_vendor_cost=old_cost,
                new_vendor_cost=vendor_cost,
                old_pos_price=old_pos_price,
                suggested_pos_price=decision.suggested_retail_price,
                new_pos_price=decision.new_retail_price,
                change_pct=decision.change_percent,
                target_margin_pct=product.target_margin_pct,
                status=status,
                reason=reason,
            ))

        sync_run.status = "completed"
        sync_run.completed_at = datetime.now(timezone.utc)
        session.commit()
        session.refresh(sync_run)
        return sync_run
    except Exception as error:
        session.rollback()
        failed_run = session.get(SyncRun, sync_run.id)
        if failed_run is not None:
            failed_run.status = "failed"
            failed_run.completed_at = datetime.now(timezone.utc)
            failed_run.error_message = str(error)
            session.commit()
            session.refresh(failed_run)
            return failed_run
        raise