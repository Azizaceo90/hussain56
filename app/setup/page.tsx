"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@/components/ui";

// First-run setup: create the initial admin account with a real form (no
// browser console needed). Only usable while the database has zero users.
export default function SetupPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/api/seed", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setInitialized(!!d.initialized))
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/seed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Setup failed");
      if (res.status === 409) setInitialized(true);
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/login"), 1500);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-100 to-brand-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-600 text-white text-xl font-bold mb-3">
            O
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Ops Hub setup</h1>
          <p className="text-slate-500 text-sm">Create your admin account</p>
        </div>

        <Card>
          {checking ? (
            <p className="text-sm text-slate-500 text-center py-4">Checking…</p>
          ) : initialized ? (
            <div className="text-center py-4 space-y-3">
              <p className="text-sm text-slate-600">
                An admin account already exists. Setup is closed.
              </p>
              <Button onClick={() => router.push("/login")} className="w-full">
                Go to sign in
              </Button>
            </div>
          ) : done ? (
            <div className="text-center py-4 space-y-2">
              <p className="text-emerald-700 font-medium">✓ Admin created!</p>
              <p className="text-sm text-slate-500">Taking you to sign in…</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <Input
                label="Your name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <Input
                label="Email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
              <Input
                label="Password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
              <p className="text-xs text-slate-400">
                Use at least 6 characters. You'll sign in with this email and password.
              </p>
              {error && <p className="text-sm text-rose-600">{error}</p>}
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? "Creating…" : "Create admin account"}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
