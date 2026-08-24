from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal


@dataclass
class VendorProduct:
    product_id: str
    name: str
    price: Decimal
    currency: str = "USD"
    updated_at: datetime | None = None


def _seed_products() -> list[VendorProduct]:
    seeded_at = datetime.now(timezone.utc)
    catalog = [
        ("Beverages", "Sparkling Water", "2.00"), ("Beverages", "Cola Drink", "2.25"),
        ("Beverages", "Citrus Soda", "2.15"), ("Beverages", "Berry Juice", "3.25"),
        ("Beverages", "Iced Tea", "2.75"), ("Beverages", "Cold Brew Coffee", "4.50"),
        ("Beverages", "Coconut Water", "3.00"), ("Beverages", "Ginger Tonic", "2.50"),
        ("Grocery", "Long Grain Rice", "4.20"), ("Grocery", "Wheat Pasta", "2.10"),
        ("Grocery", "Tomato Pasta Sauce", "3.40"), ("Grocery", "Golden Honey", "6.25"),
        ("Grocery", "Peanut Spread", "4.75"), ("Grocery", "All Purpose Flour", "3.10"),
        ("Grocery", "Brown Sugar", "2.80"), ("Grocery", "Sea Salt", "1.70"),
        ("Dairy", "Whole Milk", "3.60"), ("Dairy", "Plain Yogurt", "3.25"),
        ("Dairy", "Cheddar Block", "5.50"), ("Dairy", "Salted Butter", "4.40"),
        ("Dairy", "Cage Free Eggs", "4.90"), ("Dairy", "Oat Creamer", "3.85"),
        ("Dairy", "Cottage Cheese", "3.75"), ("Frozen", "Garden Peas", "2.90"),
        ("Frozen", "Mixed Berries", "5.20"), ("Frozen", "Vegetable Pizza", "6.80"),
        ("Frozen", "Potato Wedges", "4.10"), ("Frozen", "Chicken Dumplings", "7.25"),
        ("Frozen", "Mango Chunks", "4.60"), ("Frozen", "Spinach Portions", "3.35"),
        ("Household", "Paper Towels", "8.50"), ("Household", "Laundry Powder", "9.75"),
        ("Household", "Dish Liquid", "3.15"), ("Household", "Glass Cleaner", "3.80"),
        ("Household", "Trash Bags", "7.40"), ("Household", "Storage Containers", "11.50"),
        ("Household", "Microfiber Cloths", "5.25"), ("Health and Fitness", "Vitamin C Tablets", "7.80"),
        ("Health and Fitness", "First Aid Kit", "12.50"), ("Health and Fitness", "Hand Sanitizer", "4.20"),
        ("Health and Fitness", "Foam Roller", "18.00"), ("Health and Fitness", "Resistance Bands", "14.50"),
        ("Health and Fitness", "Reusable Water Bottle", "16.00"), ("Health and Fitness", "Cooling Towel", "8.75"),
        ("Snacks", "Sea Salt Crackers", "3.20"), ("Snacks", "Trail Mix", "5.90"),
        ("Snacks", "Granola Bites", "4.60"), ("Snacks", "Pretzel Twists", "3.35"),
        ("Snacks", "Dried Apple Rings", "4.25"), ("Snacks", "Rice Snacks", "3.75"),
        ("Snacks", "Dark Chocolate Squares", "5.10"), ("Electronics", "USB-C Cable", "7.50"),
        ("Electronics", "Wireless Mouse", "18.00"), ("Electronics", "Desk Charger", "22.00"),
        ("Electronics", "Earbuds Case", "9.50"), ("Electronics", "LED Desk Lamp", "24.00"),
        ("Electronics", "Phone Stand", "12.00"), ("Electronics", "Keyboard Cover", "10.50"),
        ("Electronics", "Portable Battery", "28.00"), ("Electronics", "HDMI Adapter", "13.50"),
    ]
    products = []
    for index, (_, name, cost) in enumerate(catalog, start=1):
        base_price = Decimal(cost)
        multiplier = (Decimal("1.00"), Decimal("1.05"), Decimal("1.18"), Decimal("1.30"))[index % 4]
        products.append(VendorProduct(
            f"VND-{index:03d}", name, (base_price * multiplier).quantize(Decimal("0.01")), updated_at=seeded_at
        ))
    products.extend([
        VendorProduct("VND-061", "Bulk Storage Crate", Decimal("19.00"), updated_at=seeded_at),
        VendorProduct("VND-062", "Countertop Timer", Decimal("8.00"), updated_at=seeded_at),
    ])
    return products


class VendorRepository:
    def __init__(self) -> None:
        self._seed = _seed_products()
        self._products = {product.product_id: deepcopy(product) for product in self._seed}

    def list(self) -> list[VendorProduct]:
        return list(self._products.values())

    def get(self, product_id: str) -> VendorProduct | None:
        return self._products.get(product_id)

    def update_price(self, product_id: str, price: Decimal) -> VendorProduct | None:
        product = self.get(product_id)
        if product is None:
            return None
        product.price = price.quantize(Decimal("0.01"))
        product.updated_at = datetime.now(timezone.utc)
        return product

    def reset(self) -> list[VendorProduct]:
        self._products = {product.product_id: deepcopy(product) for product in self._seed}
        return self.list()