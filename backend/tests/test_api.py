from datetime import datetime, timezone
from decimal import Decimal

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database import Base
from app.main import (
    approve_price_change_endpoint,
    dashboard_summary,
    list_price_changes,
    list_products,
    reject_price_change_endpoint,
)
from app.models import PriceChangeLog, Product, SyncRun
from app.schemas import RejectionRequest
from app.sync_service import run_vendor_price_sync


@pytest.fixture
def session():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as database:
        yield database
    Base.metadata.drop_all(engine)


def add_product(session: Session, vendor_id: str, name: str = "Test Product", **values) -> Product:
    product = Product(
        sku=values.pop("sku", f"SKU-{vendor_id}"),
        name=name,
        category=values.pop("category", "Grocery"),
        vendor_product_id=vendor_id,
        current_vendor_cost=values.pop("current_vendor_cost", Decimal("10.00")),
        current_pos_price=values.pop("current_pos_price", Decimal("14.29")),
        target_margin_pct=values.pop("target_margin_pct", Decimal("30")),
        auto_update_enabled=values.pop("auto_update_enabled", True),
        active=values.pop("active", True),
        **values,
    )
    session.add(product)
    session.commit()
    session.refresh(product)
    return product


def vendor_product(product_id: str, price: str, name: str = "Test Product") -> dict:
    return {
        "product_id": product_id,
        "name": name,
        "price": price,
        "currency": "USD",
    }


def test_successful_sync_creates_snapshot_and_totals(session: Session, monkeypatch) -> None:
    add_product(session, "VND-001")
    monkeypatch.setattr("app.sync_service.fetch_vendor_products", lambda _: [vendor_product("VND-001", "10.00")])

    sync_run = run_vendor_price_sync(session, "http://vendor")

    assert sync_run.status == "completed"
    assert sync_run.vendor_records_received == 1
    assert sync_run.products_matched == 1
    assert session.query(PriceChangeLog).one().status == "no_change"
    assert session.query(Product).one().current_vendor_cost == Decimal("10.00")


def test_auto_update_result(session: Session, monkeypatch) -> None:
    product = add_product(session, "VND-001")
    monkeypatch.setattr("app.sync_service.fetch_vendor_products", lambda _: [vendor_product("VND-001", "10.50")])

    run_vendor_price_sync(session, "http://vendor")

    session.refresh(product)
    log = session.query(PriceChangeLog).one()
    assert log.status == "updated"
    assert product.current_vendor_cost == Decimal("10.50")
    assert product.current_pos_price == Decimal("15.00")


def test_review_required_result(session: Session, monkeypatch) -> None:
    product = add_product(session, "VND-001")
    original_price = product.current_pos_price
    monkeypatch.setattr("app.sync_service.fetch_vendor_products", lambda _: [vendor_product("VND-001", "12.00")])

    run_vendor_price_sync(session, "http://vendor")

    session.refresh(product)
    assert session.query(PriceChangeLog).one().status == "review_required"
    assert product.current_pos_price == original_price


def test_unmatched_vendor_product(session: Session, monkeypatch) -> None:
    monkeypatch.setattr("app.sync_service.fetch_vendor_products", lambda _: [vendor_product("VND-999", "5.00", "Vendor Only")])

    sync_run = run_vendor_price_sync(session, "http://vendor")
    log = session.query(PriceChangeLog).one()

    assert sync_run.unmatched_vendor_products == 1
    assert log.status == "unmatched"
    assert log.product_id is None
    assert session.query(PriceChangeLog).count() == 1


def test_dashboard_summary(session: Session) -> None:
    add_product(session, "VND-001")
    sync_run = SyncRun(status="completed", vendor_records_received=1, products_matched=1)
    session.add(sync_run)
    session.flush()
    session.add(PriceChangeLog(
        sync_run_id=sync_run.id,
        product_id=1,
        vendor_product_id="VND-001",
        product_name="Test Product",
        new_vendor_cost=Decimal("11.00"),
        status="review_required",
        reason="Needs review",
        processed_at=datetime.now(timezone.utc),
    ))
    session.commit()

    summary = dashboard_summary(session)

    assert summary.products_monitored == 1
    assert summary.review_required_count == 1
    assert summary.changes_today == 1
    assert summary.total_price_change_logs == 1
    assert summary.most_recent_sync is not None


def test_product_filtering(session: Session) -> None:
    add_product(session, "VND-001", "Green Tea", category="Beverages")
    add_product(session, "VND-002", "Rice Bowl", category="Grocery", auto_update_enabled=False, sku="SKU-002")

    result = list_products(
        search="tea", category="Beverages", active=True, auto_update_enabled=True,
        page=1, page_size=25, session=session,
    )

    assert [product.name for product in result.items] == ["Green Tea"]
    assert result.pagination.total == 1


def test_product_search_is_case_insensitive_and_normalizes_whitespace(session: Session) -> None:
    add_product(session, "VND-001", "Whole Milk - 1 Gallon", category="Dairy", sku="SKU-001")
    add_product(session, "VND-002", "Whole Milk - Half Gallon", category="Dairy", sku="SKU-002")

    result = list_products(search="  WHOLE   MILK  ", page=1, page_size=10, session=session)

    assert [product.name for product in result.items] == [
        "Whole Milk - 1 Gallon",
        "Whole Milk - Half Gallon",
    ]
    assert result.pagination.total == 2


