#!/usr/bin/env bash
set -euo pipefail

host="${POSTGRES_HOST}"
port="${POSTGRES_PORT}"

until nc -z "$host" "$port"; do
  echo "Waiting for PostgreSQL at ${host}:${port}..."
  sleep 1
done

echo "PostgreSQL is available."

