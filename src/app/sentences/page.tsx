"use client";

import { useState } from "react";
import { useTable } from "@/lib/db";
import type { Sentence, Unit } from "@/lib/types";
import {
  PageHeader,
  Button,
  Field,
  TextInput,
  Select,
  Card,
} from "@/components/ui";

type Draft = Partial<Sentence> & { tokensText?: string };

export default function SentencesPage() {
  const { rows: units } = useTable<Unit>("units", { column: "order_index" });
  const { rows, loading, error, save, remove } =
    useTable<Sentence>("sentences");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const unitTitle = (id: string | null | undefined) =>
    units.find((u) => u.id === id)?.title ?? "—";

  function startEdit(s: Sentence) {
    setDraft({ ...s, tokensText: s.tokens.join(" ") });
  }

  async function submit() {
    if (!draft?.korean || !draft?.meaning_ja) {
      setFormError("韓国語と意味は必須です");
      return;
    }
    const tokens = (draft.tokensText ?? draft.korean)
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    setSaving(true);
    setFormError("");
    const { error } = await save({
      id: draft.id,
      unit_id: draft.unit_id || null,
      korean: draft.korean,
      meaning_ja: draft.meaning_ja,
      tokens,
      level: Number(draft.level ?? 1),
    });
    setSaving(false);
    if (error) setFormError(error);
    else setDraft(null);
  }

  return (
    <div>
      <PageHeader
        title="文章"
        subtitle="並べ替えクイズ用に単語を半角スペースで区切ります"
        action={
          <Button
            onClick={() => setDraft({ level: 1, unit_id: units[0]?.id ?? null })}
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
              <div className="md:col-span-2">
                <Field label="韓国語（文）">
                  <TextInput
                    value={draft.korean ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        korean: e.target.value,
                        // tokensText 未編集なら韓国語から自動生成
                        tokensText:
                          draft.tokensText === undefined ||
                          draft.tokensText === ""
                            ? e.target.value
                            : draft.tokensText,
                      })
                    }
                    placeholder="저는 학교에 가요"
                  />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="意味（日本語）">
                  <TextInput
                    value={draft.meaning_ja ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, meaning_ja: e.target.value })
                    }
                    placeholder="私は学校に行きます"
                  />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="トークン（並べ替え用・スペース区切り）">
                  <TextInput
                    value={draft.tokensText ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, tokensText: e.target.value })
                    }
                    placeholder="저는 학교에 가요"
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
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-b border-slate-50">
                  <td className="py-2 font-bold text-slate-700">{s.korean}</td>
                  <td className="text-slate-500">{s.meaning_ja}</td>
                  <td className="text-slate-400">{unitTitle(s.unit_id)}</td>
                  <td className="text-center">
                    <div className="flex justify-center gap-2">
                      <Button variant="ghost" onClick={() => startEdit(s)}>
                        編集
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => {
                          if (confirm("この文章を削除しますか？")) remove(s.id);
                        }}
                      >
                        削除
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-400">
                    文章がありません。
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
