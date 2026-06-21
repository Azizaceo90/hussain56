import { prisma } from "./prisma";

// Create an in-app notification for a single user.
export async function notify(args: {
  userId: string;
  type?: string;
  title: string;
  body?: string;
  link?: string;
}) {
  return prisma.notification.create({
    data: {
      userId: args.userId,
      type: args.type,
      title: args.title,
      body: args.body,
      link: args.link,
    },
  });
}

// Notify every admin (used for "money" and timesheet-submitted events).
export async function notifyAdmins(args: {
  type?: string;
  title: string;
  body?: string;
  link?: string;
  exceptUserId?: string;
}) {
  const admins = await prisma.user.findMany({
    where: { role: "admin" },
    select: { id: true },
  });
  const targets = admins.filter((a) => a.id !== args.exceptUserId);
  if (targets.length === 0) return;
  await prisma.notification.createMany({
    data: targets.map((a) => ({
      userId: a.id,
      type: args.type,
      title: args.title,
      body: args.body,
      link: args.link,
    })),
  });
}
