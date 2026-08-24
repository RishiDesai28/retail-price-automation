from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import PriceChangeLog, Product


def approve_price_change(session: Session, log_id: int) -> PriceChangeLog:
    log = session.get(PriceChangeLog, log_id)
    if log is None:
        raise LookupError("Price change log not found")
    if log.status != "review_required":
        raise ValueError("Only review_required price changes can be approved")
    if log.product_id is None or log.suggested_pos_price is None:
        raise ValueError("Review-required price change has no approvable product price")

    product = session.get(Product, log.product_id)
    if product is None:
        raise LookupError("Product for price change log not found")
    product.current_vendor_cost = log.new_vendor_cost
    product.current_pos_price = log.suggested_pos_price
    log.status = "updated"
    log.new_pos_price = log.suggested_pos_price
    log.reviewed_at = datetime.now(timezone.utc)
    log.reason = f"{log.reason} Manually approved."
    session.commit()
    session.refresh(log)
    return log


def reject_price_change(session: Session, log_id: int, rejection_reason: str) -> PriceChangeLog:
    reason = rejection_reason.strip()
    if not reason:
        raise ValueError("rejection reason must not be empty")
    log = session.get(PriceChangeLog, log_id)
    if log is None:
        raise LookupError("Price change log not found")
    if log.status != "review_required":
        raise ValueError("Only review_required price changes can be rejected")

    log.status = "rejected"
    log.reviewed_at = datetime.now(timezone.utc)
    log.reason = f"{log.reason} Manually rejected: {reason}"
    session.commit()
    session.refresh(log)
    return log