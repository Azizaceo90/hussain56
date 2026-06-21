"use client";

import { useState } from "react";
import { useData, useRefreshOnMount } from "@/components/DataProvider";
import { SignaturePad } from "@/components/SignaturePad";
import { Button, Card, Input, PageHeader, Select } from "@/components/ui";

export default function AccountPage() {
  useRefreshOnMount();
  const { session, users, update } = useData();
  const me = users.find((u) => u.id === session.user.id);

  const [form, setForm] = useState({
    name: me?.name || "",
    fullLegalName: me?.fullLegalName || "",
    dateOfBirth: me?.dateOfBirth || "",
    address: me?.address || "",
    phone: me?.phone || "",
    emergencyName: me?.emergencyName || "",
    emergencyPhone: me?.emergencyPhone || "",
    emergencyRelation: me?.emergencyRelation || "",
    paymentMethod: me?.paymentMethod || "",
    paymentAccount: me?.paymentAccount || "",
  });
  const [signature, setSignature] = useState<string | null>(me?.signature || null);
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    setBusy(true);
    setSaved(false);
    const payload: any = { ...form, signature };
    if (pw.newPassword) {
      payload.currentPassword = pw.currentPassword;
      payload.newPassword = pw.newPassword;
    }
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.ok) {
      const { item } = await res.json();
      update("users", item.id, item);
      setSaved(true);
      setPw({ currentPassword: "", newPassword: "" });
      setTimeout(() => setSaved(false), 2500);
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Save failed");
    }
  }

  return (
    <div>
      <PageHeader
        title="My Account"
        subtitle="Onboarding details and your reusable signature"
        actions={
          <Button onClick={save} disabled={busy}>
            {busy ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
          </Button>
        }
      />

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Personal">
          <div className="space-y-3">
            <Input label="Display name" value={form.name} onChange={(e) => set("name", e.target.value)} />
            <Input
              label="Full legal name"
              value={form.fullLegalName}
              onChange={(e) => set("fullLegalName", e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Date of birth"
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => set("dateOfBirth", e.target.value)}
              />
              <Input label="Phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <Input label="Address" value={form.address} onChange={(e) => set("address", e.target.value)} />
          </div>
        </Card>

        <Card title="Emergency contact">
          <div className="space-y-3">
            <Input
              label="Contact name"
              value={form.emergencyName}
              onChange={(e) => set("emergencyName", e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Contact phone"
                value={form.emergencyPhone}
                onChange={(e) => set("emergencyPhone", e.target.value)}
              />
              <Input
                label="Relationship"
                value={form.emergencyRelation}
                onChange={(e) => set("emergencyRelation", e.target.value)}
              />
            </div>
          </div>
        </Card>

        <Card title="Payment">
          <div className="space-y-3">
            <Select
              label="Payment method"
              value={form.paymentMethod}
              onChange={(e) => set("paymentMethod", e.target.value)}
            >
              <option value="">Select…</option>
              <option value="direct_deposit">Direct deposit</option>
              <option value="paypal">PayPal</option>
              <option value="zelle">Zelle</option>
              <option value="check">Check</option>
            </Select>
            <Input
              label="Account / details"
              value={form.paymentAccount}
              onChange={(e) => set("paymentAccount", e.target.value)}
            />
          </div>
        </Card>

        <Card title="Change password">
          <div className="space-y-3">
            <Input
              label="Current password"
              type="password"
              value={pw.currentPassword}
              onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })}
            />
            <Input
              label="New password"
              type="password"
              value={pw.newPassword}
              onChange={(e) => setPw({ ...pw, newPassword: e.target.value })}
            />
            <p className="text-xs text-slate-400">Leave blank to keep your current password.</p>
          </div>
        </Card>

        <Card title="Saved signature" className="lg:col-span-2">
          <p className="text-sm text-slate-500 mb-3">
            Draw or type a signature to reuse when signing contracts.
          </p>
          <SignaturePad saved={me?.signature} onChange={setSignature} />
        </Card>
      </div>
    </div>
  );
}
