# Retail Price Automation Dashboard

Phase 1 provides a runnable monorepo scaffold for the retail API, isolated mock vendor API, React frontend, and PostgreSQL database.

## Run with Docker Compose

1. Copy `.env.example` to `.env` and adjust values if needed.
2. Start the services:

	```bash
	docker compose up --build
	```

3. Open `http://localhost:5173`.

Health endpoints:

- Retail API: `http://localhost:8000/health`
- Vendor API: `http://localhost:8001/health`
- PostgreSQL: `localhost:5432`

Stop the stack with `docker compose down`. Add `-v` only when you also want to remove the database volume.

The application does not contain database models, seed data, pricing logic, or dashboard data yet. Those will be added in later phases.