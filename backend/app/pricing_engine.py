import os
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP


MONEY_QUANTUM = Decimal("0.01")
DEFAULT_AUTO_UPDATE_THRESHOLD_PERCENT = Decimal("10")


@dataclass(frozen=True)
class PricingDecision:
    outcome: str
    old_vendor_cost: Decimal | None
    new_vendor_cost: Decimal
    change_percent: Decimal | None
    suggested_retail_price: Decimal
    new_retail_price: Decimal | None


def _money(value: Decimal) -> Decimal:
    return value.quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)


def _validate_vendor_cost(vendor_cost: Decimal) -> None:
    if vendor_cost <= 0:
        raise ValueError("vendor cost must be greater than zero")


def _validate_margin(target_margin_percent: Decimal) -> None:
    if target_margin_percent < 0 or target_margin_percent >= 100:
        raise ValueError("target margin must be at least 0 and less than 100")


def suggested_retail_price(vendor_cost: Decimal, target_margin_percent: Decimal) -> Decimal:
    _validate_vendor_cost(vendor_cost)
    _validate_margin(target_margin_percent)
    margin_decimal = target_margin_percent / Decimal("100")
    return _money(vendor_cost / (Decimal("1") - margin_decimal))


def percentage_change(old_cost: Decimal | None, new_cost: Decimal) -> Decimal | None:
    _validate_vendor_cost(new_cost)
    if old_cost is None or old_cost == 0:
        return None
    return ((new_cost - old_cost) / old_cost) * Decimal("100")


def _threshold_percent() -> Decimal:
    configured = os.getenv("AUTO_UPDATE_THRESHOLD_PERCENT")
    threshold = Decimal(configured) if configured is not None else DEFAULT_AUTO_UPDATE_THRESHOLD_PERCENT
    if threshold < 0:
        raise ValueError("auto-update threshold must not be negative")
    return threshold


def evaluate_price_change(
    old_vendor_cost: Decimal | None,
    new_vendor_cost: Decimal,
    target_margin_percent: Decimal,
    auto_update_enabled: bool,
) -> PricingDecision:
    suggested_price = suggested_retail_price(new_vendor_cost, target_margin_percent)
    change = percentage_change(old_vendor_cost, new_vendor_cost)
    changed = old_vendor_cost is None or old_vendor_cost != new_vendor_cost

    if not changed:
        outcome = "no_change"
        new_retail_price = None
    elif auto_update_enabled and change is not None and abs(change) <= _threshold_percent():
        outcome = "updated"
        new_retail_price = suggested_price
    else:
        outcome = "review_required"
        new_retail_price = None

    return PricingDecision(
        outcome=outcome,
        old_vendor_cost=old_vendor_cost,
        new_vendor_cost=new_vendor_cost,
        change_percent=change,
        suggested_retail_price=suggested_price,
        new_retail_price=new_retail_price,
    )