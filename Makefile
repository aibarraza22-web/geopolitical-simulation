.PHONY: up down build migrate seed dev logs

# Start all services
up:
	docker compose up -d

# Stop all services
down:
	docker compose down

# Rebuild images
build:
	docker compose build

# Run database migrations
migrate:
	docker compose exec api alembic -c infra/migrations/alembic.ini upgrade head

# Seed initial data (entities + sources + default weights)
seed:
	docker compose exec api python -m infra.scripts.seed_entities
	docker compose exec api python -m infra.scripts.seed_sources

# Full fresh start: build, start, migrate, seed
bootstrap: build up
	@echo "Waiting for services..."
	@sleep 8
	$(MAKE) migrate
	$(MAKE) seed
	@echo "\n✓ GeoRisk platform is ready."
	@echo "  API:      http://localhost:8000"
	@echo "  Docs:     http://localhost:8000/docs"
	@echo "  Frontend: http://localhost:5173"

# Development (local Python, no Docker for API/workers)
dev-api:
	uvicorn apps.api.main:app --reload --port 8000

dev-worker:
	celery -A apps.workers.celery_app worker --loglevel=info

dev-beat:
	celery -A apps.workers.celery_app beat --loglevel=info

# Logs
logs:
	docker compose logs -f api worker

# Trigger one-time ingestion
ingest:
	docker compose exec worker celery -A apps.workers.celery_app call apps.workers.tasks.ingest_news.fetch_rss_task --args='["reuters"]'
	docker compose exec worker celery -A apps.workers.celery_app call apps.workers.tasks.ingest_news.fetch_rss_task --args='["bbc"]'
	docker compose exec worker celery -A apps.workers.celery_app call apps.workers.tasks.ingest_news.fetch_rss_task --args='["un_press"]'
	docker compose exec worker celery -A apps.workers.celery_app call apps.workers.tasks.ingest_government.fetch_ofac_task

# Recompute all scores
recompute:
	docker compose exec worker celery -A apps.workers.celery_app call apps.workers.tasks.score_compute.recompute_scores_task
