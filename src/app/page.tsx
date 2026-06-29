"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { PageHeader } from "@/components/ui";

const TABLES = [
  { table: "units", label: "単元", icon: "🗂", href: "/units" },
  { table: "words", label: "単語", icon: "📒", href: "/words" },
  { table: "sentences", label: "文章", icon: "💬", href: "/sentences" },
  { table: "songs", label: "楽曲", icon: "🎵", href: "/songs" },
] as const;

export default function DashboardPage() {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    (async () => {
      const result: Record<string, number> = {};
      for (const t of TABLES) {
        const { count } = await sb
          .from(t.table)
          .select("*", { count: "exact", head: true });
        result[t.table] = count ?? 0;
      }
      setCounts(result);
    })();
  }, []);

  return (
    <div>
      <PageHeader
        title="ダッシュボード"
        subtitle="studio163 のコンテンツ管理"
      />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {TABLES.map((t) => (
          <Link
            key={t.table}
            href={t.href}
            className="border-2 border-black bg-white p-5 transition-colors hover:bg-accent"
          >
            <div className="text-2xl">{t.icon}</div>
            <p className="mt-3 text-4xl font-bold tracking-tight text-black">
              {counts[t.table] ?? "—"}
            </p>
            <p className="text-sm font-bold text-black">{t.label}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8 border-2 border-black bg-white p-5 text-sm font-medium text-zinc-600">
        <p className="font-bold text-black">使い方</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>左メニューから単元・単語・文章・楽曲を編集できます。</li>
          <li>単語/文章は「単元」に紐づけて登録します。先に単元を作成してください。</li>
          <li>楽曲は YouTube ID を登録し、各曲の詳細で歌詞行とクイズを設定します。</li>
          <li>変更は公開サイト（ポート7778）にそのまま反映されます。</li>
        </ul>
      </div>
    </div>
  );
}
