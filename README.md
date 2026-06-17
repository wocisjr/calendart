# Calendar Thingy

Minimal web calendar with:

- login by username and password
- MySQL database
- admin view over other users' calendars
- PWA install support
- Docker-based local dev
- native Zerops deployment without Docker

## Quick start

### Option 1: Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

Open:

- App: `http://localhost:3000`

### Option 2: Local npm

You need MySQL running locally first.

```bash
cp .env.example .env
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Then open `http://localhost:3000`.

## Login flow

- Open `/login`
- Enter your username and password
- If you're creating a new account, switch to the register mode and optionally add an email as a contact field
- If you already had an old account, use register once with the same email to set your username and password

## Production-ish run

```bash
npm run build
npm run start
```

## Zerops deployment

This repo includes native Zerops configuration:

- `import.yaml` creates a `nodejs@22` app service and a managed `mariadb:single@10.6` database.
- `zerops.yaml` builds the Next.js app with npm, generates the Prisma client, deploys the build output, and starts Next.js directly with Node.js.
- The app no longer needs Docker on Zerops. Docker Compose can still be used for local development.

Import the topology first:

```bash
zerops project import --file import.yaml
```

Then deploy the app code to the `app` service using the `app` setup from `zerops.yaml`.

Runtime behavior on Zerops:

- `DATABASE_URL` is generated from the managed `db` service.
- `NEXTAUTH_URL` is set to the Zerops subdomain exposed for the app.
- `NEXTAUTH_SECRET` is generated once during import as a project-level variable.
- `ADMIN_EMAILS` is created as an empty project-level variable; set it in Zerops when needed.
- `prisma db push --accept-data-loss` runs once per deploy before the app starts, matching the existing Docker startup behavior.

## Environment

Important variables in `.env`:

- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `ADMIN_EMAILS`

## Notes

- `ADMIN_EMAILS` promotes matching accounts to admin role.
- Every new registered account is added to the single shared workspace automatically.
- Admins can remove members from the workspace directly in the UI.
- Admins and owners can assign events to other members so the calendar shows who the event is written for.
- Sessions stay valid for 30 days by default.
- Login is intentionally handled inside the app UI, but the auth backend stays in NextAuth.
- On container startup, the app runs `prisma db push` so the database tables are created automatically.
- If Prisma warns about schema changes, the container startup uses `--accept-data-loss` so local dev can keep moving.
- `NEXTAUTH_URL` must match the exact browser URL you use to open the app. If you access it via an IP address or a domain, use that instead of `localhost`.

## Troubleshooting

- If MySQL refuses to start after a version change, remove the old container volume and start fresh:

```bash
docker compose down -v
docker compose up --build
```
