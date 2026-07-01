"use client";

import { useState } from "react";
import { useTable } from "@/lib/db";
import type {
  GrammarLesson,
  GrammarPage,
  GrammarExample,
} from "@/lib/types";
import {
  PageHeader,
  Button,
  Field,
  TextInput,
  TextArea,
  Card,
} from "@/components/ui";

type Draft = Partial<GrammarLesson>;

export default function GrammarAdminPage() {
  const { rows, loading, error, save, remove } =
    useTable<GrammarLesson>("grammar");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const pages = draft?.pages ?? [];
  const examples = draft?.examples ?? [];

  function setExamples(next: GrammarExample[]) {
    setDraft((d) => (d ? { ...d, examples: next } : d));
  }
  function addExample() {
    setExamples([...examples, { korean: "", meaning_ja: "" }]);
  }
  function updateExample(i: number, patch: Partial<GrammarExample>) {
    setExamples(examples.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  }
  function removeExample(i: number) {
    setExamples(examples.filter((_, j) => j !== i));
  }

  function setPages(next: GrammarPage[]) {
    setDraft((d) => (d ? { ...d, pages: next } : d));
  }
  function addPage() {
    setPages([...pages, { title: "", body: "" }]);
  }
  function updatePage(i: number, patch: Partial<GrammarPage>) {
    setPages(pages.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  }
  function removePage(i: number) {
    setPages(pages.filter((_, j) => j !== i));
  }
  function movePage(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= pages.length) return;
    const next = [...pages];
    [next[i], next[j]] = [next[j], next[i]];
    setPages(next);
  }

  async function submit() {
    if (!draft?.title) {
      setFormError("文法名は必須です");
      return;
    }
    setSaving(true);
    setFormError("");
    const { error } = await save({
      id: draft.id,
      title: draft.title,
      description: draft.description ?? "",
      image: draft.image || null,
      examples: draft.examples ?? [],
      level: Number(draft.level ?? 1),
      pages: draft.pages ?? [],
    });
    setSaving(false);
    if (error) setFormError(error);
    else setDraft(null);
  }

  return (
    <div>
      <PageHeader
        title="文法"
        subtitle="文法名・説明を作成し、ページ（ブログ形式）を追加します"
        action={
          <Button onClick={() => setDraft({ level: 1, pages: [] })}>
            ＋ 新規作成
          </Button>
        }
      />

      {error && <p className="mb-4 text-sm text-rose-500">{error}</p>}

      {draft && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
          onClick={() => setDraft(null)}
        >
          <div
            className="my-8 w-full max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Card>
              <h2 className="mb-4 text-lg font-bold tracking-tight text-black">
                {draft.id ? "文法を編集" : "文法を新規作成"}
              </h2>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="文法名">
                  <TextInput
                    value={draft.title ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, title: e.target.value })
                    }
                    placeholder="〜아요 / 어요（해요体）"
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
              </div>
              <div className="mt-4">
                <Field label="説明">
                  <TextInput
                    value={draft.description ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, description: e.target.value })
                    }
                    placeholder="親しみのある丁寧な言い方を覚えよう"
                  />
                </Field>
              </div>
              <div className="mt-4">
                <Field label="写真URL（任意・1ページ目）">
                  <TextInput
                    value={draft.image ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, image: e.target.value })
                    }
                    placeholder="https://… 画像URL"
                  />
                </Field>
                {draft.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={draft.image}
                    alt=""
                    className="mt-2 h-28 w-48 border-2 border-black object-cover"
                  />
                )}
              </div>

              {/* 例文（1ページ目） */}
              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-bold text-black">
                    例文（1ページ目）
                  </p>
                  <Button variant="ghost" onClick={addExample}>
                    ＋ 例文を追加
                  </Button>
                </div>
                <div className="flex flex-col gap-2">
                  {examples.map((ex, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <TextInput
                        value={ex.korean}
                        onChange={(e) =>
                          updateExample(i, { korean: e.target.value })
                        }
                        placeholder="韓国語"
                        className="flex-1"
                      />
                      <TextInput
                        value={ex.meaning_ja}
                        onChange={(e) =>
                          updateExample(i, { meaning_ja: e.target.value })
                        }
                        placeholder="日本語"
                        className="flex-1"
                      />
                      <Button
                        variant="danger"
                        onClick={() => removeExample(i)}
                      >
                        削除
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* 追加ページ（2ページ目以降・ブログ形式） */}
              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-bold text-black">
                    追加ページ（2ページ目以降・{pages.length}）
                  </p>
                  <Button variant="ghost" onClick={addPage}>
                    ＋ ページを追加
                  </Button>
                </div>
                <div className="flex flex-col gap-4">
                  {pages.map((p, i) => (
                    <div key={i} className="border-2 border-black p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-500">
                          ページ {i + 1}
                        </span>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            onClick={() => movePage(i, -1)}
                          >
                            ↑
                          </Button>
                          <Button variant="ghost" onClick={() => movePage(i, 1)}>
                            ↓
                          </Button>
                          <Button
                            variant="danger"
                            onClick={() => removePage(i)}
                          >
                            削除
                          </Button>
                        </div>
                      </div>
                      <Field label="見出し（任意）">
                        <TextInput
                          value={p.title}
                          onChange={(e) =>
                            updatePage(i, { title: e.target.value })
                          }
                          placeholder="基本ルール"
                        />
                      </Field>
                      <div className="mt-2">
                        <Field label="本文">
                          <TextArea
                            rows={6}
                            value={p.body}
                            onChange={(e) =>
                              updatePage(i, { body: e.target.value })
                            }
                            placeholder="ブログのように自由に記入（改行OK）"
                          />
                        </Field>
                      </div>
                    </div>
                  ))}
                  {pages.length === 0 && (
                    <p className="text-sm text-zinc-400">
                      「＋ ページを追加」で本文ページを作成してください。
                    </p>
                  )}
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

      {loading ? (
        <p className="text-slate-400">読み込み中…</p>
      ) : (
        <Card>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400">
                <th className="py-2">文法名</th>
                <th className="text-center">Lv</th>
                <th className="text-center">ページ数</th>
                <th className="text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <tr key={g.id} className="border-b border-slate-50">
                  <td className="py-2 font-bold text-slate-700">{g.title}</td>
                  <td className="text-center text-slate-500">{g.level}</td>
                  <td className="text-center text-slate-500">
                    {g.pages?.length ?? 0}
                  </td>
                  <td className="text-center">
                    <div className="flex justify-center gap-2">
                      <Button variant="ghost" onClick={() => setDraft(g)}>
                        編集
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => {
                          if (confirm(`「${g.title}」を削除しますか？`))
                            remove(g.id);
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
                    文法がありません。
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
