# Calendar Thingy

Minimal web calendar with:

- login by username and password
- MySQL database
- admin view over other users' calendars
- PWA install support
- Docker-based local dev

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
- If you're creating a new account, switch to the register mode and optionally add an email for invite matching
- If you already had an old account, use register once with the same email to set your username and password
- If an admin already shared the calendar with your email, the access is applied after you register or sign in

## Production-ish run

```bash
npm run build
npm run start
```

## Environment

Important variables in `.env`:

- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `ADMIN_EMAILS`

## Notes

- `ADMIN_EMAILS` promotes matching accounts to admin role.
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
