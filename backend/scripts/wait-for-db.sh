#!/usr/bin/env bash
set -euo pipefail

host="${POSTGRES_HOST:-db}"
port="${POSTGRES_PORT:-5432}"

until nc -z "$host" "$port"; do
  echo "Waiting for PostgreSQL at ${host}:${port}..."
  sleep 1
done

echo "PostgreSQL is available."

