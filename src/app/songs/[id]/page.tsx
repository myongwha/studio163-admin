"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import YouTube, { type YouTubePlayer } from "react-youtube";
import { extractYoutubeId } from "@/lib/youtube";
import { getSupabase } from "@/lib/supabase";
import type { Song, SongLine, SongLineQuiz } from "@/lib/types";
import { Button, Field, TextInput, Card, TextArea } from "@/components/ui";
import { formatTime, parseTime } from "@/lib/time";
import { parseQuizNotation } from "@/lib/quizNotation";
import {
  QuizAuthoring,
  AuthorOption,
  emptyQuizAuthoring,
  blankNumbers,
  buildQuizzes,
  reconstructAuthoring,
  QUIZ_INSTRUCTION,
} from "@/lib/quizAuthoring";

interface LineDraft {
  id?: string;
  startText: string; // 秒（小数）表記
  endText: string;
  korean_text: string;
  meaning_ja: string;
  isInterlude: boolean;
  quizEnabled: boolean;
  authoring: QuizAuthoring;
  explanation: string;
  natural_ja: string;
}

const emptyDraft = (): LineDraft => ({
  startText: "",
  endText: "",
  korean_text: "",
  meaning_ja: "",
  isInterlude: false,
  quizEnabled: false,
  authoring: emptyQuizAuthoring(),
  explanation: "",
  natural_ja: "",
});

