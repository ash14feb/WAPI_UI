import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api, asArray } from "../api/client";
import type { WhatsappAccount } from "../api/types";
import { useAuth } from "../auth/AuthContext";

interface AccountState {
  accounts: WhatsappAccount[];
  selectedId: string | null;
  selected: WhatsappAccount | null;
  loading: boolean;
  select: (id: string) => void;
  refresh: () => Promise<void>;
}

const AccountContext = createContext<AccountState | null>(null);

function storageKey(tenantId: string | null): string {
  return `wa.selectedAccount.${tenantId ?? "none"}`;
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const { tenant } = useAuth();
  const [accounts, setAccounts] = useState<WhatsappAccount[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!tenant) {
      setAccounts([]);
      setLoading(false);
      return;
    }
    try {
      const data = await api<WhatsappAccount[] | { items: WhatsappAccount[] }>("/api/v1/whatsapp/accounts");
      const list = asArray(data).filter((a) => a.status === "ACTIVE");
      setAccounts(list);
      setSelectedId((prev) => {
        if (prev && list.some((a) => a.id === prev)) return prev;
        const stored = localStorage.getItem(storageKey(tenant.id));
        if (stored && list.some((a) => a.id === stored)) return stored;
        return list[0]?.id ?? null;
      });
    } catch {
      // keep previous selection; header shows disconnected state
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  const select = useCallback(
    (id: string) => {
      setSelectedId(id);
      if (tenant) localStorage.setItem(storageKey(tenant.id), id);
    },
    [tenant],
  );

  const value = useMemo<AccountState>(() => {
    const selected = accounts.find((a) => a.id === selectedId) ?? accounts[0] ?? null;
    // Fall back to first ACTIVE if the stored selection vanished.
    const effectiveId = selected?.id ?? null;
    return { accounts, selectedId: effectiveId, selected, loading, select, refresh };
  }, [accounts, selectedId, loading, select, refresh]);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccounts(): AccountState {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useAccounts must be used within AccountProvider");
  return ctx;
}

export function accountLabel(a: WhatsappAccount): string {
  const name = a.businessName?.trim();
  const num = a.displayPhoneNumber?.trim();
  if (name && num) return `${name} · ${num}`;
  return name || num || a.phoneNumberId;
}
