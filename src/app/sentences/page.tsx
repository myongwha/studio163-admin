"use client";

import { useState } from "react";
import { useTable } from "@/lib/db";
import type { Sentence, Category } from "@/lib/types";
import {
  PageHeader,
  Button,
  Field,
  TextInput,
  Select,
  Card,
} from "@/components/ui";
import { ImageUpload } from "@/components/ImageUpload";
import Link from "next/link";

type Draft = Partial<Sentence> & { tokensText?: string };

export default function SentencesPage() {
  const { rows: categories } = useTable<Category>("categories");
  const { rows, loading, error, save, remove } =
    useTable<Sentence>("sentences");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // カテゴリー連動プルダウン用（名前で保持している値から階層をたどる）
  const largeCats = categories.filter((c) => c.level === 1);
  const selLargeCat = largeCats.find((c) => c.name === draft?.category_large);
  const mediumCats = categories.filter(
    (c) => c.level === 2 && c.parent_id === selLargeCat?.id,
  );
  const selMediumCat = mediumCats.find(
    (c) => c.name === draft?.category_medium,
  );
  const smallCats = categories.filter(
    (c) => c.level === 3 && c.parent_id === selMediumCat?.id,
  );

  const catLabel = (s: Sentence) =>
    [s.category_large, s.category_medium, s.category_small]
      .filter(Boolean)
      .join(" › ") || "—";

  function startEdit(s: Sentence) {
    const meanings =
      s.meanings && s.meanings.length
        ? s.meanings
        : s.meaning_ja
          ? [s.meaning_ja]
          : [""];
    setDraft({ ...s, tokensText: s.tokens.join(" "), meanings });
  }

  // 意味の行編集
  const meanings = draft?.meanings ?? [""];
  const setMeanings = (next: string[]) =>
    setDraft((d) => (d ? { ...d, meanings: next } : d));
  const addMeaning = () => setMeanings([...meanings, ""]);
  const updateMeaning = (i: number, v: string) =>
    setMeanings(meanings.map((m, k) => (k === i ? v : m)));
  const removeMeaning = (i: number) =>
    setMeanings(meanings.filter((_, k) => k !== i));

  async function submit() {
    const cleanMeanings = (draft?.meanings ?? [])
      .map((m) => m.trim())
      .filter(Boolean);
    if (!draft?.korean || cleanMeanings.length === 0) {
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
      korean: draft.korean,
      meaning_ja: cleanMeanings[0],
      meanings: cleanMeanings,
      tokens,
      level: Number(draft.level ?? 1),
      image: draft.image || null,
      image_source: draft.image_source || null,
      reference_url: draft.reference_url || null,
      category_large: draft.category_large || null,
      category_medium: draft.category_medium || null,
      category_small: draft.category_small || null,
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
          <Button onClick={() => setDraft({ level: 1, meanings: [""] })}>
            ＋ 新規追加
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
            className="my-8 w-full max-w-4xl [&>div]:border [&_input]:border [&_select]:border [&_textarea]:border"
            onClick={(e) => e.stopPropagation()}
          >
            <Card>
              <h2 className="mb-4 text-lg font-bold tracking-tight text-zinc-900">
                {draft.id ? "文章を編集" : "文章を新規追加"}
              </h2>
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="w-56 shrink-0 self-start">
                  <Field label="画像（挿絵・任意）">
                    <ImageUpload
                      value={draft.image}
                      onChange={(url) => setDraft({ ...draft, image: url })}
                      folder="sentences"
                      source={draft.image_source}
                      onSourceChange={(v) =>
                        setDraft({ ...draft, image_source: v })
                      }
                    />
                  </Field>
                </div>
                <div className="grid flex-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
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
                <div className="sm:col-span-2">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      意味（日本語）
                    </span>
                    <Button variant="ghost" onClick={addMeaning}>
                      ＋ 意味を追加
                    </Button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {meanings.map((m, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <TextInput
                          value={m}
                          onChange={(e) => updateMeaning(i, e.target.value)}
                          placeholder={
                            i === 0 ? "私は学校に行きます" : "別の意味・訳"
                          }
                          className="min-w-0 flex-1"
                        />
                        {meanings.length > 1 && (
                          <Button
                            variant="danger"
                            onClick={() => removeMeaning(i)}
                          >
                            削除
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="sm:col-span-2">
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
              </div>
              {largeCats.length === 0 && (
                <p className="mt-4 text-xs text-zinc-400">
                  カテゴリーが未登録です。
                  <Link
                    href="/categories"
                    className="font-bold text-zinc-900 underline"
                  >
                    カテゴリー管理
                  </Link>
                  で大 › 中 › 小を登録すると選べます。
                </p>
              )}
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Field label="大カテゴリー（任意）">
                  <Select
                    value={draft.category_large ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        category_large: e.target.value || null,
                        category_medium: null,
                        category_small: null,
                      })
                    }
                  >
                    <option value="">（未設定）</option>
                    {largeCats.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="中カテゴリー（任意）">
                  <Select
                    value={draft.category_medium ?? ""}
                    disabled={!selLargeCat}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        category_medium: e.target.value || null,
                        category_small: null,
                      })
                    }
                  >
                    <option value="">
                      {selLargeCat ? "（未設定）" : "先に大を選択"}
                    </option>
                    {mediumCats.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="小カテゴリー（任意）">
                  <Select
                    value={draft.category_small ?? ""}
                    disabled={!selMediumCat}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        category_small: e.target.value || null,
                      })
                    }
                  >
                    <option value="">
                      {selMediumCat ? "（未設定）" : "先に中を選択"}
                    </option>
                    {smallCats.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="mt-4">
                <Field label="参考資料URL（管理用・ユーザー非表示）">
                  <TextInput
                    value={draft.reference_url ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, reference_url: e.target.value })
                    }
                    placeholder="https://… 参考にした資料・辞書など"
                  />
                </Field>
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
        <p className="text-zinc-400">読み込み中…</p>
      ) : rows.length === 0 ? (
        <Card>
          <p className="py-6 text-center text-zinc-400">文章がありません。</p>
        </Card>
      ) : (
        <div className="divide-y divide-zinc-100 border border-zinc-200 bg-white">
          {rows.map((s) => (
            <div key={s.id} className="flex items-center gap-4 p-4">
              {/* 画像（挿絵） */}
              {s.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={s.image}
                  alt=""
                  className="h-16 w-24 shrink-0 border border-zinc-200 object-cover"
                />
              ) : (
                <div className="flex h-16 w-24 shrink-0 items-center justify-center border border-dashed border-zinc-200 text-xs text-zinc-300">
                  画像なし
                </div>
              )}

              {/* 画像＋文章／画像＋日本語 */}
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-zinc-900">{s.korean}</p>
                <p className="mt-0.5 truncate text-sm text-zinc-500">
                  {s.meanings && s.meanings.length
                    ? s.meanings.join(" / ")
                    : s.meaning_ja}
                </p>
                <p className="mt-1 text-xs text-zinc-400">{catLabel(s)}</p>
              </div>

              {/* 操作 */}
              <div className="flex shrink-0 gap-2">
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