export default function SongLinesPage() {
  const params = useParams<{ id: string }>();
  const [song, setSong] = useState<Song | null>(null);
  const [lines, setLines] = useState<SongLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<LineDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteSaving, setPasteSaving] = useState(false);
  const [pasteError, setPasteError] = useState("");
  const [notationOpen, setNotationOpen] = useState(false);
  const [notationText, setNotationText] = useState("");
  const [notationSaving, setNotationSaving] = useState(false);
  const [notationError, setNotationError] = useState("");
  const [inlineId, setInlineId] = useState<string | null>(null);
  const [inlineStart, setInlineStart] = useState("");
  const [inlineEnd, setInlineEnd] = useState("");
  const [inlineError, setInlineError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [ctx, setCtx] = useState<{
    x: number;
    y: number;
    field: "kr" | "ja";
    start: number;
    end: number;
  } | null>(null);

  // 編集用 YouTube プレイヤー
  const playerRef = useRef<YouTubePlayer | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [now, setNow] = useState(0);
  const [playing, setPlaying] = useState(false);

  function togglePlay() {
    const p = playerRef.current;
    if (!p) return;
    if (playing) p.pauseVideo();
    else p.playVideo();
  }

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const p = playerRef.current;
      if (!p) return;
      const t: number = await p.getCurrentTime();
      setNow(t);
    }, 200);
  }

  // 現在の再生秒（小数2桁）
  const nowText = now.toFixed(2);

  function copyNow() {
    navigator.clipboard?.writeText(nowText).catch(() => {});
  }

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
      .order("start_sec", { ascending: true })
      .order("created_at", { ascending: true });
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
      startText: formatTime(line.start_sec),
      endText: formatTime(line.end_sec),
      korean_text: line.korean_text,
      meaning_ja: line.meaning_ja,
      isInterlude: line.is_interlude ?? false,
      quizEnabled:
        !!line.quiz_authoring ||
        !!(line.quizzes && line.quizzes.length) ||
        !!line.quiz,
      authoring: line.quiz_authoring
        ? { ...line.quiz_authoring, questionTextJa: line.quiz_authoring.questionTextJa ?? "" }
        : reconstructAuthoring(
            line.quizzes && line.quizzes.length
              ? line.quizzes
              : line.quiz
                ? [line.quiz]
                : [],
          ),
      explanation: line.explanation ?? "",
      natural_ja: line.natural_ja ?? "",
    });
  }

  function setQuizType(t: "meaning" | "blank") {
    if (!draft) return;
    setDraft({ ...draft, authoring: { ...draft.authoring, type: t } });
  }

  function setQuestionText(v: string) {
    if (!draft) return;
    setDraft({ ...draft, authoring: { ...draft.authoring, questionText: v } });
  }

  function setQuestionTextJa(v: string) {
    if (!draft) return;
    setDraft({ ...draft, authoring: { ...draft.authoring, questionTextJa: v } });
  }

  // 問題文の選択範囲を右クリックで #N<...> 空欄化
  function onQuestionContextMenu(
    e: React.MouseEvent<HTMLTextAreaElement>,
    field: "kr" | "ja",
  ) {
    const ta = e.currentTarget;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start === end) return; // 未選択なら通常メニュー
    e.preventDefault();
    setCtx({ x: e.clientX, y: e.clientY, field, start, end });
  }

  function applyBlank() {
    if (!ctx || !draft) return;
    const text =
      ctx.field === "kr"
        ? draft.authoring.questionText
        : draft.authoring.questionTextJa ?? "";
    const sel = text.slice(ctx.start, ctx.end);
    const existing = [
      ...blankNumbers(draft.authoring.questionText),
      ...blankNumbers(draft.authoring.questionTextJa ?? ""),
    ];
    const n = (existing.length ? Math.max(...existing) : 0) + 1;
    const wrapped =
      text.slice(0, ctx.start) + `#${n}<${sel}>` + text.slice(ctx.end);
    if (ctx.field === "kr") setQuestionText(wrapped);
    else setQuestionTextJa(wrapped);
    setCtx(null);
  }

  function addPoolOption() {
    if (!draft) return;
    setDraft({
      ...draft,
      authoring: {
        ...draft.authoring,
        options: [...draft.authoring.options, { text: "", blank: null }],
      },
    });
  }

  function removePoolOption(i: number) {
    if (!draft) return;
    setDraft({
      ...draft,
      authoring: {
        ...draft.authoring,
        options: draft.authoring.options.filter((_, k) => k !== i),
      },
    });
  }

  function updatePoolOption(i: number, patch: Partial<AuthorOption>) {
    if (!draft) return;
    setDraft({
      ...draft,
      authoring: {
        ...draft.authoring,
        options: draft.authoring.options.map((o, k) =>
          k === i ? { ...o, ...patch } : o,
        ),
      },
    });
  }

  async function submit() {
    if (!draft) return;
    const startSec = parseTime(draft.startText);
    const endSec = parseTime(draft.endText);
    if (Number.isNaN(startSec) || Number.isNaN(endSec)) {
      setFormError("時間は秒で入力してください（小数可・例 12.34）");
      return;
    }
    if (endSec <= startSec) {
      setFormError("終了は開始より後にしてください");
      return;
    }

    let korean_text = "";
    let builtQuizzes: SongLineQuiz[] | null = null;
    let quizAuthoring: QuizAuthoring | null = null;
    if (draft.isInterlude) {
      korean_text = "";
    } else {
      korean_text = draft.korean_text.trim();
      if (!korean_text) {
        setFormError("歌詞（韓国語）を入力してください");
        return;
      }
      if (draft.quizEnabled) {
        const built = buildQuizzes(draft.authoring);
        if (built.error) {
          setFormError(built.error);
          return;
        }
        builtQuizzes = built.quizzes.length ? built.quizzes : null;
        quizAuthoring = built.quizzes.length ? draft.authoring : null;
      }
    }

    const sb = getSupabase();
    if (!sb) return;
    setSaving(true);
    setFormError("");

    const row = {
      song_id: params.id,
      start_sec: startSec,
      end_sec: endSec,
      korean_text,
      meaning_ja: draft.meaning_ja,
      explanation: draft.explanation || null,
      natural_ja: draft.natural_ja || null,
      is_interlude: draft.isInterlude,
      quiz: null,
      quizzes: builtQuizzes,
      quiz_authoring: quizAuthoring,
    };

    const nextOrder = lines.length
      ? Math.max(...lines.map((l) => l.order_index ?? 0)) + 1
      : 0;
    const { error } = draft.id
      ? await sb.from("song_lines").update(row).eq("id", draft.id)
      : await sb.from("song_lines").insert({ ...row, order_index: nextOrder });

    setSaving(false);
    if (error) setFormError(error.message);
    else {
      setDraft(null);
      load();
    }
  }

  // 複数選択して一括削除
  function toggleSelect(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleSelectAll() {
    setSelected((prev) =>
      prev.length === lines.length ? [] : lines.map((l) => l.id),
    );
  }

  async function deleteSelected() {
    if (selected.length === 0) return;
    if (!confirm(`選択した ${selected.length} 行を削除しますか？`)) return;
    const sb = getSupabase();
    if (!sb) return;
    await sb.from("song_lines").delete().in("id", selected);
    setSelected([]);
    load();
  }

  async function removeLine(id: string) {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from("song_lines").delete().eq("id", id);
    setSelected((prev) => prev.filter((x) => x !== id));
    load();
  }

  function startInline(line: SongLine) {
    setInlineId(line.id);
    setInlineStart(formatTime(line.start_sec));
    setInlineEnd(formatTime(line.end_sec));
    setInlineError("");
  }

  function cancelInline() {
    setInlineId(null);
    setInlineError("");
  }

  async function saveInline(id: string) {
    const s = parseTime(inlineStart);
    const e = parseTime(inlineEnd);
    if (Number.isNaN(s) || Number.isNaN(e)) {
      setInlineError("秒で入力 (例 12.34)");
      return;
    }
    if (e <= s) {
      setInlineError("終了は開始より後に");
      return;
    }
    const sb = getSupabase();
    if (!sb) return;
    const { error } = await sb
      .from("song_lines")
      .update({ start_sec: s, end_sec: e })
      .eq("id", id);
    if (error) {
      setInlineError(error.message);
      return;
    }
    setInlineId(null);
    await load();
  }

  async function bulkRegister() {
    const texts = pasteText
      .split(/\r?\n/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (texts.length === 0) {
      setPasteError("歌詞を入力してください");
      return;
    }
    const sb = getSupabase();
    if (!sb) return;
    setPasteSaving(true);
    setPasteError("");

    const base = lines.length
      ? Math.max(...lines.map((l) => l.order_index ?? 0)) + 1
      : 0;
    const rows = texts.map((text, i) => ({
      song_id: params.id,
      start_sec: 0,
      end_sec: 0,
      korean_text: text,
      meaning_ja: "",
      quiz: null,
      order_index: base + i,
    }));

    const { error } = await sb.from("song_lines").insert(rows);

    setPasteSaving(false);
    if (error) setPasteError(error.message);
    else {
      setPasteText("");
      setPasteOpen(false);
      load();
    }
  }

  async function registerNotation() {
    const parsed = parseQuizNotation(notationText);
    if (parsed.length === 0) {
      setNotationError("登録できる行がありません");
      return;
    }
    const sb = getSupabase();
    if (!sb) return;
    setNotationSaving(true);
    setNotationError("");
    const base = lines.length
      ? Math.max(...lines.map((l) => l.order_index ?? 0)) + 1
      : 0;
    const rows = parsed.map((p, i) => ({
      song_id: params.id,
      start_sec: 0,
      end_sec: 0,
      korean_text: p.korean_text,
      meaning_ja: p.meaning_ja,
      explanation: null,
      is_interlude: false,
      quiz: null,
      quizzes: p.quizzes.length ? p.quizzes : null,
      order_index: base + i,
    }));
    const { error } = await sb.from("song_lines").insert(rows);
    setNotationSaving(false);
    if (error) setNotationError(error.message);
    else {
      setNotationText("");
      setNotationOpen(false);
      load();
    }
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
      <div className="mb-6 mt-2 flex items-start justify-between gap-4">
        <div>
          <span className="inline-block border-2 border-black bg-accent px-2 py-0.5 text-xs font-bold text-black">
            Lv.{song.level}
          </span>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-black">
            {song.title}
            {song.title_ja ? `　${song.title_ja}` : ""}
            <span className="ml-3 text-base font-medium text-zinc-500">
              {song.artist}
            </span>
          </h1>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <Button onClick={() => setDraft(emptyDraft())}>＋ 歌詞行を追加</Button>
          <Button variant="ghost" onClick={() => setPasteOpen(true)}>
            歌詞を貼り付け
          </Button>
          <Button variant="ghost" onClick={() => setNotationOpen(true)}>
            記法で登録
          </Button>
          {selected.length > 0 && (
            <Button variant="danger" onClick={deleteSelected}>
              選択削除（{selected.length}）
            </Button>
          )}
        </div>
      </div>

      {/* 編集用 YouTube プレイヤー（再生しながら秒数・クイズを設定） */}
      <div className="sticky top-0 z-10 mb-5 border-2 border-black bg-white p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="w-full shrink-0 border-2 border-black bg-black sm:w-72">
            <div className="aspect-video">
              <YouTube
                videoId={extractYoutubeId(song.youtube_id)}
                className="h-full w-full"
                iframeClassName="h-full w-full"
                opts={{
                  playerVars: {
                    rel: 0,
                    playsinline: 1,
                    controls: 0, // シークバー無効（再生/停止は下のボタンで）
                    disablekb: 1,
                    modestbranding: 1,
                  },
                }}
                onReady={(e) => {
                  playerRef.current = e.target;
                }}
                onStateChange={(e) => {
                  if (e.data === 1) {
                    startPolling();
                    setPlaying(true);
                  } else {
                    setPlaying(false);
                  }
                }}
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button onClick={togglePlay}>
              {playing ? "⏸ 一時停止" : "▶ 再生"}
            </Button>
            <div>
              <p className="text-xs font-bold text-zinc-500">現在の再生位置</p>
              <p className="text-3xl font-bold tracking-tight text-black">
                {nowText}
                <span className="ml-1 text-sm font-medium">秒</span>
              </p>
            </div>
            <Button variant="ghost" onClick={copyNow}>
              現在秒をコピー
            </Button>
          </div>
        </div>
        <p className="mt-2 text-xs text-zinc-400">
          シークバーは無効です。再生/一時停止ボタンで操作し、各行の時間（クリックで編集）に現在秒を入力できます。
        </p>
      </div>

      {pasteOpen && (
        <div className="mb-6">
          <Card>
            <p className="text-sm font-bold text-zinc-600">
              歌詞を貼り付けると、1行ずつ歌詞行として登録します。時間・意味・クイズは後から各行を編集して設定してください。
            </p>
            <div className="mt-4">
              <Field label="歌詞テキスト">
                <TextArea
                  rows={10}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="韓国語の歌詞を1行ずつ"
                />
              </Field>
            </div>
            {pasteError && (
              <p className="mt-3 text-sm text-rose-600">{pasteError}</p>
            )}
            <div className="mt-4 flex gap-2">
              <Button onClick={bulkRegister} disabled={pasteSaving}>
                {pasteSaving ? "登録中…" : "一括登録"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setPasteOpen(false);
                  setPasteText("");
                  setPasteError("");
                }}
              >
                キャンセル
              </Button>
            </div>
          </Card>
        </div>
      )}

      {notationOpen && (
        <div className="mb-6">
          <Card>
            <p className="text-sm font-bold text-zinc-600">
              記法で書いた歌詞＋クイズをまとめて登録します。1ブロック（空行区切り）が1歌詞行になります。
            </p>
            <pre className="mt-3 whitespace-pre-wrap text-xs text-zinc-500">{`例（1ブロック=1歌詞行 / 空行で区切る）:
#1<살다 보면> 시련은 분명히 있을 거야
生きていれば試練はきっとあるはずだ
1.하고 2.틀려도 3.살다 보면 [#1] 4.생각해

・#N<答え> が空欄（#1 #2… 複数可）
・[#N] を含む行がその空欄の選択肢（先頭の「数字.」は除去、選択肢は1個でも可）
・選択肢行が無い空欄は答えのみの1択
・#N<> が無いブロックはクイズ無しの通常歌詞`}</pre>
            <div className="mt-4">
              <Field label="記法テキスト">
                <TextArea
                  rows={14}
                  value={notationText}
                  onChange={(e) => setNotationText(e.target.value)}
                  placeholder={`#1<살다 보면> 시련은 분명히 있을 거야
生きていれば試練はきっとあるはずだ
1.하고 2.틀려도 3.살다 보면 [#1] 4.생각해`}
                />
              </Field>
            </div>
            {notationError && (
              <p className="mt-3 text-sm text-rose-600">{notationError}</p>
            )}
            <div className="mt-4 flex gap-2">
              <Button onClick={registerNotation} disabled={notationSaving}>
                {notationSaving ? "登録中…" : "登録"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setNotationOpen(false);
                  setNotationText("");
                  setNotationError("");
                }}
              >
                キャンセル
              </Button>
            </div>
          </Card>
        </div>
      )}

      {draft && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-8 w-full max-w-4xl">
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-lg font-bold text-black">歌詞行を編集</p>
              <button
                onClick={() => setDraft(null)}
                aria-label="閉じる"
                className="text-xl font-bold text-zinc-400 hover:text-black"
              >
                ✕
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="開始秒（小数可・例 12.34）">
                <TextInput
                  value={draft.startText}
                  onChange={(e) =>
                    setDraft({ ...draft, startText: e.target.value })
                  }
                  placeholder="12.34"
                />
              </Field>
              <Field label="終了秒（小数可・例 18.50）">
                <TextInput
                  value={draft.endText}
                  onChange={(e) =>
                    setDraft({ ...draft, endText: e.target.value })
                  }
                  placeholder="18.50"
                />
              </Field>
            </div>

            <div className="mt-4">
              <label className="flex items-center gap-2 text-sm font-bold text-black">
                <input
                  type="checkbox"
                  checked={draft.isInterlude}
                  onChange={(e) =>
                    setDraft({ ...draft, isInterlude: e.target.checked })
                  }
                />
                間奏（歌詞なし）
              </label>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="歌詞（韓国語）">
                <TextArea
                  rows={2}
                  value={draft.korean_text}
                  onChange={(e) =>
                    setDraft({ ...draft, korean_text: e.target.value })
                  }
                  disabled={draft.isInterlude}
                  placeholder={draft.isInterlude ? "（間奏：歌詞なし）" : ""}
                />
              </Field>
              <Field label="歌詞（日本語）">
                <TextArea
                  rows={2}
                  value={draft.meaning_ja}
                  onChange={(e) =>
                    setDraft({ ...draft, meaning_ja: e.target.value })
                  }
                />
              </Field>
            </div>

            {!draft.isInterlude && (
              <div className="mt-4">
                <label className="flex items-center gap-2 text-sm font-bold text-black">
                  <input
                    type="checkbox"
                    checked={draft.quizEnabled}
                    onChange={(e) =>
                      setDraft({ ...draft, quizEnabled: e.target.checked })
                    }
                  />
                  クイズを作成
                </label>
              </div>
            )}

            {!draft.isInterlude &&
              draft.quizEnabled &&
              (() => {
                const nums = Array.from(
                  new Set([
                    ...blankNumbers(draft.authoring.questionText),
                    ...blankNumbers(draft.authoring.questionTextJa ?? ""),
                  ]),
                ).sort((a, b) => a - b);
                return (
                  <div className="mt-4 space-y-6 border-2 border-black p-4">
                    {/* ① 問題文 */}
                    <div>
                      <p className="mb-2 text-sm font-bold text-black">
                        ① 問題文
                      </p>
                      <div className="mb-2 flex gap-2">
                        {(
                          [
                            ["meaning", "日本語の意味を選ぶ"],
                            ["blank", "韓国語を選ぶ"],
                          ] as const
                        ).map(([t, label]) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setQuizType(t)}
                            className={`border-2 border-black px-3 py-1.5 text-sm font-bold ${
                              draft.authoring.type === t
                                ? "bg-black text-white"
                                : "bg-white text-black hover:bg-accent"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <p className="mb-2 text-xs text-zinc-500">
                        {QUIZ_INSTRUCTION[draft.authoring.type]}
                      </p>
                      <p className="mb-1 text-xs font-bold text-zinc-600">
                        韓国語
                      </p>
                      <TextArea
                        rows={2}
                        value={draft.authoring.questionText}
                        onChange={(e) => setQuestionText(e.target.value)}
                        onContextMenu={(e) => onQuestionContextMenu(e, "kr")}
                        placeholder="죄송합니다 …（語を選択して右クリックで空欄化）"
                      />
                      <p className="mb-1 mt-3 text-xs font-bold text-zinc-600">
                        日本語（任意・#1&lt;&gt; 対応）
                      </p>
                      <TextArea
                        rows={2}
                        value={draft.authoring.questionTextJa ?? ""}
                        onChange={(e) => setQuestionTextJa(e.target.value)}
                        onContextMenu={(e) => onQuestionContextMenu(e, "ja")}
                        placeholder="申し訳ありません …（語を選択して右クリックで空欄化）"
                      />
                      <p className="mt-1 text-xs text-zinc-500">
                        空欄は #1&lt;元の語&gt; で指定（複数可: #1 #2 …）
                      </p>
                    </div>

                    {/* ② 選択肢 */}
                    <div>
                      <p className="mb-2 text-sm font-bold text-black">
                        ② 選択肢
                      </p>
                      {draft.authoring.options.map((o, i) => (
                        <div key={i} className="mb-2 flex items-center gap-2">
                          <input
                            value={o.text}
                            onChange={(e) =>
                              updatePoolOption(i, { text: e.target.value })
                            }
                            placeholder="語"
                            className="flex-1 border-2 border-black px-2 py-1.5 text-sm"
                          />
                          <select
                            value={o.blank ?? ""}
                            onChange={(e) =>
                              updatePoolOption(i, {
                                blank: e.target.value
                                  ? Number(e.target.value)
                                  : null,
                              })
                            }
                            className="border-2 border-black px-2 py-1.5 text-sm font-bold"
                          >
                            <option value="">未設定</option>
                            {nums.map((n) => (
                              <option key={n} value={n}>
                                #{n}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => removePoolOption(i)}
                            className="border-2 border-black px-2 py-1 text-sm font-bold text-rose-600 hover:bg-rose-50"
                          >
                            削除
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addPoolOption}
                        className="mt-1 border-2 border-black px-3 py-1.5 text-sm font-bold text-black hover:bg-accent"
                      >
                        ＋ 語を追加
                      </button>
                      {nums.length === 0 && (
                        <p className="mt-2 text-xs text-zinc-400">
                          ①で #1&lt;&gt; を入れると、ここで正解語に #1 を付けられます
                        </p>
                      )}
                    </div>

                    {/* ③ 回答 */}
                    <div>
                      <p className="mb-2 text-sm font-bold text-black">
                        ③ 回答
                      </p>
                      <div className="mb-3">
                        <Field label="解説（任意・回答後に表示）">
                          <TextArea
                            rows={2}
                            value={draft.explanation}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                explanation: e.target.value,
                              })
                            }
                          />
                        </Field>
                      </div>
                      <Field label="自然な翻訳（任意）">
                        <TextInput
                          value={draft.natural_ja}
                          onChange={(e) =>
                            setDraft({ ...draft, natural_ja: e.target.value })
                          }
                        />
                      </Field>
                    </div>
                  </div>
                );
              })()}

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

      <Card>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-slate-400">
              <th className="py-2 text-center">
                <input
                  type="checkbox"
                  aria-label="全選択"
                  checked={lines.length > 0 && selected.length === lines.length}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="py-2 text-center">時間</th>
              <th className="text-center">歌詞</th>
              <th className="text-center">意味</th>
              <th className="text-center">クイズ</th>
              <th className="text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-b border-slate-50">
                <td className="py-2 text-center align-middle">
                  <input
                    type="checkbox"
                    aria-label="選択"
                    checked={selected.includes(l.id)}
                    onChange={() => toggleSelect(l.id)}
                  />
                </td>
                <td className="py-2 text-slate-400">
                  {inlineId === l.id ? (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={inlineStart}
                          onChange={(e) => setInlineStart(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveInline(l.id);
                            if (e.key === "Escape") cancelInline();
                          }}
                          placeholder="12.34"
                          aria-label="開始"
                          className="w-16 rounded border-2 border-black px-1 py-0.5 text-sm text-zinc-900"
                        />
                        <span className="text-zinc-900">–</span>
                        <input
                          type="text"
                          value={inlineEnd}
                          onChange={(e) => setInlineEnd(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveInline(l.id);
                            if (e.key === "Escape") cancelInline();
                          }}
                          placeholder="18.50"
                          aria-label="終了"
                          className="w-16 rounded border-2 border-black px-1 py-0.5 text-sm text-zinc-900"
                        />
                        <button
                          type="button"
                          onClick={() => saveInline(l.id)}
                          aria-label="保存"
                          title="保存"
                          className="rounded border-2 border-black bg-accent px-2 py-0.5 text-sm font-bold text-black hover:opacity-80"
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          onClick={cancelInline}
                          aria-label="キャンセル"
                          title="キャンセル"
                          className="rounded border-2 border-black px-2 py-0.5 text-sm font-bold text-black hover:bg-zinc-100"
                        >
                          ✕
                        </button>
                      </div>
                      {inlineError && (
                        <span className="text-xs text-rose-500">
                          {inlineError}
                        </span>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startInline(l)}
                      title="クリックで編集"
                      className="rounded px-1 py-0.5 font-medium text-zinc-700 underline decoration-dotted underline-offset-2 hover:bg-accent"
                    >
                      {formatTime(l.start_sec)}–{formatTime(l.end_sec)}
                    </button>
                  )}
                </td>
                <td className="font-medium text-zinc-800">
                  {l.is_interlude ? (
                    <span className="text-zinc-400">（間奏）</span>
                  ) : (
                    l.korean_text
                  )}
                </td>
                <td className="text-zinc-500">{l.meaning_ja}</td>
                <td>
                  {(() => {
                    const qs =
                      l.quizzes && l.quizzes.length
                        ? l.quizzes
                        : l.quiz
                          ? [l.quiz]
                          : [];
                    return qs.length ? (
                      <span className="rounded-full border border-zinc-300 px-2 py-0.5 text-xs font-medium text-zinc-700">
                        クイズ{qs.length}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    );
                  })()}
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
                <td colSpan={6} className="py-6 text-center text-slate-400">
                  歌詞行がありません。「歌詞行を追加」から作成してください。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {/* 選択範囲を空欄化する右クリックメニュー */}
      {ctx && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setCtx(null)} />
          <div
            className="fixed z-[61] border-2 border-black bg-white"
            style={{ top: ctx.y, left: ctx.x }}
          >
            <button
              type="button"
              onClick={applyBlank}
              className="block whitespace-nowrap px-3 py-2 text-sm font-bold text-black hover:bg-accent"
            >
              空欄にする（#
              {(() => {
                if (!draft) return 1;
                const ex = [
                  ...blankNumbers(draft.authoring.questionText),
                  ...blankNumbers(draft.authoring.questionTextJa ?? ""),
                ];
                return (ex.length ? Math.max(...ex) : 0) + 1;
              })()}
              ）
            </button>
          </div>
        </>
      )}
    </div>
  );
}
