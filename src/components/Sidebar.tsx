"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "ダッシュボード", icon: "📊" },
  { href: "/units", label: "単元", icon: "🗂" },
  { href: "/words", label: "単語", icon: "📒" },
  { href: "/sentences", label: "文章", icon: "💬" },
  { href: "/songs", label: "楽曲", icon: "🎵" },
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
    <aside className="flex w-56 shrink-0 flex-col border-r-2 border-black bg-white">
      <div className="p-5">
        <p className="flex items-baseline gap-1 text-lg font-semibold tracking-tight">
          <span className="text-zinc-900">studio</span>
          <span className="text-zinc-400">163</span>
        </p>
        <p className="text-xs text-zinc-400">管理画面</p>
      </div>
      <nav className="flex-1 px-3">
        <ul className="flex flex-col gap-1">
          {NAV.map((n) => {
            const active =
              n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
            return (
              <li key={n.href}>
                <Link
                  href={n.href}
                  className={`flex items-center gap-2.5 px-3 py-2.5 text-sm font-bold transition-colors ${
                    active
                      ? "bg-black text-white"
                      : "text-black hover:bg-accent"
                  }`}
                >
                  <span className="text-base">{n.icon}</span>
                  {n.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t-2 border-black p-3">
        <p className="truncate px-2 text-xs font-medium text-zinc-500">
          {email}
        </p>
        <button
          onClick={onSignOut}
          className="mt-2 w-full border-2 border-black py-2 text-sm font-bold text-black transition-colors hover:bg-accent"
        >
          ログアウト
        </button>
      </div>
    </aside>
  );
}
