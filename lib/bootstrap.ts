import { prisma } from "./prisma";
import type { SessionContext } from "./auth";
import type { Bootstrap } from "./types";

// Returns all data scoped by role. Admins see everything; employees see only
// their own records (plus their own user row). Impersonation uses the effective
// user, so an admin impersonating an employee sees that employee's view.

export async function loadBootstrap(ctx: SessionContext): Promise<Bootstrap> {
  const isAdmin = ctx.user.role === "admin";
  const uid = ctx.user.id;

  const [users, timeEntries, contracts, expenses, payroll, notifications] =
    await Promise.all([
      isAdmin
        ? prisma.user.findMany({ orderBy: { createdAt: "asc" } })
        : prisma.user.findMany({ where: { id: uid } }),
      prisma.timeEntry.findMany({
        where: isAdmin ? {} : { userId: uid },
        orderBy: { clockIn: "desc" },
      }),
      prisma.contract.findMany({
        where: isAdmin ? {} : { assignedToId: uid },
        orderBy: { issuedAt: "desc" },
      }),
      prisma.expense.findMany({
        where: isAdmin ? {} : { userId: uid },
        orderBy: { date: "desc" },
      }),
      prisma.payrollEntry.findMany({
        where: isAdmin ? {} : { userId: uid },
        orderBy: { periodEnd: "desc" },
      }),
      prisma.notification.findMany({
        where: { userId: uid },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

  // Strip passwordHash from user rows before sending to the client.
  const safeUsers = users.map(({ passwordHash, ...u }) => u);

  return {
    session: {
      user: ctx.user as any,
      actor: ctx.actor as any,
      impersonating: ctx.impersonating,
    },
    users: safeUsers as any,
    timeEntries: timeEntries as any,
    contracts: contracts as any,
    expenses: expenses as any,
    payroll: payroll as any,
    notifications: notifications as any,
  };
}
