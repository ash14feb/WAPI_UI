import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api/client";
import logoUrl from "../../iwapilogo.png";
import { Mail, Lock, LogIn } from "lucide-react";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="auth-brand">
          <img src={logoUrl} alt="UnifyLead logo" className="auth-logo" />
          <strong style={{ fontSize: "1.25rem", color: "#0f172a" }}>UnifyLead</strong>
          <span className="muted small" style={{ fontWeight: 500 }}>
            Enterprise WhatsApp Cloud API Platform
          </span>
        </div>

        <div style={{ textAlign: "center", margin: "1rem 0 1.25rem" }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.25rem", color: "#0f172a" }}>Welcome back</h1>
          <p className="muted small" style={{ margin: 0 }}>
            Sign in to access your shared team inbox and campaigns.
          </p>
        </div>

        {error && <div className="error">{error}</div>}

        <label>
          <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <Mail size={13} color="#64748b" />
            <span>Work Email</span>
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="name@company.com"
          />
        </label>

        <label>
          <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <Lock size={13} color="#64748b" />
            <span>Password</span>
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="••••••••"
          />
        </label>

        <button
          type="submit"
          className="primary-btn"
          disabled={busy}
          style={{ width: "100%", justifyContent: "center", marginTop: "0.75rem", padding: "0.75rem" }}
        >
          {busy ? (
            <span>Signing in…</span>
          ) : (
            <>
              <LogIn size={16} />
              <span>Sign in to Console</span>
            </>
          )}
        </button>

        <p
          className="muted"
          style={{ margin: "0.85rem 0 0", textAlign: "center", fontSize: "0.75rem", lineHeight: 1.6 }}
        >
          <a
            href="/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#00a884", fontWeight: 600 }}
          >
            Privacy Policy
          </a>{" "}
          ·{" "}
          <a
            href="/terms-of-service"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#00a884", fontWeight: 600 }}
          >
            Terms of Service
          </a>
        </p>

        <div
          style={{
            marginTop: "1.25rem",
            paddingTop: "1rem",
            borderTop: "1px solid var(--border)",
            textAlign: "center",
            fontSize: "0.8125rem",
          }}
        >
          <span className="muted">New to UnifyLead? </span>
          <Link to="/register" style={{ color: "#00a884", fontWeight: 600, textDecoration: "none" }}>
            Create an account
          </Link>
        </div>
      </form>
    </div>
  );
}
