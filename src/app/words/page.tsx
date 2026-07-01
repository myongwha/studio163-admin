"use client";

import { useState } from "react";
import { useTable } from "@/lib/db";
import { getSupabase } from "@/lib/supabase";
import type { Unit, Word, Difficulty } from "@/lib/types";
import {
  PageHeader,
  Button,
  Field,
  TextInput,
  Select,
  Card,
} from "@/components/ui";

type Draft = Partial<Word>;

export default function WordsPage() {
  const { rows: units } = useTable<Unit>("units", { column: "order_index" });
  const { rows, loading, error, save, remove, refresh } =
    useTable<Word>("words");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [filterUnit, setFilterUnit] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);

  const unitTitle = (id: string | null | undefined) =>
    units.find((u) => u.id === id)?.title ?? "—";

  const visible =
    filterUnit === "all" ? rows : rows.filter((w) => w.unit_id === filterUnit);

  const toggleSelect = (id: string) =>
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );
  const allSelected =
    visible.length > 0 && visible.every((w) => selected.includes(w.id));
  const toggleSelectAll = () =>
    setSelected(allSelected ? [] : visible.map((w) => w.id));

  async function deleteSelected() {
    if (selected.length === 0) return;
    if (!confirm(`選択した ${selected.length} 件を削除しますか？`)) return;
    const sb = getSupabase();
    if (!sb) return;
    await sb.from("words").delete().in("id", selected);
    setSelected([]);
    refresh();
  }

  async function submit() {
    if (!draft?.korean || !draft?.meaning_ja) {
      setFormError("韓国語と意味は必須です");
      return;
    }
    setSaving(true);
    setFormError("");
    const { error } = await save({
      id: draft.id,
      unit_id: draft.unit_id || null,
      korean: draft.korean,
      reading: draft.reading ?? "",
      meaning_ja: draft.meaning_ja,
      example: draft.example ?? null,
      level: Number(draft.level ?? 1),
      category_large: draft.category_large || null,
      category_medium: draft.category_medium || null,
      category_small: draft.category_small || null,
      difficulty: draft.difficulty || null,
    });
    setSaving(false);
    if (error) setFormError(error);
    else setDraft(null);
  }

  return (
    <div>
      <PageHeader
        title="単語"
        subtitle="単元に紐づけて単語を登録します"
        action={
          <div className="flex flex-wrap justify-end gap-2">
            {selected.length > 0 && (
              <Button variant="danger" onClick={deleteSelected}>
                選択削除（{selected.length}）
              </Button>
            )}
            <Button
              onClick={() =>
                setDraft({ level: 1, unit_id: units[0]?.id ?? null })
              }
              disabled={units.length === 0}
            >
              ＋ 新規追加
            </Button>
          </div>
        }
      />

      {units.length === 0 && (
        <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-700">
          先に「単元」を作成してください。
        </p>
      )}
      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}

      {draft && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
          onClick={() => setDraft(null)}
        >
          <div
            className="my-8 w-full max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Card>
              <h2 className="mb-4 text-lg font-bold tracking-tight text-black">
                {draft.id ? "単語を編集" : "単語を新規追加"}
              </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="単元">
                <Select
                  value={draft.unit_id ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, unit_id: e.target.value })
                  }
                >
                  <option value="">（未設定）</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="レベル (1〜5)">
                <TextInput
                  type="number"
                  min={1}
                  max={5}
                  value={draft.level ?? 1}
                  onChange={(e) =>
                    setDraft({ ...draft, level: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="韓国語">
                <TextInput
                  value={draft.korean ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, korean: e.target.value })
                  }
                  placeholder="안녕하세요"
                />
              </Field>
              <Field label="意味（日本語）">
                <TextInput
                  value={draft.meaning_ja ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, meaning_ja: e.target.value })
                  }
                  placeholder="こんにちは"
                />
              </Field>
              <Field label="難易度（任意）">
                <Select
                  value={draft.difficulty ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      difficulty: (e.target.value || null) as
                        | Difficulty
                        | null,
                    })
                  }
                >
                  <option value="">（未設定）</option>
                  <option value="初級">初級</option>
                  <option value="中級">中級</option>
                  <option value="上級">上級</option>
                </Select>
              </Field>
              <div className="grid gap-4 md:col-span-2 md:grid-cols-3">
                <Field label="大カテゴリー（任意）">
                  <TextInput
                    value={draft.category_large ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, category_large: e.target.value })
                    }
                    placeholder="名詞"
                  />
                </Field>
                <Field label="中カテゴリー（任意）">
                  <TextInput
                    value={draft.category_medium ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, category_medium: e.target.value })
                    }
                    placeholder="食べ物"
                  />
                </Field>
                <Field label="小カテゴリー（任意）">
                  <TextInput
                    value={draft.category_small ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, category_small: e.target.value })
                    }
                    placeholder="果物"
                  />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="例文（任意）">
                  <TextInput
                    value={draft.example ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, example: e.target.value })
                    }
                    placeholder="안녕하세요, 만나서 반갑습니다."
                  />
                </Field>
              </div>
            </div>
            {formError && (
              <p className="mt-3 text-sm text-rose-500">{formError}</p>
            )}
            <div className="mt-4 flex gap-2">
              <Button onClick={submit} disabled={saving}>
                {saving ? "保存中…" : "保存"}
              </Button>
              <Button variant="ghost" onClick={() => setDraft(null)}>
                キャンセル
              </Button>
            </div>
            </Card>
          </div>
        </div>
      )}

      <div className="mb-4">
        <Select
          value={filterUnit}
          onChange={(e) => setFilterUnit(e.target.value)}
          className="max-w-xs"
        >
          <option value="all">すべての単元</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.title}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <p className="text-slate-400">読み込み中…</p>
      ) : (
        <Card>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400">
                <th className="py-2">韓国語</th>
                <th>意味</th>
                <th>単元</th>
                <th className="text-center">操作</th>
                <th className="py-2 text-center">
                  <input
                    type="checkbox"
                    aria-label="全選択"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((w) => (
                <tr key={w.id} className="border-b border-slate-50">
                  <td className="py-2 font-bold text-slate-700">{w.korean}</td>
                  <td className="text-slate-500">{w.meaning_ja}</td>
                  <td className="text-slate-400">{unitTitle(w.unit_id)}</td>
                  <td className="text-center">
                    <div className="flex justify-center gap-2">
                      <Button variant="ghost" onClick={() => setDraft(w)}>
                        編集
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => {
                          if (confirm(`「${w.korean}」を削除しますか？`))
                            remove(w.id);
                        }}
                      >
                        削除
                      </Button>
                    </div>
                  </td>
                  <td className="py-2 text-center align-middle">
                    <input
                      type="checkbox"
                      aria-label="選択"
                      checked={selected.includes(w.id)}
                      onChange={() => toggleSelect(w.id)}
                    />
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    単語がありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
