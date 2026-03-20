FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && rm -rf /var/lib/apt/lists/*

RUN pip install poetry==1.8.0 && poetry config virtualenvs.create false

COPY pyproject.toml poetry.lock* ./
RUN poetry install --only main --no-interaction --no-ansi --no-root

RUN python -m spacy download en_core_web_sm

COPY . .

CMD ["celery", "-A", "apps.workers.celery_app", "worker", "--loglevel=info"]
