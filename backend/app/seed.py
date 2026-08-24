from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import select

from app.database import SessionLocal
from app.models import Product


CATALOG = [
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


def seed_products() -> int:
    created = 0
    with SessionLocal.begin() as session:
        existing_skus = set(session.scalars(select(Product.sku)))
        for index, (category, name, cost_text) in enumerate(CATALOG, start=1):
            sku = f"SKU-{index:03d}"
            if sku in existing_skus:
                continue
            cost = Decimal(cost_text)
            margin = Decimal((20, 25, 30, 35, 40, 45)[index % 6])
            pos_price = (cost / (Decimal("1") - margin / Decimal("100"))).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            session.add(Product(
                sku=sku,
                name=name,
                category=category,
                vendor_product_id=f"VND-{index:03d}",
                current_vendor_cost=cost,
                current_pos_price=pos_price,
                target_margin_pct=margin,
                auto_update_enabled=index % 3 != 0,
                active=True,
            ))
            created += 1
    return created


if __name__ == "__main__":
    print(f"Seeded {seed_products()} new products.")