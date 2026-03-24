#!/usr/bin/env bash
set -euo pipefail

/app/scripts/wait-for-db.sh

python manage.py migrate --noinput

if [[ "${DJANGO_COLLECTSTATIC:-1}" == "1" ]]; then
  python manage.py collectstatic --noinput
fi

if [[ "${DJANGO_SEED_DEMO_DATA:-1}" == "1" ]]; then
  python manage.py seed_demo_data || true
fi

exec "$@"
