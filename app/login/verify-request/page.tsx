import Link from "next/link";

export default function VerifyRequestPage() {
  return (
    <main className="shell login-wrap">
      <section className="login-card">
        <span className="kicker">Přihlášení</span>
        <h1>Tahle stránka už není potřeba.</h1>
        <p className="hint">
          Kalendář teď používá uživatelské jméno a heslo, takže stačí jít na přihlášení a zadat svoje údaje.
        </p>

        <div style={{ marginTop: 18 }} className="nav-actions">
          <Link className="button-accent" href="/login">
            Na přihlášení
          </Link>
        </div>
      </section>
    </main>
  );
}
