#!/bin/sh
# Exit immediately on any non-zero exit code
set -e

echo "==> Running database migrations..."
node dist/migrate.js

echo "==> Starting NestJS application..."
# exec replaces this shell process with node so that:
#   1. The container's PID 1 is node (receives SIGTERM/SIGINT for graceful shutdown)
#   2. The container exit code reflects the actual application exit code
exec node dist/main.js
