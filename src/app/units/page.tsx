"use client";

import { useState } from "react";
import { useTable } from "@/lib/db";
import type { Unit } from "@/lib/types";
import {
  PageHeader,
  Button,
  Field,
  TextInput,
  TextArea,
  Card,
} from "@/components/ui";

type Draft = Partial<Unit>;

export default function UnitsPage() {
  const { rows, loading, error, save, remove } = useTable<Unit>("units", {
    column: "order_index",
  });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function submit() {
    if (!draft?.title) {
      setFormError("タイトルは必須です");
      return;
    }
    setSaving(true);
    setFormError("");
    const { error } = await save({
      id: draft.id,
      title: draft.title,
      description: draft.description ?? "",
      level: Number(draft.level ?? 1),
      order_index: Number(draft.order_index ?? rows.length + 1),
    });
    setSaving(false);
    if (error) setFormError(error);
    else setDraft(null);
  }

  return (
    <div>
      <PageHeader
        title="単元"
        subtitle="学習のまとまり。単語・文章をここに紐づけます"
        action={
          <Button onClick={() => setDraft({ level: 1, order_index: rows.length + 1 })}>
            ＋ 新規追加
          </Button>
        }
      />

      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}

      {draft && (
        <div className="mb-6">
          <Card>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="タイトル">
                <TextInput
                  value={draft.title ?? ""}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="基本のあいさつ"
                />
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
              <Field label="並び順">
                <TextInput
                  type="number"
                  value={draft.order_index ?? 0}
                  onChange={(e) =>
                    setDraft({ ...draft, order_index: Number(e.target.value) })
                  }
                />
              </Field>
              <div className="md:col-span-2">
                <Field label="説明">
                  <TextArea
                    rows={2}
                    value={draft.description ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, description: e.target.value })
                    }
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
                <th className="py-2">順</th>
                <th>タイトル</th>
                <th>Lv</th>
                <th>説明</th>
                <th className="text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="border-b border-slate-50">
                  <td className="py-2 text-slate-400">{u.order_index}</td>
                  <td className="font-bold text-slate-700">{u.title}</td>
                  <td>{u.level}</td>
                  <td className="max-w-xs truncate text-slate-500">
                    {u.description}
                  </td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => setDraft(u)}>
                        編集
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => {
                          if (confirm(`「${u.title}」を削除しますか？`))
                            remove(u.id);
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
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    単元がありません。「新規追加」から作成してください。
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
