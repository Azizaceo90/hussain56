import { prisma } from "./prisma";
import { hashPassword } from "./auth";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { weekStart } from "./dates";

// Seeds realistic demo data across every section so the app looks populated.
// Idempotent: if demo employees already exist it skips (pass reset to rebuild).

const DEMO = [
  { name: "Maria Lopez", email: "maria.lopez@demo.local", title: "Medical Coder", payRate: 28, color: "#2563eb" },
  { name: "James Chen", email: "james.chen@demo.local", title: "Medical Biller", payRate: 26, color: "#7c3aed" },
  { name: "Aisha Khan", email: "aisha.khan@demo.local", title: "Front Desk", payRate: 22, color: "#db2777" },
  { name: "David Okoro", email: "david.okoro@demo.local", title: "Medical Coder", payRate: 30, color: "#059669" },
];

const PROJECTS: Record<string, string[]> = {
  "Medical Coder": ["St Bernards", "UHC"],
  "Medical Biller": ["St Bernards", "Aetna"],
  "Front Desk": ["Reception", "Scheduling"],
};

function atUTC(base: Date, addDays: number, hour: number, min = 0): Date {
  return new Date(
    Date.UTC(
      base.getUTCFullYear(),
      base.getUTCMonth(),
      base.getUTCDate() + addDays,
      hour,
      min
    )
  );
}

async function makeContractPdf(title: string, name: string): Promise<string> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  page.drawText("Ops Hub", { x: 50, y: 742, size: 22, font: bold, color: rgb(0.15, 0.39, 0.92) });
  page.drawText(title, { x: 50, y: 706, size: 16, font: bold, color: rgb(0.1, 0.12, 0.2) });
  const lines = [
    `This agreement is entered into between Ops Hub LLC ("Company") and`,
    `${name} ("Employee").`,
    "",
    "1. Duties. The Employee agrees to perform the assigned coding and",
    "   administrative duties in a professional and timely manner.",
    "",
    "2. Compensation. The Employee will be compensated at the agreed",
    "   hourly rate, paid on the Company's regular payroll schedule.",
    "",
    "3. Confidentiality. The Employee agrees to protect all patient and",
    "   business information in accordance with HIPAA and Company policy.",
    "",
    "4. Term. This agreement remains in effect until terminated by either",
    "   party with appropriate notice.",
  ];
  let y = 660;
  for (const line of lines) {
    page.drawText(line, { x: 50, y, size: 11, font, color: rgb(0.2, 0.23, 0.3) });
    y -= 20;
  }
  page.drawText("Signature: ______________________     Date: ____________", {
    x: 50,
    y: 150,
    size: 12,
    font,
    color: rgb(0.1, 0.12, 0.2),
  });
  const bytes = await pdf.save();
  return `data:application/pdf;base64,${Buffer.from(bytes).toString("base64")}`;
}

