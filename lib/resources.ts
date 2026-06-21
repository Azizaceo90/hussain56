import { prisma } from "./prisma";
import type { SessionContext } from "./auth";

// ---------------------------------------------------------------------------
// Generic REST resource layer.
//
// Each resource maps a URL slug to a Prisma model delegate, the fields that
// must be coerced to Date on write, and the column used for ownership checks.
// Write POLICIES are enforced here server-side; the UI is never trusted.
// ---------------------------------------------------------------------------

export type ResourceName =
  | "expenses"
  | "payroll"
  | "timeEntries"
  | "contracts"
  | "notifications";

type PolicyResult = { ok: true; data?: any } | { ok: false; error: string; status?: number };

export type ResourceDef = {
  // prisma delegate (e.g. prisma.expense)
  model: any;
  // fields to coerce string -> Date on create/update
  dateFields: string[];
  // ownership column on the model (null = not user-owned)
  ownerField: string | null;
  // POST: validate + shape the create payload. Stamp owner from session.
  create?: (ctx: SessionContext, body: any) => PolicyResult;
  // PATCH: validate the update payload against the existing record.
  update?: (ctx: SessionContext, existing: any, body: any) => PolicyResult;
  // DELETE: allow/deny based on existing record.
  remove?: (ctx: SessionContext, existing: any) => PolicyResult;
};

const adminOnly = (ctx: SessionContext): boolean => ctx.actor.role === "admin";

