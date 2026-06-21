import nodemailer from "nodemailer";

// Graceful no-op email layer. When GMAIL_USER / GMAIL_APP_PASSWORD are unset,
// emails are logged to the server console instead of sent, so local/dev and
// unconfigured deploys never crash.

type SendArgs = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
};

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
  }
  return transporter;
}

export function emailConfigured(): boolean {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

export async function sendEmail(args: SendArgs): Promise<{ sent: boolean }> {
  const t = getTransporter();
  if (!t) {
    console.log(
      `[email:no-op] to=${args.to} subject="${args.subject}"\n${args.text || args.html || ""}`
    );
    return { sent: false };
  }
  try {
    await t.sendMail({
      from: process.env.GMAIL_USER,
      to: args.to,
      subject: args.subject,
      text: args.text,
      html: args.html,
    });
    return { sent: true };
  } catch (err) {
    console.error("[email] send failed:", err);
    return { sent: false };
  }
}
