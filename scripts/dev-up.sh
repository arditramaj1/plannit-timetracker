#!/usr/bin/env bash
set -euo pipefail

[[ -f .env ]] || cp .env.example .env
[[ -f backend/.env ]] || cp backend/.env.example backend/.env
[[ -f frontend/.env.local ]] || cp frontend/.env.local.example frontend/.env.local

postgres_port="$(grep -E '^POSTGRES_PORT=' .env | tail -n 1 | cut -d= -f2-)"
postgres_port="${postgres_port:-5432}"

docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d "$@" db

for _ in $(seq 1 30); do
  if (echo >"/dev/tcp/127.0.0.1/${postgres_port}") >/dev/null 2>&1; then
    echo "PostgreSQL is available on 127.0.0.1:${postgres_port}."
    exit 0
  fi

  sleep 1
done

echo "PostgreSQL did not become reachable on 127.0.0.1:${postgres_port}." >&2
exit 1
