#!/usr/bin/env bash
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Install Docker Engine and the Compose plugin first."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 is required."
  exit 1
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "OpenSSL is required to generate secure credentials."
  exit 1
fi

if [ ! -f .env ]; then
  MYSQL_ROOT_PASSWORD="$(openssl rand -hex 32)"
  DB_PASSWORD="$(openssl rand -hex 32)"
  JWT_SECRET="$(openssl rand -hex 48)"

  cat > .env <<EOF_ENV
MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}
DB_NAME=ground
DB_USER=ground
DB_PASSWORD=${DB_PASSWORD}
DATABASE_URL=mysql://ground:${DB_PASSWORD}@mysql:3306/ground
JWT_SECRET=${JWT_SECRET}
PORT=4000
APP_PORT=4000
CORS_ORIGIN=http://localhost:4000
APP_URL=http://localhost:4000
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM=Ground <no-reply@example.com>
PAYSTACK_SECRET_KEY=
EOF_ENV

  chmod 600 .env
  unset MYSQL_ROOT_PASSWORD DB_PASSWORD JWT_SECRET
  echo "Created .env with securely generated credentials."
else
  echo "Existing .env detected. It has not been overwritten."
fi

docker compose up -d --build

echo "Ground installation started."
echo "Health check: curl http://localhost:${APP_PORT:-4000}/health"
echo "Update APP_URL and CORS_ORIGIN before public use."
