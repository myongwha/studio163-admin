"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "./supabase";

// テーブルの一覧取得・保存・削除をまとめた汎用フック
export function useTable<T extends { id: string }>(
  table: string,
  orderBy?: { column: string; ascending?: boolean },
) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return;
    setLoading(true);
    let q = sb.from(table).select("*");
    if (orderBy)
      q = q.order(orderBy.column, { ascending: orderBy.ascending ?? true });
    const { data, error } = await q;
    if (error) setError(error.message);
    else setRows((data as T[]) ?? []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, orderBy?.column, orderBy?.ascending]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(
    async (row: Partial<T> & { id?: string }) => {
      const sb = getSupabase();
      if (!sb) return { error: "Supabase未設定" };
      if (row.id) {
        const { id, ...rest } = row;
        const { error } = await sb
          .from(table)
          .update(rest as Record<string, unknown>)
          .eq("id", id);
        if (error) return { error: error.message };
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _omit, ...rest } = row;
        const { error } = await sb
          .from(table)
          .insert(rest as Record<string, unknown>);
        if (error) return { error: error.message };
      }
      await refresh();
      return {};
    },
    [table, refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      const sb = getSupabase();
      if (!sb) return;
      await sb.from(table).delete().eq("id", id);
      await refresh();
    },
    [table, refresh],
  );

  return { rows, loading, error, refresh, save, remove };
}
