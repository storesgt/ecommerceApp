# Standalone Linux Deployment

This package runs the storefront, admin dashboard, API, MySQL, migrations, and persistent uploads with Docker Compose.

## Requirements

- Linux VPS or hosting account with Docker Engine and Docker Compose v2
- A domain name pointing to the server for public HTTPS access

## Install

```bash
git clone YOUR_REPOSITORY_URL ecommerceApp
cd ecommerceApp
chmod +x install.sh
./install.sh
```

The installer creates `.env`, generates database/JWT secrets, builds the image, applies Prisma migrations, and starts the stack.

Before public access, edit `.env`:

```env
APP_URL=https://yourdomain.com
CORS_ORIGIN=https://yourdomain.com
```

Then apply the change:

```bash
docker compose up -d
```

The application is served from the API container on port `4000`. Put Nginx, Caddy, or your hosting provider's reverse proxy in front of it and terminate HTTPS there.

## Operations

```bash
docker compose ps
docker compose logs -f api
docker compose restart api
docker compose down
docker compose up -d --build
curl http://127.0.0.1:4000/health
```

MySQL data and uploaded media use named Docker volumes. Do not run `docker compose down -v` unless you intend to delete application data.

## Backups

Back up the database and uploads regularly:

```bash
docker compose exec -T mysql sh -c 'exec mysqldump --single-transaction -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' > ground-backup.sql
docker compose exec -T api tar czf - -C /app/uploads . > uploads-backup.tar.gz
```

## cPanel Node.js deployment

Follow the [beginner-friendly cPanel deployment guide](./CPANEL_DEPLOYMENT.md)
for prerequisites, database creation, environment setup, production migrations,
Passenger startup, verification, upgrades, and troubleshooting.