export async function seedDemoData(opts?: { reset?: boolean }): Promise<{
  seeded: boolean;
  alreadySeeded?: boolean;
  counts?: Record<string, number>;
}> {
  const emails = DEMO.map((d) => d.email);
  const existing = await prisma.user.findMany({ where: { email: { in: emails } } });

  if (existing.length && !opts?.reset) {
    return { seeded: false, alreadySeeded: true };
  }
  if (existing.length && opts?.reset) {
    // Cascade deletes their time entries, expenses, payroll, notifications.
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await prisma.contract.deleteMany({ where: { title: { contains: "[demo]" } } });
  }

  const admin = await prisma.user.findFirst({ where: { role: "admin" }, orderBy: { createdAt: "asc" } });
  const hash = await hashPassword("demo1234");

  // Create employees.
  const users = [];
  for (const d of DEMO) {
    const u = await prisma.user.create({
      data: {
        name: d.name,
        email: d.email,
        role: "employee",
        title: d.title,
        payRate: d.payRate,
        avatarColor: d.color,
        passwordHash: hash,
        phone: "(555) 010-2345",
        address: "123 Demo St, Springfield",
        paymentMethod: "direct_deposit",
      },
    });
    users.push(u);
  }

  const counts: Record<string, number> = { users: users.length, timeEntries: 0, expenses: 0, payroll: 0, contracts: 0, notifications: 0 };
  const thisMonday = weekStart(new Date());

  // Time entries: 3 weeks x Mon–Fri. Oldest week approved, middle submitted,
  // current week left open (not submitted).
  for (const u of users) {
    const projects = PROJECTS[u.title || ""] || ["General"];
    for (let w = 2; w >= 0; w--) {
      const monday = atUTC(thisMonday, -7 * w, 0);
      const submitted = w >= 1;
      const approved = w === 2;
      for (let day = 0; day < 5; day++) {
        // Current week: only fill days up to "today-ish" (2 days).
        if (w === 0 && day > 1) continue;
        const clockIn = atUTC(monday, day, 9);
        const clockOut = atUTC(monday, day, 17);
        await prisma.timeEntry.create({
          data: {
            userId: u.id,
            clockIn,
            clockOut,
            project: projects[day % projects.length],
            metricCount: 40 + ((day * 7 + w) % 25),
            submittedAt: submitted ? atUTC(monday, 6, 18) : null,
            approvedAt: approved ? atUTC(monday, 7, 10) : null,
          },
        });
        counts.timeEntries++;
      }
    }
  }

  // Expenses across statuses.
  const expenseSeed = [
    { u: 0, cat: "Travel", desc: "Mileage to clinic training", amt: 84.5, status: "approved", days: -10 },
    { u: 1, cat: "Software", desc: "Coding reference subscription", amt: 39.99, status: "pending", days: -3 },
    { u: 0, cat: "Supplies", desc: "Office headset", amt: 59.0, status: "reimbursed", days: -22 },
    { u: 2, cat: "Meals", desc: "Team lunch", amt: 46.75, status: "rejected", days: -14 },
    { u: 3, cat: "Certification", desc: "CPC exam renewal", amt: 199.0, status: "pending", days: -1 },
    { u: 1, cat: "Travel", desc: "Parking", amt: 18.0, status: "approved", days: -6 },
  ];
  for (const e of expenseSeed) {
    const u = users[e.u];
    await prisma.expense.create({
      data: {
        userId: u.id,
        userName: u.name,
        date: atUTC(new Date(), e.days, 12),
        category: e.cat,
        description: e.desc,
        amount: e.amt,
        status: e.status,
      },
    });
    counts.expenses++;
  }

  // Payroll: a couple paid (older week), a couple pending (recent week).
  const lastMonday = atUTC(thisMonday, -7, 0);
  const twoWeeksMonday = atUTC(thisMonday, -14, 0);
  const payrollSeed = [
    { u: 0, start: twoWeeksMonday, hours: 40, status: "paid", days: -7 },
    { u: 1, start: twoWeeksMonday, hours: 38.5, status: "paid", days: -7 },
    { u: 0, start: lastMonday, hours: 40, status: "pending" },
    { u: 3, start: lastMonday, hours: 32, status: "pending" },
  ];
  for (const p of payrollSeed) {
    const u = users[p.u];
    const rate = u.payRate || 25;
    await prisma.payrollEntry.create({
      data: {
        userId: u.id,
        userName: u.name,
        periodStart: p.start,
        periodEnd: atUTC(p.start, 6, 23, 59),
        hours: p.hours,
        rate,
        gross: Math.round(p.hours * rate * 100) / 100,
        status: p.status,
        method: p.status === "paid" ? "direct_deposit" : null,
        paidAt: p.status === "paid" ? atUTC(new Date(), p.days || -5, 12) : null,
      },
    });
    counts.payroll++;
  }

  // Contracts: one pending (Maria), one signed (James).
  const pendingPdf = await makeContractPdf("Employment Agreement", users[0].name);
  await prisma.contract.create({
    data: {
      title: "Employment Agreement [demo]",
      assignedToId: users[0].id,
      assignedToName: users[0].name,
      status: "pending",
      fileName: "employment-agreement.pdf",
      dataUrl: pendingPdf,
      originalDataUrl: pendingPdf,
      fields: [],
      issuedAt: atUTC(new Date(), -4, 9),
    },
  });
  counts.contracts++;

  const signedPdf = await makeContractPdf("NDA & Confidentiality", users[1].name);
  await prisma.contract.create({
    data: {
      title: "NDA & Confidentiality [demo]",
      assignedToId: users[1].id,
      assignedToName: users[1].name,
      status: "signed",
      fileName: "nda.pdf",
      dataUrl: signedPdf,
      originalDataUrl: signedPdf,
      fields: [],
      issuedAt: atUTC(new Date(), -12, 9),
      signedAt: atUTC(new Date(), -11, 14),
      signerName: users[1].name,
    },
  });
  counts.contracts++;

  // A few notifications for the admin.
  if (admin) {
    await prisma.notification.createMany({
      data: [
        { userId: admin.id, type: "expense", title: "New expense submitted", body: "David Okoro submitted Certification for $199.00", link: "/payroll" },
        { userId: admin.id, type: "timesheet", title: "Timesheet submitted", body: "Maria Lopez submitted last week's timesheet", link: "/time" },
        { userId: admin.id, type: "contract", title: "Contract signed", body: 'James Chen signed "NDA & Confidentiality"', link: "/contracts" },
      ],
    });
    counts.notifications += 3;
  }

  return { seeded: true, counts };
}
