import { useEffect } from "react";

const DOCS: Record<string, { path: string; title: string }> = {
  privacy: { path: "/privacy-policy.html", title: "Privacy Policy" },
  terms: { path: "/terms-of-service.html", title: "Terms of Service" },
  deletion: { path: "/data-deletion.html", title: "Data Deletion Instructions" },
};

/**
 * Navigates a routed legal URL to its static document so the policy renders with
 * its own <title>, meta tags and styling instead of inside the app shell.
 */
export function LegalRedirect({ doc }: { doc: keyof typeof DOCS }) {
  const target = DOCS[doc];

  useEffect(() => {
    window.location.replace(target.path);
  }, [target.path]);

  return (
    <div className="center muted" style={{ minHeight: "100vh", flexDirection: "column", gap: "0.5rem" }}>
      <span>Opening {target.title}…</span>
      <a href={target.path} style={{ color: "var(--brand-teal)", fontWeight: 600 }}>
        {target.path}
      </a>
    </div>
  );
}
