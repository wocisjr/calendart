"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <main className="shell login-wrap">
      <section className="login-card">
        <span className="kicker">Magic link sign in</span>
        <h1>Pošli si link do emailu.</h1>
        <p className="hint">
          Není tu heslo. Zadáš email, klikneš na odkaz v poště a aplikace tě udrží přihlášeného.
        </p>

        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              const result = await signIn("email", {
                email,
                callbackUrl: "/dashboard",
                redirect: false
              });

              if (result?.error) {
                setMessage("Odeslání se nepovedlo. Zkontroluj email a SMTP.");
                return;
              }

              setMessage("Odkaz jsme poslali do emailu. Klikni na něj pro přihlášení.");
            });
          }}
        >
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

          <button className="button-accent" type="submit" disabled={isPending}>
            {isPending ? "Sending..." : "Send magic link"}
          </button>

          {message ? <p className="hint">{message}</p> : null}
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
