"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { PageHeader } from "@/components/ui";

const TABLES = [
  { table: "words", label: "単語", en: "Words", href: "/words" },
  { table: "sentences", label: "文章", en: "Sentences", href: "/sentences" },
  { table: "songs", label: "楽曲", en: "Songs", href: "/songs" },
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
      <div className="grid grid-cols-2 gap-px border border-zinc-200 bg-zinc-200 md:grid-cols-3">
        {TABLES.map((t) => (
          <Link
            key={t.table}
            href={t.href}
            className="group bg-white p-6 transition-colors hover:bg-zinc-50"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-400">
              {t.en}
            </p>
            <p className="mt-4 text-5xl font-semibold tracking-tight text-zinc-900 tabular-nums">
              {counts[t.table] ?? "—"}
            </p>
            <p className="mt-2 flex items-center gap-1 text-sm font-medium text-zinc-500">
              {t.label}
              <span className="text-zinc-300 transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-8 border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          使い方
        </p>
        <ul className="mt-3 space-y-1.5">
          <li>左メニューから単語・文章・楽曲・カテゴリーを編集できます。</li>
          <li>単語・文章はカテゴリー（大›中›小）や品詞で分類します。カテゴリーは「カテゴリー」ページで作成してください。</li>
          <li>楽曲は YouTube ID を登録し、各曲の詳細で歌詞行とクイズを設定します。</li>
          <li>変更は公開サイト（ポート7778）にそのまま反映されます。</li>
        </ul>
      </div>
    </div>
  );
}
