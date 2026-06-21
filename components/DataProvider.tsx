"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type {
  Bootstrap,
  Contract,
  Expense,
  Notification,
  PayrollEntry,
  TimeEntry,
  User,
} from "@/lib/types";

// React context store holding all role-scoped data with add/update/remove
// helpers and refreshData() that reloads /api/bootstrap.

type Collections = {
  users: User[];
  timeEntries: TimeEntry[];
  contracts: Contract[];
  expenses: Expense[];
  payroll: PayrollEntry[];
  notifications: Notification[];
};

type Store = Collections & {
  session: Bootstrap["session"];
  loading: boolean;
  refreshData: () => Promise<void>;
  add: <K extends keyof Collections>(key: K, item: Collections[K][number]) => void;
  update: <K extends keyof Collections>(
    key: K,
    id: string,
    patch: Partial<Collections[K][number]>
  ) => void;
  remove: <K extends keyof Collections>(key: K, id: string) => void;
};

const DataContext = createContext<Store | null>(null);

export function DataProvider({
  initial,
  children,
}: {
  initial: Bootstrap;
  children: ReactNode;
}) {
  const [session, setSession] = useState(initial.session);
  const [collections, setCollections] = useState<Collections>({
    users: initial.users,
    timeEntries: initial.timeEntries,
    contracts: initial.contracts,
    expenses: initial.expenses,
    payroll: initial.payroll,
    notifications: initial.notifications,
  });
  const [loading, setLoading] = useState(false);

  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/bootstrap", { cache: "no-store" });
      if (!res.ok) return;
      const data: Bootstrap = await res.json();
      setSession(data.session);
      setCollections({
        users: data.users,
        timeEntries: data.timeEntries,
        contracts: data.contracts,
        expenses: data.expenses,
        payroll: data.payroll,
        notifications: data.notifications,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const add: Store["add"] = useCallback((key, item) => {
    setCollections((c) => ({ ...c, [key]: [item, ...(c[key] as any[])] }) as Collections);
  }, []);

  const update: Store["update"] = useCallback((key, id, patch) => {
    setCollections(
      (c) =>
        ({
          ...c,
          [key]: (c[key] as any[]).map((it) =>
            it.id === id ? { ...it, ...patch } : it
          ),
        }) as Collections
    );
  }, []);

  const remove: Store["remove"] = useCallback((key, id) => {
    setCollections(
      (c) =>
        ({ ...c, [key]: (c[key] as any[]).filter((it) => it.id !== id) }) as Collections
    );
  }, []);

  const value: Store = {
    ...collections,
    session,
    loading,
    refreshData,
    add,
    update,
    remove,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): Store {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}

// Helper hook: refresh bootstrap whenever a data-sensitive page mounts.
export function useRefreshOnMount() {
  const { refreshData } = useData();
  useEffect(() => {
    refreshData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
