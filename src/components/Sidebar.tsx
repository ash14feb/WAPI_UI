import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import logoUrl from "../../iwapilogo.png";
import {
  LayoutDashboard,
  MessageSquare,
  FileText,
  SendHorizontal,
  Users,
  Settings,
  LogOut,
  ShieldCheck,
} from "lucide-react";

const LINKS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/inbox", label: "Live Inbox", icon: MessageSquare },
  { to: "/templates", label: "Templates", icon: FileText },
  { to: "/campaigns", label: "Campaigns", icon: SendHorizontal },
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const { user, tenant, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  const initial = user?.name ? user.name.charAt(0).toUpperCase() : "U";

  return (
    <nav className="app-sidebar">
      <div className="brand">
        <div className="brand-logo-container">
          <img
            src={logoUrl}
            alt="ImmerzoWAPI"
            className="brand-logo"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
          <div className="brand-badge" title="Meta Cloud API Connected" />
        </div>
        <div className="brand-text">
          <span className="brand-name">
            ImmerzoWAPI
            <ShieldCheck size={16} color="#00a884" />
          </span>
          <span className="brand-tagline">Enterprise WhatsApp SaaS</span>
        </div>
      </div>

      <ul className="side-nav">
        {LINKS.map((l) => {
          const Icon = l.icon;
          return (
            <li key={l.to}>
              <NavLink
                to={l.to}
                className={({ isActive }) => `side-link${isActive ? " active" : ""}`}
              >
                <span className="side-icon">
                  <Icon size={18} />
                </span>
                <span>{l.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>

      <div className="side-footer">
        <div className="side-workspace">
          <div className="side-avatar">{initial}</div>
          <div className="side-workspace-info">
            <span className="side-workspace-name">{tenant?.name ?? "Enterprise Workspace"}</span>
            <span className="muted tiny ellipsis">{user?.email ?? "active-user"}</span>
          </div>
        </div>

        <button className="side-signout" onClick={handleLogout} title="Sign Out">
          <LogOut size={15} />
          <span>Sign out</span>
        </button>
      </div>
    </nav>
  );
}
