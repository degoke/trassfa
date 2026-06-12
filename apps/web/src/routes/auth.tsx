import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { authClient } from "../lib/auth-client";

type Mode = "sign-in" | "sign-up";

export function AuthPage() {
  const navigate = useNavigate();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [mode, setMode] = useState<Mode>("sign-up");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: ""
  });

  useEffect(() => {
    if (!sessionPending && session?.user) {
      void navigate({ to: "/app" });
    }
  }, [navigate, session?.user, sessionPending]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "sign-up") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (authClient.signUp.email as any)({
          name: form.name,
          email: form.email,
          password: form.password,
          phone: form.phone ? `234${form.phone.replace(/^\+?(234)?0?/, "")}` : undefined
        });

        if (result.error) {
          throw new Error(result.error.message ?? "Unable to create account");
        }
      } else {
        const result = await authClient.signIn.email({
          email: form.email,
          password: form.password
        });

        if (result.error) {
          throw new Error(result.error.message ?? "Unable to sign in");
        }
      }

      await navigate({ to: "/app" });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mobile-screen">
      <section className="hero-balance-card auth-hero-card">
        <span className="section-label">Account access</span>
        <strong>
          {mode === "sign-up"
            ? "Create your account and enter the app."
            : "Sign in and continue your flow."}
        </strong>
        <span className="hero-balance-meta">
          Crypto to bank. Bank to crypto. One mobile flow.
        </span>
      </section>

      <section className="mobile-card form-stack">
        <div className="segmented-control">
          <button
            className={mode === "sign-up" ? "segment active" : "segment"}
            type="button"
            onClick={() => setMode("sign-up")}
          >
            Create account
          </button>
          <button
            className={mode === "sign-in" ? "segment active" : "segment"}
            type="button"
            onClick={() => setMode("sign-in")}
          >
            Sign in
          </button>
        </div>

        <form className="form-stack" onSubmit={handleSubmit}>
          {mode === "sign-up" ? (
            <>
              <label className="field-block">
                <span>Full name</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  required
                />
              </label>
              <label className="field-block">
                <span>Phone number</span>
                <div className="input-prefix">
                  <span className="input-prefix-text">+234</span>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                    placeholder="8012345678"
                    required
                  />
                </div>
              </label>
            </>
          ) : null}
          <label className="field-block">
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              required
            />
          </label>
          <label className="field-block">
            <span>Password</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              minLength={8}
              required
            />
          </label>
          {error ? <p className="error-text">{error}</p> : null}
          <button className="button button-primary button-block" type="submit" disabled={loading}>
            {loading ? "Working..." : mode === "sign-up" ? "Create account" : "Sign in"}
          </button>
        </form>
      </section>
    </div>
  );
}
