import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import logoUrl from "../../iwapilogo.png";

const LINKS = [
  { to: "/dashboard", label: "Dashboard", icon: "▦" },
  { to: "/inbox", label: "Inbox", icon: "✉" },
  { to: "/templates", label: "Templates", icon: "⊞" },
  { to: "/campaigns", label: "Campaigns", icon: "◉" },
  { to: "/contacts", label: "Contacts", icon: "☺" },
  { to: "/settings", label: "Settings", icon: "⚙" },
];

export function Sidebar() {
  const { user, tenant, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <nav className="app-sidebar">
      <div className="brand">
        <img src={logoUrl} alt="ImmerzoWAPI logo" className="brand-logo" />
        <div className="brand-text">
          <span className="brand-name">ImmerzoWAPI</span>
          <span className="brand-tagline">Powering your business with WhatsApp API</span>
        </div>
      </div>

      <ul className="side-nav">
        {LINKS.map((l) => (
          <li key={l.to}>
            <NavLink
              to={l.to}
              className={({ isActive }) => `side-link${isActive ? " active" : ""}`}
            >
              <span className="side-icon">{l.icon}</span>
              <span>{l.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="side-footer">
        <div className="side-workspace">
          <strong>{tenant?.name ?? "Workspace"}</strong>
          <span className="muted small">{user?.email}</span>
        </div>
        <button className="side-signout" onClick={handleLogout}>
          Sign out
        </button>
      </div>
    </nav>
  );
}
