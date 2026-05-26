# Calendar Thingy

Minimal web calendar with:

- magic link login by email
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
- Mailpit inbox: `http://localhost:8025`

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
- Enter your email
- The form posts directly to NextAuth's email signin endpoint
- After submit, you land on `/login/verify-request`
- Open the email and click the magic link to finish sign-in

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
- `EMAIL_SERVER`
- `EMAIL_FROM`
- `ADMIN_EMAILS`

## Notes

- Magic link login uses the SMTP server from `EMAIL_SERVER`.
- For local development, keep `EMAIL_SERVER` pointed at Mailpit.
- For production, point `EMAIL_SERVER` at Resend SMTP and set `EMAIL_FROM` to a verified sender on your domain.
- `ADMIN_EMAILS` promotes matching accounts to admin role.
- Sessions stay valid for 30 days by default.
- Login is intentionally handled inside the app UI, but the auth backend stays in NextAuth.
- On container startup, the app runs `prisma db push` so the database tables are created automatically.
- `NEXTAUTH_URL` must match the exact browser URL you use to open the app. If you access it via an IP address or a domain, use that instead of `localhost`.

### Resend SMTP

Resend works here through plain SMTP, so you do not need to change the app code.

Example production values:

```env
EMAIL_SERVER="smtps://resend:re_XXXXXXXXXXXXXXXXXXXXXXXX@smtp.resend.com:465"
EMAIL_FROM="Calendar Thingy <no-reply@yourdomain.tld>"
```

## Troubleshooting

- If MySQL refuses to start after a version change, remove the old container volume and start fresh:

```bash
docker compose down -v
docker compose up --build
```
