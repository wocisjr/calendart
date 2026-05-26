"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";

type AuthMode = "login" | "register";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<AuthMode>("login");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const headline = mode === "login" ? "Přihlas se do kalendáře." : "Vytvoř si účet do kalendáře.";
  const hint =
    mode === "login"
      ? "Použij svoje uživatelské jméno a heslo."
      : "Při prvním použití si tady založíš účet. E-mail je volitelný, ale hodí se jako kontakt a pro přechod ze starého účtu.";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const result = await signIn("credentials", {
        redirect: false,
        username,
        email,
        password,
        mode,
        callbackUrl: "/dashboard"
      });

      if (result?.error) {
        setError(
          mode === "login"
            ? "Přihlášení selhalo. Zkontroluj jméno a heslo."
            : "Registrace selhala. Zkus jiné jméno nebo jiný e-mail."
        );
        return;
      }

      window.location.href = result?.url ?? "/dashboard";
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="shell login-wrap">
      <section className="login-card">
        <span className="kicker">Přihlášení</span>
        <h1>{headline}</h1>
        <p className="hint">{hint}</p>

        <div className="mode-switch" role="tablist" aria-label="Režim přihlášení">
          <button
            className={`button-ghost ${mode === "login" ? "button-ghost--active" : ""}`}
            type="button"
            onClick={() => setMode("login")}
          >
            Přihlásit se
          </button>
          <button
            className={`button-ghost ${mode === "register" ? "button-ghost--active" : ""}`}
            type="button"
            onClick={() => setMode("register")}
          >
            Vytvořit účet
          </button>
        </div>

        <form className="form-grid" onSubmit={handleSubmit}>
          <div>
            <label className="label" htmlFor="username">
              Jméno
            </label>
            <input
              id="username"
              name="username"
              className="field"
              type="text"
              autoComplete="username"
              placeholder="ondrej"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </div>

          {mode === "register" ? (
            <div>
              <label className="label" htmlFor="email">
                E-mail
              </label>
              <input
                id="email"
                name="email"
                className="field"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="jmeno@firma.cz"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
          ) : null}

          <div>
            <label className="label" htmlFor="password">
              Heslo
            </label>
            <input
              id="password"
              name="password"
              className="field"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
          </div>

          <input type="hidden" name="mode" value={mode} />

          <button className="button-accent" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Pracuji..." : mode === "login" ? "Přihlásit se" : "Vytvořit účet"}
          </button>

          {error ? <p className="hint" style={{ color: "var(--danger)" }}>{error}</p> : null}
        </form>

        <div style={{ marginTop: 18 }}>
          <Link className="button-ghost" href="/">
            Domů
          </Link>
        </div>
      </section>
    </main>
  );
}
