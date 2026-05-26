"use client";

import { useEffect, useState } from "react";
import { getCsrfToken } from "next-auth/react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    getCsrfToken()
      .then((token) => {
        if (alive) {
          setCsrfToken(token ?? null);
        }
      })
      .catch(() => {
        if (alive) {
          setCsrfToken(null);
        }
      });

    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="shell login-wrap">
      <section className="login-card">
        <span className="kicker">Magic link sign in</span>
        <h1>Pošli si link do emailu.</h1>
        <p className="hint">
          Není tu heslo. Zadáš email, klikneš na odkaz v poště a aplikace tě udrží přihlášeného.
        </p>

        <form className="form-grid" method="post" action="/api/auth/signin/email"
        >
          <input type="hidden" name="csrfToken" value={csrfToken ?? ""} />
          <input type="hidden" name="callbackUrl" value="/dashboard" />
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              className="field"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="name@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <button className="button-accent" type="submit" disabled={!csrfToken}>
            {csrfToken ? "Send magic link" : "Preparing..."}
          </button>
          {!csrfToken ? (
            <p className="hint">Loading login form…</p>
          ) : (
            <p className="hint">After submit, check your email for the sign-in link.</p>
          )}
        </form>

        <div style={{ marginTop: 18 }}>
          <Link className="button-ghost" href="/">
            Back home
          </Link>
        </div>
      </section>
    </main>
  );
}
