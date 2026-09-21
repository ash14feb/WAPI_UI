import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api/client";
import logoUrl from "../../iwapilogo.png";

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
          <strong>ImmerzoWAPI</strong>
          <span className="muted small">Powering your business with WhatsApp API</span>
        </div>
        <h1>Create account</h1>
        <p className="muted">Set up your business workspace.</p>
        {error && <div className="error">{error}</div>}
        <label>
          Your name
          <input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
        </label>
        <label>
          Workspace name
          <input value={tenantName} onChange={(e) => setTenantName(e.target.value)} required placeholder="Acme Inc." />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label>
          Password (min 8 chars)
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
        </label>
        <button type="submit" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
        <p className="muted">Have an account? <Link to="/login">Sign in</Link></p>
      </form>
    </div>
  );
}
