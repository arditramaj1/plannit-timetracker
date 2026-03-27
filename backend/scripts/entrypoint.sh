#!/usr/bin/env bash
set -euo pipefail

/app/scripts/wait-for-db.sh

python manage.py migrate --noinput

if [[ "${DJANGO_COLLECTSTATIC:-0}" == "1" ]]; then
  python manage.py collectstatic --noinput
fi

if [[ "${DJANGO_SEED_DEMO_DATA:-0}" == "1" || "${DJANGO_SEED_SUPERUSER_ONLY:-0}" == "1" ]]; then
  python manage.py seed_demo_data || true
fi

exec "$@"
