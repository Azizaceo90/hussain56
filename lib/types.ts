// Shared client/server data shapes (serialized JSON — dates are ISO strings).

export type Role = "admin" | "employee";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  title: string | null;
  avatarColor: string | null;
  fullLegalName: string | null;
  dateOfBirth: string | null;
  address: string | null;
  phone: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  emergencyRelation: string | null;
  paymentMethod: string | null;
  paymentAccount: string | null;
  payRate: number | null;
  projects: string | null;
  signature: string | null;
  createdAt: string;
};

export type TimeEntry = {
  id: string;
  userId: string;
  clockIn: string;
  clockOut: string | null;
  project: string | null;
  note: string | null;
  metricCount: number | null;
  submittedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
};

export type ContractField = {
  id: string;
  type: "name" | "date" | "email" | "address" | "phone" | "signature";
  page: number;
  // normalized 0..1 coordinates relative to the rendered page
  x: number;
  y: number;
  w: number;
  h: number;
  owner?: "employee" | "issuer";
  value?: string;
};

export type Contract = {
  id: string;
  title: string;
  assignedToId: string | null;
  assignedToName: string | null;
  status: "pending" | "signed";
  fileName: string | null;
  dataUrl: string;
  originalDataUrl: string | null;
  fields: ContractField[] | null;
  issuedAt: string;
  signedAt: string | null;
  remindedAt: string | null;
  signatureDataUrl: string | null;
  signerName: string | null;
};

export type Expense = {
  id: string;
  userId: string;
  userName: string | null;
  date: string;
  category: string | null;
  description: string | null;
  amount: number;
  status: "pending" | "approved" | "reimbursed" | "rejected";
  receiptUrl: string | null;
  receiptName: string | null;
  createdAt: string;
};

export type PayrollEntry = {
  id: string;
  userId: string;
  userName: string | null;
  periodStart: string;
  periodEnd: string;
  hours: number;
  rate: number;
  gross: number;
  status: "pending" | "paid";
  method: string | null;
  note: string | null;
  paidAt: string | null;
  createdAt: string;
};

export type Notification = {
  id: string;
  userId: string;
  type: string | null;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
};

export type Bootstrap = {
  session: {
    user: { id: string; name: string; email: string; role: Role; title: string | null };
    actor: { id: string; name: string; email: string; role: Role; title: string | null };
    impersonating: boolean;
  };
  users: User[]; // admins: all; employees: just themselves
  timeEntries: TimeEntry[];
  contracts: Contract[];
  expenses: Expense[];
  payroll: PayrollEntry[];
  notifications: Notification[];
};
