from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models import PriceChangeLog, Product, SyncRun
from app.pricing_engine import gross_margin_percent, gross_profit_per_unit, suggested_retail_price
from app.schemas import ManualPricingRequest, ManualPricingResponse, PricingCalculationResponse


def calculate_pricing(request: ManualPricingRequest, current_target_margin: Decimal | None = None) -> PricingCalculationResponse:
    vendor_cost = request.vendor_cost
    if vendor_cost is None:
        raise ValueError("vendor_cost is required")

    target_margin = request.target_margin_pct if request.target_margin_pct is not None else current_target_margin
    if request.pricing_mode == "margin_based":
        if target_margin is None:
            raise ValueError("target_margin_pct is required for margin_based pricing")
        pos_price = suggested_retail_price(vendor_cost, target_margin)
        return PricingCalculationResponse(
            suggested_pos_price=pos_price,
            resulting_gross_margin_pct=gross_margin_percent(vendor_cost, pos_price),
            gross_profit_per_unit=gross_profit_per_unit(vendor_cost, pos_price),
        )

    if request.pos_price is None:
        raise ValueError("pos_price is required for manual_price pricing")
    return PricingCalculationResponse(
        suggested_pos_price=None,
        resulting_gross_margin_pct=gross_margin_percent(vendor_cost, request.pos_price),
        gross_profit_per_unit=gross_profit_per_unit(vendor_cost, request.pos_price),
    )


def apply_manual_pricing(session: Session, product_id: int, request: ManualPricingRequest) -> ManualPricingResponse:
    product = session.get(Product, product_id)
    if product is None:
        raise LookupError("Product not found")

    calculation = calculate_pricing(request, product.target_margin_pct)
    new_pos_price = calculation.suggested_pos_price or request.pos_price
    if new_pos_price is None or request.vendor_cost is None:
        raise ValueError("A valid vendor cost and POS price are required")

    previous_vendor_cost = product.current_vendor_cost
    previous_pos_price = product.current_pos_price
    target_margin = request.target_margin_pct if request.target_margin_pct is not None else product.target_margin_pct
    product.current_vendor_cost = request.vendor_cost
    product.current_pos_price = new_pos_price
    if request.target_margin_pct is not None:
        product.target_margin_pct = request.target_margin_pct
    if request.auto_update_enabled is not None:
        product.auto_update_enabled = request.auto_update_enabled
    if request.active is not None:
        product.active = request.active

    now = datetime.now(timezone.utc)
    sync_run = SyncRun(
        started_at=now,
        completed_at=now,
        status="completed",
        vendor_records_received=0,
        products_matched=1,
        prices_changed=1,
        prices_updated=1,
    )
    session.add(sync_run)
    session.flush()
    log = PriceChangeLog(
        sync_run_id=sync_run.id,
        product_id=product.id,
        vendor_product_id=product.vendor_product_id,
        product_name=product.name,
        old_vendor_cost=previous_vendor_cost,
        new_vendor_cost=request.vendor_cost,
        old_pos_price=previous_pos_price,
        suggested_pos_price=calculation.suggested_pos_price,
        new_pos_price=new_pos_price,
        change_pct=None,
        target_margin_pct=target_margin,
        status="manually_updated",
        source="manual_dashboard_edit",
        reason=request.reason.strip(),
        processed_at=now,
    )
    session.add(log)
    session.flush()
    return ManualPricingResponse(
        product=product,
        previous_vendor_cost=previous_vendor_cost,
        previous_pos_price=previous_pos_price,
        new_vendor_cost=request.vendor_cost,
        new_pos_price=new_pos_price,
        target_margin_pct=target_margin,
        gross_profit_per_unit=calculation.gross_profit_per_unit,
        gross_margin_pct=calculation.resulting_gross_margin_pct,
        pricing_mode=request.pricing_mode,
        audit_log_id=log.id,
    )
