import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api/client";
import logoUrl from "../../iwapilogo.png";
import { Mail, Lock, User, Building, UserPlus } from "lucide-react";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await register(name.trim(), email.trim(), password, tenantName.trim());
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="auth-brand">
          <img src={logoUrl} alt="ImmerzoWAPI logo" className="auth-logo" />
          <strong style={{ fontSize: "1.25rem", color: "#0f172a" }}>ImmerzoWAPI</strong>
          <span className="muted small" style={{ fontWeight: 500 }}>
            Enterprise WhatsApp Cloud API Platform
          </span>
        </div>

        <div style={{ textAlign: "center", margin: "1rem 0 1.25rem" }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.25rem", color: "#0f172a" }}>Create account</h1>
          <p className="muted small" style={{ margin: 0 }}>
            Set up your organization workspace and team inbox.
          </p>
        </div>

        {error && <div className="error">{error}</div>}

        <label>
          <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <User size={13} color="#64748b" />
            <span>Full Name</span>
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
            placeholder="Sarah Connor"
          />
        </label>

        <label>
          <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <Building size={13} color="#64748b" />
            <span>Company / Workspace Name</span>
          </span>
          <input
            value={tenantName}
            onChange={(e) => setTenantName(e.target.value)}
            required
            placeholder="Acme Global Inc."
          />
        </label>

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
            placeholder="sarah@acme.com"
          />
        </label>

        <label>
          <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <Lock size={13} color="#64748b" />
            <span>Password (min 8 characters)</span>
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
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
            <span>Setting up workspace…</span>
          ) : (
            <>
              <UserPlus size={16} />
              <span>Create Workspace</span>
            </>
          )}
        </button>

        <div
          style={{
            marginTop: "1.25rem",
            paddingTop: "1rem",
            borderTop: "1px solid var(--border)",
            textAlign: "center",
            fontSize: "0.8125rem",
          }}
        >
          <span className="muted">Already registered? </span>
          <Link to="/login" style={{ color: "#00a884", fontWeight: 600, textDecoration: "none" }}>
            Sign in
          </Link>
        </div>
      </form>
    </div>
  );
}
