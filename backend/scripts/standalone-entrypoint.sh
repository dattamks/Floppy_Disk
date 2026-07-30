#!/bin/sh
# Single-container entrypoint: migrate, collect admin/DRF static, run periodic
# maintenance in a background loop (no Celery beat), then serve API + SPA from
# one gunicorn. Everything lives in one process tree, one container.
set -e

python manage.py migrate --noinput
python manage.py collectstatic --noinput

# Broker-free periodic maintenance, inside the same container.
( while true; do
    sleep "${MAINTENANCE_INTERVAL_SECONDS:-3600}"
    python manage.py maintenance || true
  done ) &

exec gunicorn config.wsgi:application \
  --bind "0.0.0.0:${PORT:-8000}" \
  --workers "${WEB_CONCURRENCY:-3}" \
  --timeout "${GUNICORN_TIMEOUT:-120}"
