# Retail Price Automation Dashboard

Phase 1 provides a runnable monorepo scaffold for the retail API, isolated mock vendor API, React frontend, and PostgreSQL database.

## Run with Docker Compose

1. Copy `.env.example` to `.env` and adjust values if needed.
2. Start the services:

	```bash
	docker compose up --build
	```

3. Open `http://localhost:5173`.

Compose forwards the frontend, retail API, vendor API, and PostgreSQL ports as `5173`, `8000`, `8001`, and `5432`. If one is already in use, set the matching `*_PORT` variable in `.env` before starting the stack. For example, `API_PORT=18000` forwards host port `18000` to the API container’s port `8000`.

Health endpoints:

- Retail API: `http://localhost:8000/health`
- Retail API docs: `http://localhost:8000/docs`
- Vendor API: `http://localhost:8001/health`
- PostgreSQL: `localhost:5432`

## Database migrations

The API container applies migrations automatically before starting. To apply or inspect migrations manually:

```bash
docker compose run --rm api alembic upgrade head
docker compose run --rm api alembic current
```

For a local backend environment, run these commands from `backend/` after setting `DATABASE_URL`:

```bash
alembic upgrade head
alembic current
```

Stop the stack with `docker compose down`. Add `-v` only when you also want to remove the database volume.

## Phase 2B demo data

The API container runs an idempotent seed after migrations. It creates 60 generic products across eight categories, with vendor costs, POS prices, target margins, and mixed automatic-update settings. Existing rows are left unchanged, so rerunning the seed is safe:

```bash
docker compose run --rm api python -m app.seed
```

The mock vendor API keeps 62 products in memory while its container runs. The 60 `VND-001` through `VND-060` records match the retail seed, and `VND-061` and `VND-062` are vendor-only records. Reset vendor prices to their original demo values with:

```bash
curl -X POST http://localhost:8001/vendor/reset
```

Vendor prices can be changed dynamically and read back immediately:

```bash
curl -X PATCH http://localhost:8001/vendor/products/VND-001/price \
	-H 'Content-Type: application/json' -d '{"price": 13.50}'
curl http://localhost:8001/vendor/products/VND-001
```

Phase 2B does not include sync processing or the full frontend dashboard.