export const RESOURCES: Record<ResourceName, ResourceDef> = {
  // ---- Expenses -----------------------------------------------------------
  expenses: {
    model: prisma.expense,
    dateFields: ["date"],
    ownerField: "userId",
    create(ctx, body) {
      const amount = Number(body.amount);
      if (!body.date) return { ok: false, error: "date is required" };
      if (!isFinite(amount) || amount <= 0)
        return { ok: false, error: "amount must be a positive number" };
      // Owner is always stamped from the session — never trust client userId.
      // New expenses are always "pending"; status changes are admin-only (PATCH).
      return {
        ok: true,
        data: {
          userId: ctx.user.id,
          userName: ctx.user.name,
          date: body.date,
          category: body.category ?? null,
          description: body.description ?? null,
          amount,
          status: "pending",
          receiptUrl: body.receiptUrl ?? null,
          receiptName: body.receiptName ?? null,
        },
      };
    },
    update(ctx, existing, body) {
      const isOwner = existing.userId === ctx.user.id;
      // Only admins may change status (approve/reject/reimburse).
      if (body.status !== undefined && !adminOnly(ctx))
        return { ok: false, error: "Only admins can change expense status", status: 403 };
      if (!adminOnly(ctx) && !isOwner)
        return { ok: false, error: "Forbidden", status: 403 };
      // Owners may only edit their own pending expenses (non-status fields).
      if (isOwner && !adminOnly(ctx) && existing.status !== "pending")
        return { ok: false, error: "Only pending expenses can be edited", status: 403 };
      const data: any = {};
      for (const k of ["category", "description", "receiptUrl", "receiptName"])
        if (body[k] !== undefined) data[k] = body[k];
      if (body.date !== undefined) data.date = body.date;
      if (body.amount !== undefined) {
        const amount = Number(body.amount);
        if (!isFinite(amount) || amount <= 0)
          return { ok: false, error: "amount must be positive" };
        data.amount = amount;
      }
      if (body.status !== undefined && adminOnly(ctx)) {
        const allowed = ["pending", "approved", "reimbursed", "rejected"];
        if (!allowed.includes(body.status))
          return { ok: false, error: "invalid status" };
        data.status = body.status;
      }
      return { ok: true, data };
    },
    remove(ctx, existing) {
      const isOwner = existing.userId === ctx.user.id;
      if (adminOnly(ctx)) return { ok: true };
      // Owners can delete only their own pending expenses.
      if (isOwner && existing.status === "pending") return { ok: true };
      return { ok: false, error: "Forbidden", status: 403 };
    },
  },

  // ---- Payroll (admin only) ----------------------------------------------
  payroll: {
    model: prisma.payrollEntry,
    dateFields: ["periodStart", "periodEnd", "paidAt"],
    ownerField: "userId",
    create(ctx, body) {
      if (!adminOnly(ctx)) return { ok: false, error: "Admin only", status: 403 };
      const hours = Number(body.hours);
      const rate = Number(body.rate);
      if (!body.userId) return { ok: false, error: "userId required" };
      if (!isFinite(hours) || hours < 0) return { ok: false, error: "invalid hours" };
      if (!isFinite(rate) || rate < 0) return { ok: false, error: "invalid rate" };
      const gross = Math.round(hours * rate * 100) / 100;
      return {
        ok: true,
        data: {
          userId: body.userId,
          userName: body.userName ?? null,
          periodStart: body.periodStart,
          periodEnd: body.periodEnd,
          hours,
          rate,
          gross,
          status: body.status === "paid" ? "paid" : "pending",
          method: body.method ?? null,
          note: body.note ?? null,
          paidAt: body.status === "paid" ? body.paidAt ?? new Date().toISOString() : null,
        },
      };
    },
    update(ctx, _existing, body) {
      if (!adminOnly(ctx)) return { ok: false, error: "Admin only", status: 403 };
      const data: any = {};
      for (const k of ["method", "note", "userName"])
        if (body[k] !== undefined) data[k] = body[k];
      if (body.hours !== undefined || body.rate !== undefined) {
        const hours = Number(body.hours ?? _existing.hours);
        const rate = Number(body.rate ?? _existing.rate);
        data.hours = hours;
        data.rate = rate;
        data.gross = Math.round(hours * rate * 100) / 100;
      }
      if (body.periodStart !== undefined) data.periodStart = body.periodStart;
      if (body.periodEnd !== undefined) data.periodEnd = body.periodEnd;
      if (body.status !== undefined) {
        if (!["pending", "paid"].includes(body.status))
          return { ok: false, error: "invalid status" };
        data.status = body.status;
        data.paidAt =
          body.status === "paid" ? body.paidAt ?? new Date().toISOString() : null;
      }
      return { ok: true, data };
    },
    remove(ctx) {
      if (!adminOnly(ctx)) return { ok: false, error: "Admin only", status: 403 };
      return { ok: true };
    },
  },

  // ---- Time entries -------------------------------------------------------
  timeEntries: {
    model: prisma.timeEntry,
    dateFields: ["clockIn", "clockOut", "submittedAt", "approvedAt"],
    ownerField: "userId",
    create(ctx, body) {
      return {
        ok: true,
        data: {
          userId: ctx.user.id,
          clockIn: body.clockIn ?? new Date().toISOString(),
          clockOut: body.clockOut ?? null,
          project: body.project ?? null,
          note: body.note ?? null,
          metricCount: body.metricCount ?? 0,
        },
      };
    },
    update(ctx, existing, body) {
      const isOwner = existing.userId === ctx.user.id;
      if (!adminOnly(ctx) && !isOwner)
        return { ok: false, error: "Forbidden", status: 403 };
      // approvedAt is admin-only.
      if (body.approvedAt !== undefined && !adminOnly(ctx))
        return { ok: false, error: "Admin only", status: 403 };
      const data: any = {};
      for (const k of ["project", "note", "metricCount"])
        if (body[k] !== undefined) data[k] = body[k];
      for (const k of ["clockIn", "clockOut", "submittedAt", "approvedAt"])
        if (body[k] !== undefined) data[k] = body[k];
      return { ok: true, data };
    },
    remove(ctx, existing) {
      const isOwner = existing.userId === ctx.user.id;
      if (adminOnly(ctx) || isOwner) return { ok: true };
      return { ok: false, error: "Forbidden", status: 403 };
    },
  },

  // ---- Contracts (admin issues; assignee signs via dedicated routes) ------
  contracts: {
    model: prisma.contract,
    dateFields: ["issuedAt", "signedAt", "remindedAt"],
    ownerField: "assignedToId",
    create(ctx) {
      // Contracts are created through /api/contracts/issue (PDF stamping), not
      // the generic POST. Block generic create to avoid bypassing that logic.
      return { ok: false, error: "Use /api/contracts/issue", status: 400 };
    },
    update(ctx) {
      if (!adminOnly(ctx)) return { ok: false, error: "Admin only", status: 403 };
      return { ok: false, error: "Use dedicated contract routes", status: 400 };
    },
    remove(ctx) {
      if (!adminOnly(ctx)) return { ok: false, error: "Admin only", status: 403 };
      return { ok: true };
    },
  },

  // ---- Notifications (owner read/mark; created server-side) ---------------
  notifications: {
    model: prisma.notification,
    dateFields: ["createdAt"],
    ownerField: "userId",
    create() {
      return { ok: false, error: "Notifications are created server-side", status: 400 };
    },
    update(ctx, existing, body) {
      if (existing.userId !== ctx.user.id && !adminOnly(ctx))
        return { ok: false, error: "Forbidden", status: 403 };
      const data: any = {};
      if (body.read !== undefined) data.read = !!body.read;
      return { ok: true, data };
    },
    remove(ctx, existing) {
      if (existing.userId !== ctx.user.id && !adminOnly(ctx))
        return { ok: false, error: "Forbidden", status: 403 };
      return { ok: true };
    },
  },
};

// Coerce configured date fields (ISO string -> Date) before writing.
export function coerceDates(def: ResourceDef, data: any): any {
  const out = { ...data };
  for (const f of def.dateFields) {
    if (out[f] !== undefined && out[f] !== null && typeof out[f] === "string") {
      out[f] = new Date(out[f]);
    }
  }
  return out;
}
