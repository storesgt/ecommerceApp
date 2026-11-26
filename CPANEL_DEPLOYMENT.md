# Deploy Ground Commerce on cPanel

This guide walks through a fresh production deployment on Linux cPanel. It uses
cPanel's Node.js application manager (Passenger) and a cPanel MySQL database; it
does not use Docker.

## Before you start

Make sure your hosting plan provides:

- cPanel Terminal or SSH access.
- The cPanel Node.js application interface and Passenger.
- Node.js 22.x (the interface may be called **Setup Node.js App**, **Node.js
  Selector**, or **Application Manager**).
- A MySQL 8 database, or a MariaDB version supported by your host and Prisma.
- A domain or subdomain with SSL/HTTPS enabled.
- Enough disk space for Node dependencies, the database, and product uploads.

If you cannot find a Node.js application interface or Node.js 22, ask your
hosting provider to enable it before continuing. cPanel's [Application
Manager](https://docs.cpanel.net/cpanel/software/application-manager/) requires
the provider to install and enable Passenger and Node.js support.

Use a dedicated subdomain such as `shop.example.com` if possible. It avoids
conflicts with an existing WordPress or PHP website. Point its DNS to your
hosting account and enable its SSL certificate in cPanel (usually **SSL/TLS
Status** or **AutoSSL**).

> **Do not put the application directory inside `public_html`.** Keep it in your
> home directory, for example `~/apps/ecommerceApp`. cPanel/Passenger connects
> the chosen domain to the Node application.

## 1. Create the production database

1. In cPanel, open **MySQL Database Wizard** (sometimes under **Databases**).
2. Create a database and a database user.
3. Give that user **All Privileges** on the new database.
4. Record the full database name, full user name, password, and database host.
   cPanel commonly adds your account prefix, for example
   `accountname_store` and `accountname_storeuser`.
5. The host is often `localhost`, but use the value supplied by your hosting
   provider.

The database URL format is:

```text
mysql://FULL_DATABASE_USER:PASSWORD@DATABASE_HOST:3306/FULL_DATABASE_NAME
```

If the database password contains URL-reserved characters such as `@`, `:`,
`/`, `?`, `#`, or `%`, URL-encode the password before putting it in the URL.
Alternatively, set a strong hexadecimal password in cPanel (for example, one
generated with `openssl rand -hex 24`), which avoids URL-reserved characters.

## 2. Create the cPanel Node.js application

Use **Setup Node.js App** or **Node.js Selector** if your host provides it.
This interface lets you choose the startup file needed by this project.

If you only have **Application Manager**, stop here and ask your hosting
provider to enable the Node.js Selector, or to configure Passenger's startup
file as `dist/server/src/main.js`. Standard Application Manager setups start
`app.js` by default, but this repository's `app.js` is browser code, not the
Node server. Do not register it with the default startup file. See cPanel's
[Node.js installation guide](https://docs.cpanel.net/knowledge-base/web-services/how-to-install-a-node.js-application/)
for the Application Manager requirements.

Use these settings:

| Setting | Value |
| --- | --- |
| Node.js version | `22.x` |
| Application mode | `Production` |
| Application root | `apps/ecommerceApp` (relative to your home directory) |
| Application URL | Your dedicated domain/subdomain, preferably its root `/` |
| Startup file | `dist/server/src/main.js` |

If the application files are not uploaded yet, you can enter the startup file
now and create it in the build step below. Do **not** choose the root `app.js`:
that file is the storefront's browser code. The Node server starts from the
compiled file `dist/server/src/main.js`.

Create the application and copy the exact Node environment activation command
shown by cPanel. The path includes your cPanel account name and may differ from
the example paths found online; do not copy another account's path.

## 3. Upload the project files

Use either **Git Version Control** in cPanel or upload a ZIP of the repository
with File Manager. Put the repository contents directly in
`~/apps/ecommerceApp`—do not leave them one directory lower.

The application root must include `package.json`, `package-lock.json`,
`prisma/`, `server/`, `index.html`, `admin.html`, `app.js`, `admin.js`,
`styles.css`, `admin.css`, and `runtime-config.js`. Do not upload
`node_modules`; it will be installed on the server.

Open cPanel Terminal and move to the application root:

```bash
cd ~/apps/ecommerceApp
```

If your application root has a different name, use that exact path.

## 4. Configure production settings

Create a file named `.env` in the application root. You can copy the template
and edit it using cPanel File Manager's **Code Editor**:

```bash
cd ~/apps/ecommerceApp
cp .env.example .env
```

Set the following values in `.env`:

```dotenv
NODE_ENV="production"
DATABASE_URL="mysql://FULL_DATABASE_USER:URL_ENCODED_PASSWORD@DATABASE_HOST:3306/FULL_DATABASE_NAME"
JWT_SECRET="PASTE_A_NEW_RANDOM_SECRET_HERE"
APP_URL="https://shop.example.com"
CORS_ORIGIN="https://shop.example.com"

ADMIN_EMAIL="you@example.com"
ADMIN_PASSWORD="USE_A_UNIQUE_PASSWORD_AT_LEAST_8_CHARACTERS_LONG"
ADMIN_FIRST_NAME="Store"
ADMIN_LAST_NAME="Administrator"

SMTP_HOST="mail.example.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="no-reply@example.com"
SMTP_PASSWORD="YOUR_SMTP_PASSWORD"
EMAIL_FROM="Store <no-reply@example.com>"

PAYSTACK_SECRET_KEY="YOUR_PAYSTACK_SECRET_KEY"
```

Replace every example value. Generate a strong JWT secret in Terminal with:

```bash
openssl rand -hex 48
```

Copy the output into `JWT_SECRET`. Keep all credentials private. Restrict the
environment file so only your cPanel account can read it:

```bash
chmod 600 ~/apps/ecommerceApp/.env
```

The server loads `.env` at startup, and Prisma/seed commands load it for
database access. The file is ignored by Git; never commit it or put it in
`public_html`.

`APP_URL` and `CORS_ORIGIN` must be the exact HTTPS origin used by customers,
with no trailing slash. If the storefront and API use the same domain, use the
same value for both.

Production account registration requires email verification. Configure working
SMTP settings before launch; otherwise customers may not receive the
verification email and will not be able to sign in. Use port `587` with
`SMTP_SECURE="false"` for STARTTLS, or port `465` with
`SMTP_SECURE="true"` if that is what your mail provider specifies.

If cPanel provides a `PORT` value for the application, leave it managed by
cPanel. Remove the template's `PORT=4000` line from `.env` unless your host
specifically tells you to set `PORT` yourself. Do not choose an arbitrary
port. The server reads cPanel's `PORT` value and uses `4000` only as its
local-development fallback.

## 5. Install, migrate, build, and seed

In Terminal, run the activation command you copied from cPanel. It usually
activates the Node.js virtual environment and changes to the application root.
Then run:

```bash
cd ~/apps/ecommerceApp
node --version
npm ci --include=dev
npx prisma generate
npx prisma migrate deploy
npx prisma migrate status
npm run build
mkdir -p uploads tmp
chmod 700 uploads
npm run db:seed
```

Before continuing, confirm `node --version` reports Node.js 22.x and
`npm run build` finishes without errors.

For a **new, empty database**, `npx prisma migrate deploy` applies the project's
baseline schema. Do not use `npm run db:migrate` for production: that script
runs `prisma db push`, which is intended for development rather than controlled
production migrations.

`npm run db:seed` creates the initial Super Admin using the `ADMIN_*` values and
also adds example catalog/shipping data. Run it once for a fresh database.
Choose an email address that is not already assigned to another account: if it
already exists, seeding promotes that account to Super Admin and marks it
active. Seeding again does not reset an existing account's password. Remove or
replace the example product in the admin dashboard before opening the store.

### If you are upgrading an existing database

Do not treat an existing database as a fresh install. Back it up first. This
repository has a baseline migration named
`20261124223000_baseline`.

If the database was previously created with `prisma db push`, and its schema
has already been verified to match that baseline, but Prisma has no migration
history, mark the baseline as applied **once**:

```bash
npx prisma migrate resolve --applied 20261124223000_baseline
npx prisma migrate deploy
```

Do not run the `migrate resolve` command against an empty database: it would
mark the schema as already created without creating its tables. If you are not
certain whether the live schema matches the baseline, stop and have the
database checked before running migrations.

## 6. Start the application

Return to the cPanel Node.js application page and confirm:

- The application root is the directory containing `package.json`.
- The application URL is the correct HTTPS domain/subdomain.
- The startup file is `dist/server/src/main.js`.
- The application is in **Production** mode and uses Node.js 22.x.
- The required environment variables are present.

Click **Restart** (or **Start**) in the Node.js application interface. If your
host uses Application Manager/Passenger without a restart button, run:

```bash
cd ~/apps/ecommerceApp
touch tmp/restart.txt
```

Do not leave `npm run dev` running in a Terminal window; cPanel/Passenger must
manage the production process.

The project root must remain the current working directory so the server can
find the storefront files and `uploads` directory.

## 7. Check the live site

Replace `shop.example.com` with your domain:

```bash
curl -i https://shop.example.com/health
curl -I https://shop.example.com/
curl -I https://shop.example.com/app.js
curl -i https://shop.example.com/api/v1/coupons/public
```

Expected results:

- `/health` returns HTTP `200` and JSON with `"status":"ok"`.
- `/` and `/app.js` return HTTP `200`.
- `/api/v1/coupons/public` returns HTTP `200` and JSON (an empty offer list is
  valid).

Then open the storefront in a browser, create or sign in to the seeded
administrator at `/admin.html`, and confirm the dashboard loads. Set the store
name, currency, shipping/tax settings, and Paystack configuration before
accepting real orders. Use Paystack test credentials to test a complete order
before switching to live credentials.

## 8. Updating the site

Before every update, back up the database and `uploads` directory. Then upload
the new repository files (or pull the intended Git revision). Activate the
Node.js environment using cPanel's command, then run:

```bash
cd ~/apps/ecommerceApp
npm ci --include=dev
npx prisma migrate deploy
npx prisma generate
npm run build
touch tmp/restart.txt
```

Check `/health` and the storefront again after the restart. Do not run
`prisma migrate resolve` during normal updates; it is only for carefully
baselining an existing schema as described above.

For backups, use **phpMyAdmin → Export** for the database and cPanel File
Manager to archive the `uploads` directory. Store the backups somewhere other
than the hosting account so they survive account or disk failure.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Node application option is missing | Ask the host to enable Node.js 22 and Passenger/Application Manager for your account. |
| `npm ci` fails | Confirm Node.js 22 is activated, `package-lock.json` was uploaded, and the host permits outbound package downloads. |
| Prisma reports `EAGAIN` or cannot spawn a process | This is usually a hosting process limit. Do not stop other users' processes; ask the host to raise the account limit or check for stale processes belonging to your account. |
| `Cannot find module .../dist/server/src/main.js` | Run `npm run build` successfully and confirm the startup file is `dist/server/src/main.js`. |
| Prisma `P1000` or access denied | Recheck the full cPanel-prefixed DB name/user/password and privileges in MySQL Database Wizard. |
| Prisma `P1001` or cannot reach database | Use the database host supplied by the provider; confirm the database service is available to Node apps. |
| Migration reports tables already exist | Stop. Do not drop tables. Follow the existing-database baseline instructions or have the schema reviewed. |
| HTTP `500` after restart | Check the cPanel application error log; verify `.env`, database migration status, and that Prisma Client was generated. |
| HTTP `503` or app keeps restarting | Check the cPanel Passenger/Node application log, application root, startup file, Node version, and hosting process limits. |
| Customers cannot verify email | Check SMTP host, port, secure mode, credentials, sender address, and `APP_URL`. |
| Images disappear after an update | Keep `uploads` in the application root and do not replace or delete it when uploading new source files. |

If the cPanel interface or Passenger behavior differs from these steps, consult
the host's instructions or cPanel's [Passenger application
guide](https://docs.cpanel.net/knowledge-base/web-services/using-passenger-applications/).
