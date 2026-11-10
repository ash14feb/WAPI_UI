import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import logoUrl from "../../public/unifylead-logo.png";
import {
  LayoutDashboard,
  MessageSquare,
  FileText,
  SendHorizontal,
  Users,
  Bot,
  Sparkles,
  Settings,
  LogOut,
  ShieldCheck,
  X,
  Plug,
  ClipboardList,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

const SECTIONS = [
  {
    caption: "Workspace",
    links: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/inbox", label: "Live Inbox", icon: MessageSquare },
    ],
  },
  {
    caption: "Engage",
    links: [
      { to: "/templates", label: "Templates", icon: FileText },
      { to: "/campaigns", label: "Campaigns", icon: SendHorizontal },
      { to: "/contacts", label: "Contacts", icon: Users },
      { to: "/bots", label: "Chatbot", icon: Bot },
      { to: "/ai", label: "AI Agent", icon: Sparkles },
      { to: "/flows", label: "Flows", icon: ClipboardList },
    ],
  },
  {
    caption: "System",
    links: [
      { to: "/integrations", label: "Integrations", icon: Plug },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ mobileOpen = false, onClose, collapsed = false, onToggleCollapse }: SidebarProps) {
  const { user, tenant, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    onClose?.();
    logout();
    navigate("/login", { replace: true });
  }

  const initial = user?.name ? user.name.charAt(0).toUpperCase() : "U";

  return (
    <nav className={`app-sidebar${mobileOpen ? " mobile-open" : ""}${collapsed ? " is-collapsed" : ""}`} aria-label="Main Navigation">
      <div className="brand">
        <div className="brand-logo-container">
          <img
            src={logoUrl}
            alt="UnifyLead"
            className="brand-logo"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
          <div className="brand-badge" title="Meta Cloud API Connected" />
        </div>
        <div className="brand-text">
          <span className="brand-name">
            UnifyLead
            <ShieldCheck size={16} color="#00a884" />
          </span>
          <span className="brand-tagline">Enterprise WhatsApp SaaS</span>
        </div>

        {onClose && (
          <button
            type="button"
            className="mobile-sidebar-close"
            onClick={onClose}
            aria-label="Close menu"
            title="Close menu"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <ul className="side-nav">
        {SECTIONS.map((section) => (
          <li key={section.caption} className="side-section">
            <span className="side-caption" aria-hidden="true">{section.caption}</span>
            <ul className="side-section-links">
              {section.links.map((l) => {
                const Icon = l.icon;
                return (
                  <li key={l.to}>
                    <NavLink
                      to={l.to}
                      title={collapsed ? l.label : undefined}
                      className={({ isActive }) => `side-link${isActive ? " active" : ""}`}
                      onClick={() => onClose?.()}
                    >
                      <span className="side-icon">
                        <Icon size={18} />
                      </span>
                      <span className="side-label">{l.label}</span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>

      <div className="side-footer">
        <div className="side-workspace" title={collapsed ? `${tenant?.name ?? "Enterprise Workspace"} · ${user?.email ?? ""}` : undefined}>
          <div className="side-avatar">{initial}</div>
          <div className="side-workspace-info">
            <span className="side-workspace-name">{tenant?.name ?? "Enterprise Workspace"}</span>
            <span className="muted tiny ellipsis">{user?.email ?? "active-user"}</span>
          </div>
        </div>

        <button className="side-signout" onClick={handleLogout} title={collapsed ? "Sign Out" : "Sign Out"}>
          <LogOut size={15} />
          <span className="side-label">Sign out</span>
        </button>

        {onToggleCollapse && (
          <button
            type="button"
            className="side-collapse-btn"
            onClick={onToggleCollapse}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
          >
            {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
            <span className="side-label">Collapse</span>
          </button>
        )}
      </div>
    </nav>
  );
}
