# Standalone Linux Deployment

This package runs the storefront, admin dashboard, API, PostgreSQL, Redis, migrations, and persistent uploads with Docker Compose.

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

PostgreSQL, Redis, and uploaded media use named Docker volumes. Do not run `docker compose down -v` unless you intend to delete application data.

## Backups

Back up the database and uploads regularly:

```bash
docker compose exec -T postgres pg_dump -U ground ground > ground-backup.sql
docker run --rm -v ground-commerce_ground-uploads:/uploads -v "$PWD":/backup busybox tar czf /backup/uploads-backup.tar.gz -C / uploads
```

## cPanel Node.js deployment

For a cPanel Node.js application, upload the source files and the compiled `dist` directory, then run these commands from the application root:

```bash
cd ~/ecommerceApp
source /home/sgtglob1/nodevenv/ecommerceApp/22/bin/activate
npm install

# Confirm newly added source files were uploaded before building.
test -f server/src/middleware/activity-log.ts || { echo "Missing server/src/middleware/activity-log.ts"; exit 1; }

# Existing production databases created with `prisma db push` must be baselined once.
# Resolve every migration that is already represented by the live schema, but leave
# any newly added migration unresolved.
for migration in $(find prisma/migrations -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort | grep -v '^20260916120000_widen_kyc_screening_notes$'); do
	npx prisma migrate resolve --applied "$migration"
done

# cPanel process limits can make Prisma's update-check child process fail with EAGAIN.
export CHECKPOINT_DISABLE=1
npx prisma migrate deploy
npx prisma generate
npm run build
mkdir -p tmp
touch tmp/restart.txt
```

If `npx prisma` still reports `spawn ... EAGAIN`, inspect the account process limit and
wait for or stop only stale processes belonging to this cPanel account before retrying:

```bash
ps -u "$USER" -o pid,stat,cmd | grep -E 'node|prisma' | grep -v grep
ulimit -u
```

Do not restart the application until `npm run build` completes successfully. A failed
build leaves the previous `dist` entrypoint running, which makes new routes appear to
be missing.

The cPanel startup command must run the compiled entrypoint from the project root:

```text
node dist/server/src/main.js
```

After a release, verify both the API and the frontend before testing a feature:

```bash
curl -i https://your-domain.example/health
curl -i https://your-domain.example/api/v1/audit-logs
```

The second request should return `401` without a token, which confirms that the live server has the activity-log route. A `404` means the old `dist` build is still running. A `500` usually means the database migration or generated Prisma client was not deployed.
