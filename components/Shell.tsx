"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useData } from "./DataProvider";
import { Badge, Button, cx } from "./ui";

// Role/title-gated sidebar + topbar shell.

type NavItem = {
  href: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
};

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "▦" },
  { href: "/time", label: "Time Tracker", icon: "◷" },
  { href: "/contracts", label: "Contracts", icon: "✎" },
  { href: "/payroll", label: "Payroll & Expenses", icon: "$" },
  { href: "/team", label: "Team", icon: "◎", adminOnly: true },
  { href: "/account", label: "My Account", icon: "☺" },
];

export function Shell({ children }: { children: ReactNode }) {
  const { session, notifications } = useData();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const isAdmin = session.user.role === "admin";
  const items = NAV.filter((n) => !n.adminOnly || isAdmin);
  const unread = notifications.filter((n) => !n.read).length;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function stopImpersonating() {
    await fetch("/api/users/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: null }),
    });
    router.refresh();
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside
        className={cx(
          "fixed lg:static inset-y-0 left-0 z-40 w-60 bg-white border-r border-slate-200 flex flex-col transition-transform",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="h-14 flex items-center gap-2 px-5 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-brand-600 text-white grid place-items-center font-bold">
            O
          </div>
          <span className="font-bold text-slate-900">Ops Hub</span>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto scroll-thin">
          {items.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cx(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <span className="w-5 text-center text-slate-400">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-slate-100">
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={logout}>
            ⎋ Sign out
          </Button>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-20">
          <button
            className="lg:hidden text-slate-500 text-xl"
            onClick={() => setOpen(true)}
          >
            ☰
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <NotificationBell />
            <div className="flex items-center gap-2">
              <Avatar name={session.user.name} />
              <div className="hidden sm:block text-sm leading-tight">
                <div className="font-medium text-slate-800">{session.user.name}</div>
                <div className="text-xs text-slate-400 capitalize">
                  {session.user.role}
                  {session.user.title ? ` · ${session.user.title}` : ""}
                </div>
              </div>
            </div>
          </div>
        </header>

        {session.impersonating && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 lg:px-6 py-2 flex items-center justify-between gap-3 text-sm">
            <span className="text-amber-800">
              Viewing as <strong>{session.user.name}</strong> (impersonating)
            </span>
            <Button size="sm" variant="secondary" onClick={stopImpersonating}>
              Stop
            </Button>
          </div>
        )}

        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}

export function Avatar({ name, color }: { name: string; color?: string | null }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className="w-8 h-8 rounded-full grid place-items-center text-white text-xs font-semibold shrink-0"
      style={{ background: color || "#2563eb" }}
    >
      {initials}
    </div>
  );
}

function NotificationBell() {
  const { notifications, update } = useData();
  const [open, setOpen] = useState(false);
  const unread = notifications.filter((n) => !n.read).length;

  async function markRead(id: string) {
    update("notifications", id, { read: true });
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-9 h-9 grid place-items-center rounded-lg hover:bg-slate-100 text-slate-500"
      >
        <span className="text-lg">◔</span>
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] grid place-items-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg z-40 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <span className="font-semibold text-sm">Notifications</span>
              {unread > 0 && <Badge tone="rose">{unread} new</Badge>}
            </div>
            <div className="max-h-96 overflow-y-auto scroll-thin">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-400">
                  No notifications
                </div>
              ) : (
                notifications.slice(0, 20).map((n) => (
                  <button
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className={cx(
                      "w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50",
                      !n.read && "bg-brand-50/40"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read && (
                        <span className="mt-1.5 w-2 h-2 rounded-full bg-brand-500 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-800">
                          {n.title}
                        </div>
                        {n.body && (
                          <div className="text-xs text-slate-500 mt-0.5">{n.body}</div>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
