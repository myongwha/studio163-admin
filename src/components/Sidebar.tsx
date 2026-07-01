"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const ICON: Record<string, ReactNode> = {
  "/": (
    <>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </>
  ),
  "/words": (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </>
  ),
  "/categories": (
    <>
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2A2 2 0 0 1 3 12V4a1 1 0 0 1 1-1h8a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.6z" />
      <circle cx="7.5" cy="7.5" r="1" />
    </>
  ),
  "/sentences": (
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  ),
  "/songs": (
    <>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </>
  ),
};

const NAV = [
  { href: "/", label: "ダッシュボード" },
  { href: "/words", label: "単語" },
  { href: "/categories", label: "カテゴリー" },
  { href: "/sentences", label: "文章" },
  { href: "/songs", label: "楽曲" },
];

export function Sidebar({
  onSignOut,
  email,
}: {
  onSignOut: () => void;
  email: string;
}) {
  const pathname = usePathname();
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-zinc-200 bg-white">
      <div className="shrink-0 px-6 py-7">
        <p className="flex items-baseline gap-0.5 text-lg font-semibold tracking-tight">
          <span className="text-zinc-900">studio</span>
          <span className="text-zinc-300">163</span>
        </p>
        <p className="mt-0.5 text-[11px] uppercase tracking-[0.2em] text-zinc-400">
          Admin
        </p>
      </div>
      <nav className="flex-1 overflow-y-auto px-3">
        <ul className="flex flex-col gap-0.5">
          {NAV.map((n) => {
            const active =
              n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
            return (
              <li key={n.href}>
                <Link
                  href={n.href}
                  className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                  }`}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0"
                  >
                    {ICON[n.href]}
                  </svg>
                  {n.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="shrink-0 border-t border-zinc-200 p-4">
        <a
          href={process.env.NEXT_PUBLIC_APP_URL || "http://localhost:7778"}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-3 flex items-center justify-center gap-1.5 border border-zinc-300 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100 hover:border-zinc-400"
        >
          アプリケーションへ
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
        </a>
        <p className="truncate px-1 text-xs text-zinc-400">{email}</p>
        <button
          onClick={onSignOut}
          className="mt-2 w-full border border-zinc-300 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100 hover:border-zinc-400"
        >
          ログアウト
        </button>
      </div>
    </aside>
  );
}
