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

# Threaded workers: a self-host has few CPUs but must not let one slow request
# (a big streamed upload/download, an SMTP send) starve every other request.
# gthread keeps each worker serving many concurrent requests while blocked on
# I/O. --max-requests recycles workers periodically so any slow leak (e.g. a
# large blob buffered in a C extension) can't grow unbounded; the jitter avoids
# all workers recycling at once.
exec gunicorn config.wsgi:application \
  --bind "0.0.0.0:${PORT:-8000}" \
  --workers "${WEB_CONCURRENCY:-3}" \
  --worker-class "${GUNICORN_WORKER_CLASS:-gthread}" \
  --threads "${GUNICORN_THREADS:-8}" \
  --timeout "${GUNICORN_TIMEOUT:-120}" \
  --graceful-timeout "${GUNICORN_GRACEFUL_TIMEOUT:-30}" \
  --max-requests "${GUNICORN_MAX_REQUESTS:-1000}" \
  --max-requests-jitter "${GUNICORN_MAX_REQUESTS_JITTER:-100}"
