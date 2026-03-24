#!/usr/bin/env bash
set -euo pipefail

/app/scripts/entrypoint.sh gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers "${GUNICORN_WORKERS:-3}" --timeout "${GUNICORN_TIMEOUT:-60}"