def test_product_search_matches_sku_vendor_id_and_category(session: Session) -> None:
    add_product(session, "VND-001", "Cocoa", category="Beverages", sku="SKU-COCOA")
    add_product(session, "VND-002", "Rice", category="Grocery", sku="SKU-RICE")

    assert [product.name for product in list_products(search="sku-cocoa", page=1, page_size=10, session=session).items] == ["Cocoa"]
    assert [product.name for product in list_products(search="vnd-002", page=1, page_size=10, session=session).items] == ["Rice"]
    assert [product.name for product in list_products(search="grocery", page=1, page_size=10, session=session).items] == ["Rice"]


def test_product_search_ranks_exact_prefix_and_partial_name_matches(session: Session) -> None:
    add_product(session, "VND-001", "Milk", sku="SKU-001")
    add_product(session, "VND-002", "Whole Milk", sku="SKU-002")
    add_product(session, "VND-003", "Chocolate Milkshake", sku="SKU-003")

    result = list_products(search="milk", page=1, page_size=10, session=session)

    assert [product.name for product in result.items] == ["Milk", "Whole Milk", "Chocolate Milkshake"]


def test_product_search_paginates_after_filtering_and_preserves_variants(session: Session) -> None:
    for index in range(1, 4):
        add_product(
            session,
            f"VND-{index:03d}",
            f"Whole Milk - Variant {index}",
            category="Dairy",
            sku=f"SKU-{index:03d}",
        )

    result = list_products(search="whole milk", category="Dairy", page=2, page_size=2, session=session)

    assert [product.name for product in result.items] == ["Whole Milk - Variant 3"]
    assert result.pagination.total == 3
    assert result.pagination.page == 2
    assert result.pagination.total_pages == 2


def test_audit_log_filtering(session: Session) -> None:
    product = add_product(session, "VND-001")
    sync_run = SyncRun(status="completed", vendor_records_received=1, products_matched=1)
    session.add(sync_run)
    session.flush()
    for status, name in (("updated", "Green Tea"), ("review_required", "Rice Bowl")):
        session.add(PriceChangeLog(
            sync_run_id=sync_run.id,
            product_id=product.id,
            vendor_product_id="VND-001",
            product_name=name,
            new_vendor_cost=Decimal("11.00"),
            status=status,
            reason="Test",
        ))
    session.commit()

    result = list_price_changes(
        status="updated", search="Green", page=1, page_size=10,
        sort_by="processed_at", sort_order="desc", session=session,
    )

    assert len(result.items) == 1
    assert result.items[0].status == "updated"
    assert result.pagination.total == 1


def add_review_log(session: Session, product: Product, status: str = "review_required") -> PriceChangeLog:
    sync_run = SyncRun(status="completed", vendor_records_received=1, products_matched=1)
    session.add(sync_run)
    session.flush()
    log = PriceChangeLog(
        sync_run_id=sync_run.id,
        product_id=product.id,
        vendor_product_id=product.vendor_product_id,
        product_name=product.name,
        old_vendor_cost=product.current_vendor_cost,
        new_vendor_cost=Decimal("12.00"),
        old_pos_price=product.current_pos_price,
        suggested_pos_price=Decimal("17.14"),
        target_margin_pct=product.target_margin_pct,
        status=status,
        reason="Cost changed beyond threshold.",
    )
    session.add(log)
    session.commit()
    session.refresh(log)
    return log


def test_approve_review_required_updates_product_and_log(session: Session) -> None:
    product = add_product(session, "VND-001")
    log = add_review_log(session, product)

    result = approve_price_change_endpoint(log.id, session)

    session.refresh(product)
    assert result.status == "updated"
    assert result.new_pos_price == Decimal("17.14")
    assert result.reviewed_at is not None
    assert "manually approved" in result.reason.lower()
    assert product.current_vendor_cost == Decimal("12.00")
    assert product.current_pos_price == Decimal("17.14")


def test_reject_review_required_preserves_product_price(session: Session) -> None:
    product = add_product(session, "VND-001")
    original_cost = product.current_vendor_cost
    original_price = product.current_pos_price
    log = add_review_log(session, product)

    result = reject_price_change_endpoint(log.id, RejectionRequest(rejection_reason="Margin is too thin."), session)

    session.refresh(product)
    assert result.status == "rejected"
    assert result.reviewed_at is not None
    assert "Margin is too thin." in result.reason
    assert product.current_vendor_cost == original_cost
    assert product.current_pos_price == original_price
    assert result.new_vendor_cost == Decimal("12.00")
    assert result.suggested_pos_price == Decimal("17.14")


def test_approval_of_non_review_record_is_rejected(session: Session) -> None:
    product = add_product(session, "VND-001")
    log = add_review_log(session, product, status="updated")

    with pytest.raises(HTTPException) as error:
        approve_price_change_endpoint(log.id, session)

    assert error.value.status_code == 409


def test_rejection_of_non_review_record_is_rejected(session: Session) -> None:
    product = add_product(session, "VND-001")
    log = add_review_log(session, product, status="no_change")

    with pytest.raises(HTTPException) as error:
        reject_price_change_endpoint(log.id, RejectionRequest(rejection_reason="Not needed."), session)

    assert error.value.status_code == 409


def test_rejection_requires_non_empty_reason() -> None:
    with pytest.raises(ValueError):
        RejectionRequest(rejection_reason="   ")