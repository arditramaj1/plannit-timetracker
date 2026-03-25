#!/usr/bin/env bash
set -euo pipefail

/app/scripts/entrypoint.sh gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers "${GUNICORN_WORKERS}" --timeout "${GUNICORN_TIMEOUT}"
