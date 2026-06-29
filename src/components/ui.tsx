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
    <div className="mb-6 flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-black">{title}</h1>
        {subtitle && (
          <p className="mt-0.5 text-sm font-medium text-zinc-500">{subtitle}</p>
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
      <span className="mb-1.5 block text-sm font-bold text-black">{label}</span>
      {children}
    </label>
  );
}

const inputBase =
  "w-full border-2 border-black bg-white px-3 py-2 text-black placeholder:text-zinc-300 focus:outline-none focus:bg-accent/20";

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
    primary: "border-black bg-black text-white hover:bg-zinc-800",
    ghost: "border-black bg-white text-black hover:bg-accent",
    danger: "border-black bg-white text-rose-600 hover:bg-rose-50",
  }[variant];
  return (
    <button
      {...props}
      className={`border-2 px-4 py-2 text-sm font-bold transition-colors disabled:opacity-40 ${styles} ${className}`}
    />
  );
}

export function Card({ children }: { children: ReactNode }) {
  return (
    <div className="border-2 border-black bg-white p-5">{children}</div>
  );
}
