"use client";

import { useState } from "react";
import { useTable } from "@/lib/db";
import type { Unit, Word } from "@/lib/types";
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
  const { rows, loading, error, save, remove } = useTable<Word>("words");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [filterUnit, setFilterUnit] = useState("all");

  const unitTitle = (id: string | null | undefined) =>
    units.find((u) => u.id === id)?.title ?? "—";

  const visible =
    filterUnit === "all" ? rows : rows.filter((w) => w.unit_id === filterUnit);

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
      category: draft.category ?? null,
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
          <Button
            onClick={() =>
              setDraft({ level: 1, unit_id: units[0]?.id ?? null })
            }
            disabled={units.length === 0}
          >
            ＋ 新規追加
          </Button>
        }
      />

      {units.length === 0 && (
        <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-700">
          先に「単元」を作成してください。
        </p>
      )}
      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}

      {draft && (
        <div className="mb-6">
          <Card>
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
              <Field label="発音（カナ/ローマ字）">
                <TextInput
                  value={draft.reading ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, reading: e.target.value })
                  }
                  placeholder="アンニョンハセヨ"
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
              <Field label="カテゴリ（任意）">
                <TextInput
                  value={draft.category ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, category: e.target.value })
                  }
                  placeholder="あいさつ"
                />
              </Field>
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
                <th>発音</th>
                <th>意味</th>
                <th>単元</th>
                <th className="text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((w) => (
                <tr key={w.id} className="border-b border-slate-50">
                  <td className="py-2 font-bold text-slate-700">{w.korean}</td>
                  <td className="text-slate-500">{w.reading}</td>
                  <td className="text-slate-500">{w.meaning_ja}</td>
                  <td className="text-slate-400">{unitTitle(w.unit_id)}</td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
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
