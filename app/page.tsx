import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LogoutButton } from "@/app/logout-button";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const signedIn = Boolean(session?.user?.id);

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <span>◫</span>
          </div>
          <div>
            <div>Calendar Thingy</div>
            <div className="muted" style={{ fontSize: "0.88rem" }}>
              web, mobile, instalace na plochu
            </div>
          </div>
        </div>
        <div className="nav-actions">
          {signedIn ? <LogoutButton /> : <Link className="button-ghost" href="/login">Sign in</Link>}
          <Link className="button-accent" href={signedIn ? "/dashboard" : "/login"}>
            {signedIn ? "Go to dashboard" : "Start now"}
          </Link>
        </div>
      </header>

      <section className="hero">
        <div>
          <span className="kicker">Minimal web app · MySQL · magic link · PWA</span>
          <h1>
            Low-budget kalendář, který se chová jako appka.
          </h1>
          <p className="hero-copy">
            Jedna webová aplikace pro desktop i mobil, login přes emailový magic link,
            pamatuje si přihlášení, jde připnout na plochu a admin uvidí kalendáře ostatních.
          </p>
          <div className="nav-actions" style={{ marginTop: 24 }}>
            <Link className="button-accent" href={signedIn ? "/dashboard" : "/login"}>
              {signedIn ? "Open dashboard" : "Request magic link"}
            </Link>
            <a className="button" href="#how-it-works">
              How it works
            </a>
          </div>
        </div>

        <div className="hero-panel">
          <div className="stat">
            <strong>30 dní</strong>
            <span className="muted">session cookie výdrž pro “remember me”.</span>
          </div>
          <div className="stat">
            <strong>1 repozitář</strong>
            <span className="muted">frontend, auth, DB i admin v jednom monolitu.</span>
          </div>
          <div className="stat">
            <strong>PWA ready</strong>
            <span className="muted">manifest, ikonka a standalone režim.</span>
          </div>
        </div>
      </section>

      <section className="page-grid" id="how-it-works">
        <article className="section">
          <h2>Co to umí</h2>
          <div className="list">
            <div className="list-item">
              <strong>Magic link login</strong>
              <p className="copy">Uživatel zadá email, přijde mu link, klikne a je přihlášen.</p>
            </div>
            <div className="list-item">
              <strong>Admin / boss režim</strong>
              <p className="copy">Role `ADMIN` dostane přehled nad cizími kalendáři a týmem.</p>
            </div>
            <div className="list-item">
              <strong>PWA instalace</strong>
              <p className="copy">Web si přidáš na plochu i mobile. Chová se jako jednoduchá appka.</p>
            </div>
          </div>
        </article>

        <article className="section">
          <h2>Technický základ</h2>
          <div className="list">
            <div className="list-item">
              <strong>Next.js App Router</strong>
              <p className="copy">Server components, route handlers, metadata a manifest v jednom frameworku.</p>
            </div>
            <div className="list-item">
              <strong>Prisma + MySQL</strong>
              <p className="copy">Typovaný ORM, migrace a jasný datový model pro uživatele, kalendáře a eventy.</p>
            </div>
            <div className="list-item">
              <strong>Docker Compose</strong>
              <p className="copy">Lokálně poběží app, MySQL i mail sink v containeru.</p>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
