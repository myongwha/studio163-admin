"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import type { Song, SongLine, SongLineQuizType } from "@/lib/types";
import {
  PageHeader,
  Button,
  Field,
  TextInput,
  Select,
  Card,
} from "@/components/ui";

interface LineDraft {
  id?: string;
  start_sec: number;
  end_sec: number;
  korean_text: string;
  meaning_ja: string;
  hasQuiz: boolean;
  quizType: SongLineQuizType;
  question: string;
  options: string[];
  answer: string;
}

const emptyDraft = (): LineDraft => ({
  start_sec: 0,
  end_sec: 0,
  korean_text: "",
  meaning_ja: "",
  hasQuiz: false,
  quizType: "meaning",
  question: "",
  options: ["", "", "", ""],
  answer: "",
});

export default function SongLinesPage() {
  const params = useParams<{ id: string }>();
  const [song, setSong] = useState<Song | null>(null);
  const [lines, setLines] = useState<SongLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<LineDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return;
    setLoading(true);
    const { data: songData } = await sb
      .from("songs")
      .select("*")
      .eq("id", params.id)
      .single();
    const { data: lineData } = await sb
      .from("song_lines")
      .select("*")
      .eq("song_id", params.id)
      .order("start_sec", { ascending: true });
    setSong((songData as Song) ?? null);
    setLines((lineData as SongLine[]) ?? []);
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(line: SongLine) {
    setDraft({
      id: line.id,
      start_sec: line.start_sec,
      end_sec: line.end_sec,
      korean_text: line.korean_text,
      meaning_ja: line.meaning_ja,
      hasQuiz: !!line.quiz,
      quizType: line.quiz?.type ?? "meaning",
      question: line.quiz?.question ?? "",
      options: [
        ...(line.quiz?.options ?? []),
        "",
        "",
        "",
        "",
      ].slice(0, 4),
      answer: line.quiz?.answer ?? "",
    });
  }

  async function submit() {
    if (!draft) return;
    if (!draft.korean_text) {
      setFormError("歌詞テキストは必須です");
      return;
    }
    const options = draft.options.map((o) => o.trim()).filter(Boolean);
    if (draft.hasQuiz) {
      if (!draft.question || options.length < 2 || !draft.answer) {
        setFormError("クイズには問題文・2つ以上の選択肢・正解が必要です");
        return;
      }
      if (!options.includes(draft.answer)) {
        setFormError("正解は選択肢の中から選んでください");
        return;
      }
    }

    const sb = getSupabase();
    if (!sb) return;
    setSaving(true);
    setFormError("");

    const row = {
      song_id: params.id,
      start_sec: Number(draft.start_sec),
      end_sec: Number(draft.end_sec),
      korean_text: draft.korean_text,
      meaning_ja: draft.meaning_ja,
      quiz: draft.hasQuiz
        ? {
            type: draft.quizType,
            question: draft.question,
            options,
            answer: draft.answer,
          }
        : null,
    };

    const { error } = draft.id
      ? await sb.from("song_lines").update(row).eq("id", draft.id)
      : await sb.from("song_lines").insert(row);

    setSaving(false);
    if (error) setFormError(error.message);
    else {
      setDraft(null);
      load();
    }
  }

  async function removeLine(id: string) {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from("song_lines").delete().eq("id", id);
    load();
  }

  if (loading) return <p className="text-slate-400">読み込み中…</p>;
  if (!song)
    return (
      <div>
        <p className="text-sm text-zinc-400">曲が見つかりません。</p>
        <Link href="/songs" className="text-sm font-medium text-zinc-900">
          ← 楽曲一覧
        </Link>
      </div>
    );

  return (
    <div>
      <Link
        href="/songs"
        className="text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900"
      >
        ← 楽曲一覧
      </Link>
      <PageHeader
        title={song.title}
        subtitle={`${song.artist} ・ 歌詞行とクイズの管理`}
        action={
          <Button onClick={() => setDraft(emptyDraft())}>＋ 歌詞行を追加</Button>
        }
      />

      {draft && (
        <div className="mb-6">
          <Card>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="開始秒">
                <TextInput
                  type="number"
                  step="0.1"
                  value={draft.start_sec}
                  onChange={(e) =>
                    setDraft({ ...draft, start_sec: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="終了秒">
                <TextInput
                  type="number"
                  step="0.1"
                  value={draft.end_sec}
                  onChange={(e) =>
                    setDraft({ ...draft, end_sec: Number(e.target.value) })
                  }
                />
              </Field>
              <div className="md:col-span-2">
                <Field label="歌詞（韓国語）">
                  <TextInput
                    value={draft.korean_text}
                    onChange={(e) =>
                      setDraft({ ...draft, korean_text: e.target.value })
                    }
                    placeholder="오빤 강남스타일"
                  />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="意味（日本語）">
                  <TextInput
                    value={draft.meaning_ja}
                    onChange={(e) =>
                      setDraft({ ...draft, meaning_ja: e.target.value })
                    }
                  />
                </Field>
              </div>
            </div>

            <label className="mt-4 flex items-center gap-2 text-sm font-bold text-slate-600">
              <input
                type="checkbox"
                checked={draft.hasQuiz}
                onChange={(e) =>
                  setDraft({ ...draft, hasQuiz: e.target.checked })
                }
              />
              この行でクイズを出題する
            </label>

            {draft.hasQuiz && (
              <div className="mt-4 grid gap-4 rounded-xl bg-slate-50 p-4">
                <Field label="クイズ形式">
                  <Select
                    value={draft.quizType}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        quizType: e.target.value as SongLineQuizType,
                      })
                    }
                  >
                    <option value="meaning">意味を選ぶ</option>
                    <option value="blank">穴埋め</option>
                  </Select>
                </Field>
                <Field label="問題文（穴埋めは ___ を入れる）">
                  <TextInput
                    value={draft.question}
                    onChange={(e) =>
                      setDraft({ ...draft, question: e.target.value })
                    }
                    placeholder="「강남스타일」の意味は？"
                  />
                </Field>
                <div className="grid gap-2 md:grid-cols-2">
                  {draft.options.map((opt, i) => (
                    <Field key={i} label={`選択肢 ${i + 1}`}>
                      <TextInput
                        value={opt}
                        onChange={(e) => {
                          const options = [...draft.options];
                          options[i] = e.target.value;
                          setDraft({ ...draft, options });
                        }}
                      />
                    </Field>
                  ))}
                </div>
                <Field label="正解（選択肢から選ぶ）">
                  <Select
                    value={draft.answer}
                    onChange={(e) =>
                      setDraft({ ...draft, answer: e.target.value })
                    }
                  >
                    <option value="">（選択してください）</option>
                    {draft.options
                      .map((o) => o.trim())
                      .filter(Boolean)
                      .map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                  </Select>
                </Field>
              </div>
            )}

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

      <Card>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-slate-400">
              <th className="py-2">時間</th>
              <th>歌詞</th>
              <th>意味</th>
              <th>クイズ</th>
              <th className="text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-b border-slate-50">
                <td className="py-2 text-slate-400">
                  {l.start_sec}–{l.end_sec}s
                </td>
                <td className="font-medium text-zinc-800">{l.korean_text}</td>
                <td className="text-zinc-500">{l.meaning_ja}</td>
                <td>
                  {l.quiz ? (
                    <span className="rounded-full border border-zinc-300 px-2 py-0.5 text-xs font-medium text-zinc-700">
                      {l.quiz.type === "blank" ? "穴埋め" : "意味"}
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => startEdit(l)}>
                      編集
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => {
                        if (confirm("この歌詞行を削除しますか？"))
                          removeLine(l.id);
                      }}
                    >
                      削除
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-400">
                  歌詞行がありません。「歌詞行を追加」から作成してください。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
