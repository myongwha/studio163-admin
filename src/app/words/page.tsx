"use client";

import { useState } from "react";
import Link from "next/link";
import { useTable } from "@/lib/db";
import { getSupabase } from "@/lib/supabase";
import type {
  Word,
  Category,
  Difficulty,
  ConjugationType,
  ConjugationVariation,
} from "@/lib/types";
import {
  PageHeader,
  Button,
  Field,
  TextInput,
  Select,
  Card,
} from "@/components/ui";
import { ImageUpload } from "@/components/ImageUpload";
import { WordSuggest } from "@/components/WordSuggest";

type Draft = Partial<Word>;

export default function WordsPage() {
  const { rows: categories } = useTable<Category>("categories");
  const { rows, loading, error, save, remove, refresh } =
    useTable<Word>("words");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const visible = rows;

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

  // 対義語・類義語サジェスト候補（自分以外の登録済み単語）
  const suggestWords = rows
    .filter((w) => w.id !== draft?.id)
    .map((w) => ({ korean: w.korean, meaning_ja: w.meaning_ja }));

  // 対義語・類義語（複数）。既存データは単数フィールドを先頭として表示
  const antonyms =
    draft?.antonyms && draft.antonyms.length
      ? draft.antonyms
      : draft?.antonym
        ? [draft.antonym]
        : [""];
  const synonyms =
    draft?.synonyms && draft.synonyms.length
      ? draft.synonyms
      : draft?.synonym
        ? [draft.synonym]
        : [""];
  const setAntonyms = (n: string[]) =>
    setDraft((d) => (d ? { ...d, antonyms: n } : d));
  const setSynonyms = (n: string[]) =>
    setDraft((d) => (d ? { ...d, synonyms: n } : d));

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

  const CONJ_TYPES: { value: ConjugationType; label: string }[] = [
    { value: "平叙文", label: "平叙文（事実を述べたり、考えを伝えたりする文。）" },
    { value: "疑問文", label: "疑問文（相手に質問したり、答えを求めたりする文。）" },
    { value: "命令文", label: "命令文（相手に行動を促したり、要求したりする文。）" },
    { value: "感嘆文", label: "感嘆文（感動や驚き、感情を表す文。）" },
  ];

  const addConjugation = () =>
    setDraft((d) =>
      d
        ? {
            ...d,
            conjugations: [
              ...(d.conjugations ?? []),
              { type: "平叙文", korean: "", meaning_ja: "" },
            ],
          }
        : d,
    );
  const updateConjugation = (i: number, patch: Partial<ConjugationVariation>) =>
    setDraft((d) =>
      d
        ? {
            ...d,
            conjugations: (d.conjugations ?? []).map((c, k) =>
              k === i ? { ...c, ...patch } : c,
            ),
          }
        : d,
    );
  const removeConjugation = (i: number) =>
    setDraft((d) =>
      d
        ? {
            ...d,
            conjugations: (d.conjugations ?? []).filter((_, k) => k !== i),
          }
        : d,
    );

  // 単語の対義語リストを取得（配列 or 旧単数フィールド）
  const antList = (w: {
    antonyms?: string[] | null;
    antonym?: string | null;
  }) =>
    (w.antonyms && w.antonyms.length ? w.antonyms : w.antonym ? [w.antonym] : [])
      .map((x) => x.trim())
      .filter(Boolean);

  // 対義語を双方向に紐づける（相手側の対義語リストにも自分を追加／解除）
  async function syncAntonym(newList: string[]) {
    const sb = getSupabase();
    if (!sb || !draft) return;
    const myKorean = (draft.korean ?? "").trim();
    if (!myKorean) return;
    const original = draft.id ? rows.find((w) => w.id === draft.id) : null;
    const oldList = original ? antList(original) : [];
    const added = newList.filter((a) => !oldList.includes(a));
    const removed = oldList.filter((a) => !newList.includes(a));

    for (const a of added) {
      const mate = rows.find((w) => w.korean === a && w.id !== draft.id);
      if (!mate) continue;
      const list = antList(mate);
      if (!list.includes(myKorean)) {
        const up = [...list, myKorean];
        await sb
          .from("words")
          .update({ antonyms: up, antonym: up[0] })
          .eq("id", mate.id);
      }
    }
    for (const a of removed) {
      const mate = rows.find((w) => w.korean === a);
      if (!mate) continue;
      const list = antList(mate);
      if (list.includes(myKorean)) {
        const up = list.filter((x) => x !== myKorean);
        await sb
          .from("words")
          .update({ antonyms: up, antonym: up[0] ?? null })
          .eq("id", mate.id);
      }
    }
  }

  // 意味の行編集（複数の意味に対応。既存データは meaning_ja を先頭として表示）
  const meanings =
    draft?.meanings && draft.meanings.length
      ? draft.meanings
      : draft?.meaning_ja
        ? [draft.meaning_ja]
        : [""];
  const setMeanings = (next: string[]) =>
    setDraft((d) => (d ? { ...d, meanings: next } : d));
  const addMeaning = () => setMeanings([...meanings, ""]);
  const updateMeaning = (i: number, v: string) =>
    setMeanings(meanings.map((m, k) => (k === i ? v : m)));
  const removeMeaning = (i: number) =>
    setMeanings(meanings.filter((_, k) => k !== i));

  async function submit() {
    const cleanMeanings = meanings.map((m) => m.trim()).filter(Boolean);
    if (!draft?.korean || cleanMeanings.length === 0) {
      setFormError("韓国語と意味は必須です");
      return;
    }
    const cleanAntonyms = antonyms.map((a) => a.trim()).filter(Boolean);
    const cleanSynonyms = synonyms.map((s) => s.trim()).filter(Boolean);
    setSaving(true);
    setFormError("");
    const { error } = await save({
      id: draft.id,
      korean: draft.korean,
      reading: draft.reading ?? "",
      meaning_ja: cleanMeanings[0],
      meanings: cleanMeanings,
      example: draft.example ?? null,
      example_ja: draft.example_ja || null,
      level: Number(draft.level ?? 1),
      category_large: draft.category_large || null,
      category_medium: draft.category_medium || null,
      category_small: draft.category_small || null,
      difficulty: draft.difficulty || null,
      antonym: cleanAntonyms[0] ?? null,
      antonyms: cleanAntonyms,
      synonym: cleanSynonyms[0] ?? null,
      synonyms: cleanSynonyms,
      is_noun: !!draft.is_noun,
      is_adjective: !!draft.is_adjective,
      is_verb: !!draft.is_verb,
      is_base_form: !!draft.is_base_form,
      conjugations: (draft.conjugations ?? []).filter(
        (c) => c.korean.trim() || c.meaning_ja.trim(),
      ),
      image: draft.image || null,
      image_source: draft.image_source || null,
      reference_url: draft.reference_url || null,
    });
    if (error) {
      setSaving(false);
      setFormError(error);
      return;
    }
    await syncAntonym(cleanAntonyms);
    await refresh();
    setSaving(false);
    setDraft(null);
  }

  return (
    <div>
      <PageHeader
        title="単語"
        subtitle="カテゴリー・品詞で分類して単語を登録します"
        action={
          <div className="flex flex-wrap justify-end gap-2">
            {selected.length > 0 && (
              <Button variant="danger" onClick={deleteSelected}>
                選択削除（{selected.length}）
              </Button>
            )}
            <Button onClick={() => setDraft({ level: 1, meanings: [""] })}>
              ＋ 新規追加
            </Button>
          </div>
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
                {draft.id ? "単語を編集" : "単語を新規追加"}
              </h2>
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="w-56 shrink-0 self-start">
                <Field label="画像（挿絵・任意）">
                  <ImageUpload
                    value={draft.image}
                    onChange={(url) => setDraft({ ...draft, image: url })}
                    folder="words"
                    source={draft.image_source}
                    onSourceChange={(v) =>
                      setDraft({ ...draft, image_source: v })
                    }
                  />
                </Field>
              </div>
              <div className="grid flex-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-wrap items-end gap-x-4 gap-y-2 sm:col-span-2">
                  <div className="min-w-[12rem] flex-1">
                    <Field label="韓国語">
                      <TextInput
                        value={draft.korean ?? ""}
                        onChange={(e) =>
                          setDraft({ ...draft, korean: e.target.value })
                        }
                        placeholder="안녕하세요"
                      />
                    </Field>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pb-2">
                    <label className="flex cursor-pointer items-center gap-1.5 text-sm font-medium text-zinc-800">
                      <input
                        type="checkbox"
                        checked={!!draft.is_noun}
                        onChange={(e) =>
                          setDraft({ ...draft, is_noun: e.target.checked })
                        }
                        className="h-4 w-4 accent-zinc-900"
                      />
                      名詞
                    </label>
                    <label className="flex cursor-pointer items-center gap-1.5 text-sm font-medium text-zinc-800">
                      <input
                        type="checkbox"
                        checked={!!draft.is_adjective}
                        onChange={(e) =>
                          setDraft({ ...draft, is_adjective: e.target.checked })
                        }
                        className="h-4 w-4 accent-zinc-900"
                      />
                      形容詞
                    </label>
                    <label className="flex cursor-pointer items-center gap-1.5 text-sm font-medium text-zinc-800">
                      <input
                        type="checkbox"
                        checked={!!draft.is_verb}
                        onChange={(e) =>
                          setDraft({ ...draft, is_verb: e.target.checked })
                        }
                        className="h-4 w-4 accent-zinc-900"
                      />
                      動詞
                    </label>
                    <label className="flex cursor-pointer items-center gap-1.5 text-sm font-medium text-zinc-800">
                      <input
                        type="checkbox"
                        checked={!!draft.is_base_form}
                        onChange={(e) =>
                          setDraft({ ...draft, is_base_form: e.target.checked })
                        }
                        className="h-4 w-4 accent-zinc-900"
                      />
                      原形
                    </label>
                  </div>
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
                          placeholder={i === 0 ? "こんにちは" : "別の意味"}
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
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {largeCats.length === 0 && (
                <p className="md:col-span-2 text-xs text-zinc-400">
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
              <div className="grid gap-4 md:col-span-2 md:grid-cols-3">
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
              <div className="grid gap-4 md:col-span-2 md:grid-cols-2">
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      対義語（任意・相手側にも自動登録）
                    </span>
                    <Button
                      variant="ghost"
                      onClick={() => setAntonyms([...antonyms, ""])}
                    >
                      ＋ 追加
                    </Button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {antonyms.map((a, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <WordSuggest
                            value={a}
                            onChange={(v) =>
                              setAntonyms(
                                antonyms.map((x, k) => (k === i ? v : x)),
                              )
                            }
                            options={suggestWords}
                            placeholder="작다"
                          />
                        </div>
                        {antonyms.length > 1 && (
                          <Button
                            variant="danger"
                            onClick={() =>
                              setAntonyms(antonyms.filter((_, k) => k !== i))
                            }
                          >
                            削除
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      類義語（任意）
                    </span>
                    <Button
                      variant="ghost"
                      onClick={() => setSynonyms([...synonyms, ""])}
                    >
                      ＋ 追加
                    </Button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {synonyms.map((s, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <WordSuggest
                            value={s}
                            onChange={(v) =>
                              setSynonyms(
                                synonyms.map((x, k) => (k === i ? v : x)),
                              )
                            }
                            options={suggestWords}
                            placeholder="거대하다"
                          />
                        </div>
                        {synonyms.length > 1 && (
                          <Button
                            variant="danger"
                            onClick={() =>
                              setSynonyms(synonyms.filter((_, k) => k !== i))
                            }
                          >
                            削除
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="md:col-span-2">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-500">
                    活用形（任意・韓国語：日本語）
                  </span>
                  <Button variant="ghost" onClick={addConjugation}>
                    ＋ 追加
                  </Button>
                </div>
                <div className="flex flex-col gap-2">
                  {(draft.conjugations ?? []).length === 0 && (
                    <p className="text-xs text-zinc-400">
                      「＋ 追加」で平叙文・否定文・疑問文などのバリエーションを登録できます。
                    </p>
                  )}
                  {(draft.conjugations ?? []).map((c, i) => (
                    <div
                      key={i}
                      className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-2"
                    >
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <Select
                            value={c.type}
                            onChange={(e) =>
                              updateConjugation(i, {
                                type: e.target.value as ConjugationType,
                              })
                            }
                          >
                            {CONJ_TYPES.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <Button
                          variant="danger"
                          onClick={() => removeConjugation(i)}
                        >
                          削除
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <TextInput
                          value={c.korean}
                          onChange={(e) =>
                            updateConjugation(i, { korean: e.target.value })
                          }
                          placeholder="가요"
                          className="min-w-0 flex-1"
                        />
                        <span className="shrink-0 text-zinc-400">：</span>
                        <TextInput
                          value={c.meaning_ja}
                          onChange={(e) =>
                            updateConjugation(i, { meaning_ja: e.target.value })
                          }
                          placeholder="行きます"
                          className="min-w-0 flex-1"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2 grid gap-4 md:grid-cols-2">
                <Field label="例文（韓国語・任意）">
                  <TextInput
                    value={draft.example ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, example: e.target.value })
                    }
                    placeholder="안녕하세요, 만나서 반갑습니다."
                  />
                </Field>
                <Field label="例文（日本語・任意）">
                  <TextInput
                    value={draft.example_ja ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, example_ja: e.target.value })
                    }
                    placeholder="こんにちは、お会いできて嬉しいです。"
                  />
                </Field>
              </div>
              <div className="md:col-span-2">
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
      ) : (
        <Card>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">
                <th className="py-2">韓国語</th>
                <th>意味</th>
                <th className="text-center">Lv</th>
                <th>カテゴリー</th>
                <th className="text-center">難易度</th>
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
                <tr key={w.id} className="border-b border-zinc-100">
                  <td className="py-2 font-bold text-zinc-700">{w.korean}</td>
                  <td className="text-zinc-500">
                    {w.meanings && w.meanings.length
                      ? w.meanings.join(" / ")
                      : w.meaning_ja}
                  </td>
                  <td className="text-center text-zinc-400">{w.level}</td>
                  <td className="text-zinc-400">
                    {[w.category_large, w.category_medium, w.category_small]
                      .filter(Boolean)
                      .join(" › ") || "—"}
                  </td>
                  <td className="text-center text-zinc-400">
                    {w.difficulty ?? "—"}
                  </td>
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
                  <td colSpan={7} className="py-6 text-center text-zinc-400">
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
