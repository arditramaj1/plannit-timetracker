FROM python:3.12-slim AS base

ARG UV_VERSION=0.11.0

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/app/.venv \
    PATH="/app/.venv/bin:${PATH}"

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential curl libpq-dev netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

RUN curl -LsSf "https://astral.sh/uv/${UV_VERSION}/install.sh" | sh \
    && ln -s /root/.local/bin/uv /usr/local/bin/uv \
    && rm -rf /var/lib/apt/lists/*

FROM base AS development
COPY pyproject.toml uv.lock .python-version /app/
RUN uv sync --locked

COPY . /app
RUN chmod +x /app/scripts/*.sh
CMD ["/app/scripts/start-dev.sh"]

FROM base AS production
COPY pyproject.toml uv.lock .python-version /app/
RUN uv sync --locked --no-dev

COPY . /app
RUN chmod +x /app/scripts/*.sh
CMD ["/app/scripts/start-prod.sh"]
