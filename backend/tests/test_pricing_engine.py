from decimal import Decimal

import pytest

from app.pricing_engine import evaluate_price_change, suggested_retail_price


def test_suggested_price_uses_margin_formula() -> None:
    assert suggested_retail_price(Decimal("12.00"), Decimal("30")) == Decimal("17.14")


def test_suggested_price_uses_round_half_up() -> None:
    assert suggested_retail_price(Decimal("1.005"), Decimal("0")) == Decimal("1.01")


def test_no_change() -> None:
    decision = evaluate_price_change(Decimal("10.00"), Decimal("10.00"), Decimal("30"), True)
    assert decision.outcome == "no_change"
    assert decision.change_percent == Decimal("0")


def test_change_inside_threshold_updates() -> None:
    decision = evaluate_price_change(Decimal("10.00"), Decimal("10.50"), Decimal("30"), True)
    assert decision.outcome == "updated"
    assert decision.new_retail_price == Decimal("15.00")


def test_change_above_threshold_requires_review() -> None:
    decision = evaluate_price_change(Decimal("10.00"), Decimal("12.00"), Decimal("30"), True)
    assert decision.outcome == "review_required"
    assert decision.change_percent == Decimal("20.0")


def test_auto_updates_disabled_requires_review() -> None:
    decision = evaluate_price_change(Decimal("10.00"), Decimal("10.50"), Decimal("30"), False)
    assert decision.outcome == "review_required"


@pytest.mark.parametrize("vendor_cost", [Decimal("0"), Decimal("-1")])
def test_invalid_vendor_cost(vendor_cost: Decimal) -> None:
    with pytest.raises(ValueError, match="vendor cost"):
        suggested_retail_price(vendor_cost, Decimal("30"))


@pytest.mark.parametrize("margin", [Decimal("-1"), Decimal("100"), Decimal("101")])
def test_invalid_margin(margin: Decimal) -> None:
    with pytest.raises(ValueError, match="target margin"):
        suggested_retail_price(Decimal("10"), margin)


def test_zero_old_vendor_cost_requires_review_without_division_error() -> None:
    decision = evaluate_price_change(Decimal("0"), Decimal("10.00"), Decimal("30"), True)
    assert decision.outcome == "review_required"
    assert decision.change_percent is None