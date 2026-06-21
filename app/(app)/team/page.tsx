"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useData, useRefreshOnMount } from "@/components/DataProvider";
import { Avatar } from "@/components/Shell";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
} from "@/components/ui";
import type { User } from "@/lib/types";

export default function TeamPage() {
  useRefreshOnMount();
  const router = useRouter();
  const { session, users, add, update, remove } = useData();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);

  if (session.user.role !== "admin") {
    return <EmptyState title="Admins only" description="You don't have access to this page." />;
  }

  async function impersonate(userId: string) {
    await fetch("/api/users/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    router.push("/");
    router.refresh();
  }

  async function del(u: User) {
    if (!confirm(`Delete ${u.name}? This removes all their data.`)) return;
    const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
    if (res.ok) remove("users", u.id);
  }

  return (
    <div>
      <PageHeader
        title="Team"
        subtitle="Manage employees and access"
        actions={<Button onClick={() => setInviteOpen(true)}>Invite employee</Button>}
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-400 border-b border-slate-100">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Email</th>
                <th className="py-2 pr-4 font-medium">Title</th>
                <th className="py-2 pr-4 font-medium">Role</th>
                <th className="py-2 pr-4 font-medium">Pay rate</th>
                <th className="py-2 pr-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      <Avatar name={u.name} color={u.avatarColor} />
                      <span className="font-medium text-slate-800">{u.name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 text-slate-600">{u.email}</td>
                  <td className="py-2.5 pr-4 text-slate-600">{u.title || "—"}</td>
                  <td className="py-2.5 pr-4">
                    <Badge tone={u.role === "admin" ? "violet" : "slate"}>{u.role}</Badge>
                  </td>
                  <td className="py-2.5 pr-4 text-slate-600">
                    {u.payRate != null ? `$${u.payRate}/hr` : "—"}
                  </td>
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditUser(u)}>
                        Edit
                      </Button>
                      {u.id !== session.actor.id && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => impersonate(u.id)}
                          >
                            Impersonate
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => del(u)}>
                            <span className="text-rose-600">Delete</span>
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {inviteOpen && (
        <InviteModal onClose={() => setInviteOpen(false)} onAdded={(u) => add("users", u)} />
      )}
      {editUser && (
        <EditModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={(u) => update("users", u.id, u)}
        />
      )}
    </div>
  );
}

function InviteModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: (u: User) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    title: "",
    role: "employee",
    payRate: "",
  });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tempPassword?: string; emailSent?: boolean } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Failed");
      return;
    }
    onAdded(data.item);
    setResult({ tempPassword: data.tempPassword, emailSent: data.emailSent });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Invite employee"
      footer={
        result ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={busy}>
              {busy ? "Inviting…" : "Send invite"}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-3 text-sm">
          {result.emailSent ? (
            <p className="text-emerald-700">
              ✓ Invite emailed with login instructions.
            </p>
          ) : (
            <div>
              <p className="text-slate-600 mb-2">
                Email isn't configured, so share these credentials manually:
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 font-mono text-xs">
                <div>Email: {form.email}</div>
                <div>Temp password: {result.tempPassword}</div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <Select
              label="Role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="employee">Employee</option>
              <option value="admin">Admin</option>
            </Select>
          </div>
          <Input
            label="Pay rate (USD/hour)"
            type="number"
            value={form.payRate}
            onChange={(e) => setForm({ ...form, payRate: e.target.value })}
          />
          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>
      )}
    </Modal>
  );
}

function EditModal({
  user,
  onClose,
  onSaved,
}: {
  user: User;
  onClose: () => void;
  onSaved: (u: User) => void;
}) {
  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    title: user.title || "",
    role: user.role,
    payRate: user.payRate?.toString() || "",
    projects: user.projects || "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Failed");
      return;
    }
    onSaved(data.item);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${user.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input
          label="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <Input
          label="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <Select
            label="Role"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as any })}
          >
            <option value="employee">Employee</option>
            <option value="admin">Admin</option>
          </Select>
        </div>
        <Input
          label="Pay rate (USD/hour)"
          type="number"
          value={form.payRate}
          onChange={(e) => setForm({ ...form, payRate: e.target.value })}
        />
        <Input
          label="Projects override (comma-separated)"
          placeholder="St Bernards, UHC"
          value={form.projects}
          onChange={(e) => setForm({ ...form, projects: e.target.value })}
        />
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </div>
    </Modal>
  );
}
