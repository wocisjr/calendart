# Calendar Thingy - Codex Context

Krátký kontext pro další práci v tomhle repu. Cíl je udržet appku minimalistickou, česky, bez marketingu a bez zbytečné infra.

## Co to je

- Interní pracovní kalendář pro jednu skupinu.
- Jeden sdílený kalendář pro všechny uživatele.
- Hlavní use-case je plánování směn / dostupnosti / práce v rámci týmu.
- UI má být co nejblíž Google Calendar, ale jednodušší.

## Aktuální stack

- Next.js 15 App Router
- React 19
- TypeScript
- MySQL
- Prisma
- NextAuth v credentials režimu
- Docker Compose pro lokální běh

## Přihlášení

- Login je přes `username + password`.
- Magic link login už se nepoužívá.
- Session strategie v NextAuth je `jwt`, protože CredentialsProvider to vyžaduje.
- `email` je jen volitelný kontakt při registraci nebo migraci starého účtu.
- `NEXTAUTH_URL` musí odpovídat přesné veřejné URL, přes kterou appku otevíráš.

## Chování účtů

- Každý nový uživatel se automaticky přidá do jedné společné workspace skupiny.
- Admin / owner může:
  - měnit role členů mezi `VIEWER` a `EDITOR`
  - odebrat člena ze skupiny
  - mazat eventy
  - při vytváření eventů je připsat na člena nebo lokálního "sub-usera" bez loginu
- Vlastníka kalendáře nelze odstranit ani přepsat na jinou roli.

## UI pravidla

- Vše má být v češtině.
- Žádné marketingové landing pages.
- `"/"` jen přesměruje:
  - nepřihlášený -> `/login`
  - přihlášený -> `/dashboard`
- Na dashboardu:
  - jeden kalendář
  - přepínání `Týden` / `Měsíc`
  - prázdné dny nemají hlášku typu `no events`
  - sidebar vlevo, kalendář vpravo

## Důležité soubory

- [README.md](./README.md)
- [lib/auth.ts](./lib/auth.ts)
- [prisma/schema.prisma](./prisma/schema.prisma)
- [app/login/page.tsx](./app/login/page.tsx)
- [app/dashboard/page.tsx](./app/dashboard/page.tsx)
- [app/dashboard/actions.ts](./app/dashboard/actions.ts)
- [docker-compose.yml](./docker-compose.yml)

## Databázový model

- `User`
  - `username`, `email`, `passwordHash`, `role`
- `Calendar`
  - jeden workspace kalendář
- `CalendarMember`
  - role: `OWNER`, `EDITOR`, `VIEWER`
- `Event`
  - skutečný creator, připsaný sub-user, čas, stav, visibility

## Deployment poznámky

- Lokálně funguje `docker compose up --build`.
- App container při startu dělá `prisma db push --accept-data-loss`.
- Pokud se rozbije MySQL volume po změně verze nebo schema:
  - `docker compose down -v`
  - znovu `docker compose up --build`
- Pokud je appka za nginxem:
  - nginx má proxyovat na hostovaný port, typicky `127.0.0.1:3000`
  - `NEXTAUTH_URL` musí být veřejná doména, například `https://calendar.wocisjr.online`

## Co nevracet zpátky

- Magic link login
- Mailpit jako produkční závislost
- Sharing/invite flow přes email
- Marketingovou homepage
- Více kalendářů pro běžné uživatele

## Tón projektu

- Minimalistické
- Praktické
- Čitelné
- Bez zbytečných vrstev navíc
