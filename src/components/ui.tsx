"use client";

import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="sticky top-0 z-20 -mx-10 -mt-10 mb-8 flex items-end justify-between gap-4 border-b border-zinc-200 bg-zinc-100 px-10 pb-5 pt-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputBase =
  "w-full border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder:text-zinc-400 transition-colors focus:outline-none focus:border-zinc-900";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputBase} ${props.className ?? ""}`} />;
}

export function TextArea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return (
    <textarea {...props} className={`${inputBase} ${props.className ?? ""}`} />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${inputBase} ${props.className ?? ""}`} />
  );
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
}) {
  const styles = {
    primary: "border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-700 hover:border-zinc-700",
    ghost: "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100 hover:border-zinc-400",
    danger: "border-zinc-300 bg-white text-rose-600 hover:bg-rose-50 hover:border-rose-300",
  }[variant];
  return (
    <button
      {...props}
      className={`border px-4 py-2 text-sm font-semibold tracking-tight transition-colors disabled:opacity-40 ${styles} ${className}`}
    />
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <div className="border border-zinc-200 bg-white p-6">{children}</div>;
}
