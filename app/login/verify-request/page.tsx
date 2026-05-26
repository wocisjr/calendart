import Link from "next/link";

export default function VerifyRequestPage() {
  return (
    <main className="shell login-wrap">
      <section className="login-card">
        <span className="kicker">Check your email</span>
        <h1>Link jsme poslali do schránky.</h1>
        <p className="hint">
          Otevři email a klikni na magic link. Po ověření tě vrátíme zpátky do kalendáře.
        </p>

        <div style={{ marginTop: 18 }} className="nav-actions">
          <Link className="button-accent" href="/">
            Back home
          </Link>
          <Link className="button-ghost" href="/login">
            Send another link
          </Link>
        </div>
      </section>
    </main>
  );
}
