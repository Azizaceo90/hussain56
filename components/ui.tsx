"use client";

import { ReactNode, useEffect } from "react";

// ---------------------------------------------------------------------------
// Clean Tailwind component kit: Card, Modal, PageHeader, StatCard, EmptyState,
// plus small primitives (Button, Input, Select, Textarea, Badge) used across
// the app.
// ---------------------------------------------------------------------------

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function Card({
  children,
  className,
  title,
  actions,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div
      className={cx(
        "bg-white border border-slate-200 rounded-xl shadow-card",
        className
      )}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800 text-sm">{title}</h3>
          <div className="flex items-center gap-2">{actions}</div>
        </div>
      )}
      <div className={title || actions ? "p-5" : "p-5"}>{children}</div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="text-slate-500 text-sm mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "green" | "amber" | "blue" | "rose";
}) {
  const tones: Record<string, string> = {
    default: "text-slate-900",
    green: "text-emerald-600",
    amber: "text-amber-600",
    blue: "text-brand-600",
    rose: "text-rose-600",
  };
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-card p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className={cx("text-2xl font-bold mt-1", tones[tone])}>{value}</div>
      {hint && <div className="text-xs text-slate-400 mt-1">{hint}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="text-center py-12 px-4">
      <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-xl mb-3">
        {icon ?? "•"}
      </div>
      <h3 className="font-semibold text-slate-700">{title}</h3>
      {description && (
        <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto bg-slate-900/40"
      onMouseDown={onClose}
    >
      <div
        className={cx(
          "bg-white rounded-xl shadow-xl w-full mt-12 mb-12",
          wide ? "max-w-4xl" : "max-w-lg"
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">{title}</h3>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-xl leading-none"
            >
              ×
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-100">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  ...props
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm" | "md";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const variants: Record<string, string> = {
    primary: "bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-300",
    secondary:
      "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:opacity-50",
    ghost: "text-slate-600 hover:bg-slate-100",
    danger: "bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-300",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300",
  };
  const sizes: Record<string, string> = {
    sm: "px-2.5 py-1.5 text-xs",
    md: "px-3.5 py-2 text-sm",
  };
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input(
  props: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }
) {
  const { label, className, ...rest } = props;
  return (
    <label className="block">
      {label && (
        <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      )}
      <input
        className={cx(
          "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100",
          className
        )}
        {...rest}
      />
    </label>
  );
}

export function Select(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & {
    label?: string;
    children: ReactNode;
  }
) {
  const { label, className, children, ...rest } = props;
  return (
    <label className="block">
      {label && (
        <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      )}
      <select
        className={cx(
          "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100",
          className
        )}
        {...rest}
      >
        {children}
      </select>
    </label>
  );
}

export function Textarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }
) {
  const { label, className, ...rest } = props;
  return (
    <label className="block">
      {label && (
        <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      )}
      <textarea
        className={cx(
          "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100",
          className
        )}
        {...rest}
      />
    </label>
  );
}

export function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "slate" | "green" | "amber" | "blue" | "rose" | "violet";
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-600",
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    blue: "bg-brand-100 text-brand-700",
    rose: "bg-rose-100 text-rose-700",
    violet: "bg-violet-100 text-violet-700",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}

export function money(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n || 0);
}

// Status -> badge tone mapping shared across expenses/payroll/contracts.
export function statusTone(
  status: string
): "slate" | "green" | "amber" | "blue" | "rose" | "violet" {
  switch (status) {
    case "approved":
    case "signed":
    case "paid":
      return "green";
    case "reimbursed":
      return "blue";
    case "pending":
      return "amber";
    case "rejected":
      return "rose";
    default:
      return "slate";
  }
}
