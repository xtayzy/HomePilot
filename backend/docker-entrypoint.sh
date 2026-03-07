#!/bin/sh
set -e

echo "Waiting for PostgreSQL at db:5433..."
for i in $(seq 1 30); do
  if python -c "
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(2)
try:
  s.connect(('db', 5433))
  s.close()
  exit(0)
except Exception:
  exit(1)
" 2>/dev/null; then
    echo "PostgreSQL is ready."
    break
  fi
  echo "Attempt $i/30: waiting 2s..."
  sleep 2
done

echo "Creating database tables..."
python -m app.db.create_tables_sync

echo "Running seed (cities, apartment types, tariffs)..."
python -m app.db.seed

echo "Starting application..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8001
