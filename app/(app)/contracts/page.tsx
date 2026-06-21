"use client";

import { useState } from "react";
import { useData, useRefreshOnMount } from "@/components/DataProvider";
import { ContractPdf } from "@/components/ContractPdf";
import { SignaturePad } from "@/components/SignaturePad";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
  cx,
  statusTone,
} from "@/components/ui";
import { fmtDate } from "@/lib/dates";
import type { Contract, ContractField } from "@/lib/types";

const FIELD_TYPES: ContractField["type"][] = [
  "name",
  "date",
  "email",
  "address",
  "phone",
  "signature",
];

export default function ContractsPage() {
  useRefreshOnMount();
  const { session, contracts, add, update, remove } = useData();
  const isAdmin = session.user.role === "admin";

  const [issueOpen, setIssueOpen] = useState(false);
  const [signing, setSigning] = useState<Contract | null>(null);
  const [viewing, setViewing] = useState<Contract | null>(null);

  async function remind(c: Contract) {
    const res = await fetch(`/api/contracts/${c.id}/reminder`, { method: "POST" });
    if (res.ok) {
      const { item } = await res.json();
      update("contracts", c.id, { remindedAt: item.remindedAt });
      alert("Reminder sent.");
    }
  }

  async function reopen(c: Contract) {
    if (!confirm("Re-open this signed contract? The signature will be removed.")) return;
    const res = await fetch(`/api/contracts/${c.id}/reopen`, { method: "POST" });
    if (res.ok) {
      const { item } = await res.json();
      update("contracts", c.id, item);
    }
  }

  async function del(c: Contract) {
    if (!confirm("Delete this contract?")) return;
    remove("contracts", c.id);
    await fetch(`/api/contracts/${c.id}`, { method: "DELETE" });
  }

  return (
    <div>
      <PageHeader
        title="Contracts"
        subtitle="Issue and e-sign documents"
        actions={
          isAdmin && <Button onClick={() => setIssueOpen(true)}>Issue contract</Button>
        }
      />

      <Card>
        {contracts.length === 0 ? (
          <EmptyState
            title="No contracts"
            description={isAdmin ? "Issue a contract to get started." : "Nothing to sign right now."}
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {contracts.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="font-medium text-slate-800">{c.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {isAdmin && <>Assigned to {c.assignedToName || "—"} · </>}
                    Issued {fmtDate(c.issuedAt)}
                    {c.signedAt && <> · Signed {fmtDate(c.signedAt)}</>}
                    {c.remindedAt && c.status === "pending" && (
                      <> · Reminded {fmtDate(c.remindedAt)}</>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                  <Button size="sm" variant="ghost" onClick={() => setViewing(c)}>
                    View
                  </Button>
                  {!isAdmin && c.status === "pending" && c.assignedToId === session.user.id && (
                    <Button size="sm" onClick={() => setSigning(c)}>
                      Sign
                    </Button>
                  )}
                  {isAdmin && c.status === "pending" && (
                    <Button size="sm" variant="secondary" onClick={() => remind(c)}>
                      Send reminder
                    </Button>
                  )}
                  {isAdmin && c.status === "signed" && (
                    <Button size="sm" variant="secondary" onClick={() => reopen(c)}>
                      Re-open
                    </Button>
                  )}
                  {isAdmin && (
                    <Button size="sm" variant="ghost" onClick={() => del(c)}>
                      <span className="text-rose-600">Delete</span>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {issueOpen && (
        <IssueModal onClose={() => setIssueOpen(false)} onIssued={(c) => add("contracts", c)} />
      )}
      {signing && (
        <SignModal
          contract={signing}
          onClose={() => setSigning(null)}
          onSigned={(c) => update("contracts", c.id, c)}
        />
      )}
      {viewing && <ViewModal contract={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

// --------------------------------------------------------------------------
// Issue
// --------------------------------------------------------------------------
function IssueModal({
  onClose,
  onIssued,
}: {
  onClose: () => void;
  onIssued: (c: Contract) => void;
}) {
  const { users } = useData();
  const employees = users.filter((u) => u.role === "employee");

  const [title, setTitle] = useState("");
  const [assignedToId, setAssignedToId] = useState(employees[0]?.id || "");
  const [payRate, setPayRate] = useState("");
  const [pdf, setPdf] = useState<{ dataUrl: string; name: string } | null>(null);
  const [fields, setFields] = useState<ContractField[]>([]);
  const [fieldType, setFieldType] = useState<ContractField["type"]>("signature");
  const [mySignatureMode, setMySignatureMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onFile(file?: File) {
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("Please upload a PDF");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("PDF must be under 8MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPdf({ dataUrl: reader.result as string, name: file.name });
    reader.readAsDataURL(file);
  }

  function place(page: number, x: number, y: number) {
    const isSig = mySignatureMode || fieldType === "signature";
    const w = isSig ? 0.28 : 0.24;
    const h = isSig ? 0.08 : 0.04;
    const field: ContractField = {
      id: crypto.randomUUID(),
      type: mySignatureMode ? "signature" : fieldType,
      page,
      // place with click as the top-left, clamped so it stays on page
      x: Math.min(Math.max(x, 0), 1 - w),
      y: Math.min(Math.max(y, 0), 1 - h),
      w,
      h,
      owner: mySignatureMode ? "issuer" : "employee",
    };
    setFields((f) => [...f, field]);
  }

  async function issue() {
    if (!title || !pdf) {
      setError("Title and PDF are required");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/contracts/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        assignedToId: assignedToId || null,
        payRate: payRate || null,
        fileName: pdf.name,
        dataUrl: pdf.dataUrl,
        fields,
      }),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Failed to issue");
      return;
    }
    onIssued(data.item);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title="Issue contract"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={issue} disabled={busy}>
            {busy ? "Issuing…" : "Issue contract"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Select
            label="Assign to"
            value={assignedToId}
            onChange={(e) => setAssignedToId(e.target.value)}
          >
            <option value="">Unassigned</option>
            {employees.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </div>
        <Input
          label="Pay rate (USD/hour) — saved to assignee"
          type="number"
          value={payRate}
          onChange={(e) => setPayRate(e.target.value)}
        />

        {!pdf ? (
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">PDF document</span>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => onFile(e.target.files?.[0])}
              className="text-sm"
            />
          </label>
        ) : (
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-xs text-slate-500 mr-2">Place fields:</span>
              {FIELD_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setFieldType(t);
                    setMySignatureMode(false);
                  }}
                  className={cx(
                    "px-2.5 py-1 rounded-full text-xs font-medium border",
                    !mySignatureMode && fieldType === t
                      ? "bg-brand-600 text-white border-brand-600"
                      : "bg-white text-slate-600 border-slate-300"
                  )}
                >
                  {t}
                </button>
              ))}
              <button
                onClick={() => setMySignatureMode((m) => !m)}
                className={cx(
                  "px-2.5 py-1 rounded-full text-xs font-medium border",
                  mySignatureMode
                    ? "bg-violet-600 text-white border-violet-600"
                    : "bg-white text-violet-600 border-violet-300"
                )}
              >
                ✎ My signature
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-2">
              Click on the document to place a field. Click a placed field to remove it.
              {mySignatureMode && " (Your saved signature will be stamped on issue.)"}
            </p>
            <ContractPdf
              dataUrl={pdf.dataUrl}
              fields={fields}
              placing
              onPlace={place}
              onRemoveField={(id) => setFields((f) => f.filter((x) => x.id !== id))}
            />
          </div>
        )}
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </div>
    </Modal>
  );
}

// --------------------------------------------------------------------------
// Sign
// --------------------------------------------------------------------------
function SignModal({
  contract,
  onClose,
  onSigned,
}: {
  contract: Contract;
  onClose: () => void;
  onSigned: (c: Contract) => void;
}) {
  const { session, users } = useData();
  const me = users.find((u) => u.id === session.user.id);
  const fields = (contract.fields || []).filter((f) => f.owner !== "issuer");
  const textFields = fields.filter((f) => f.type !== "signature");
  const hasPlacedFields = fields.length > 0;

  const [values, setValues] = useState<Record<string, string>>({});
  const [signature, setSignature] = useState<string | null>(null);
  const [fallback, setFallback] = useState({
    name: session.user.name,
    address: me?.address || "",
    phone: me?.phone || "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!signature) {
      setError("Please add your signature");
      return;
    }
    setBusy(true);
    setError(null);
    // Merge fallback values into placed-field values when no fields were placed.
    const finalValues = { ...values };
    const res = await fetch(`/api/contracts/${contract.id}/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signatureDataUrl: signature,
        signerName: fallback.name,
        values: finalValues,
      }),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Failed to sign");
      return;
    }
    onSigned(data.item);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={`Sign: ${contract.title}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Signing…" : "Sign & submit"}
          </Button>
        </>
      }
    >
      <div className="grid lg:grid-cols-2 gap-5">
        <div>
          <ContractPdf dataUrl={contract.dataUrl} fields={fields} />
        </div>
        <div className="space-y-4">
          {hasPlacedFields ? (
            textFields.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-700">Fill in your details</h4>
                {textFields.map((f) => (
                  <Input
                    key={f.id}
                    label={f.type}
                    value={values[f.id] ?? defaultFieldValue(f.type, session.user.name, session.user.email)}
                    onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}
                  />
                ))}
              </div>
            )
          ) : (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-700">Your details</h4>
              <Input
                label="Full name"
                value={fallback.name}
                onChange={(e) => setFallback({ ...fallback, name: e.target.value })}
              />
              <Input
                label="Address"
                value={fallback.address}
                onChange={(e) => setFallback({ ...fallback, address: e.target.value })}
              />
              <Input
                label="Phone"
                value={fallback.phone}
                onChange={(e) => setFallback({ ...fallback, phone: e.target.value })}
              />
            </div>
          )}

          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Signature</h4>
            <SignaturePad saved={me?.signature} onChange={setSignature} />
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>
      </div>
    </Modal>
  );
}

function defaultFieldValue(type: string, name: string, email: string): string {
  if (type === "name") return name;
  if (type === "email") return email;
  if (type === "date") return new Date().toLocaleDateString("en-US");
  return "";
}

// --------------------------------------------------------------------------
// View
// --------------------------------------------------------------------------
function ViewModal({ contract, onClose }: { contract: Contract; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} wide title={contract.title}>
      <ContractPdf dataUrl={contract.dataUrl} fields={[]} />
      <div className="mt-3 text-right">
        <a
          href={contract.dataUrl}
          download={contract.fileName || `${contract.title}.pdf`}
          className="text-sm text-brand-600 underline"
        >
          Download PDF
        </a>
      </div>
    </Modal>
  );
}
