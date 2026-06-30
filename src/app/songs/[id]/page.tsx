"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import YouTube, { type YouTubePlayer } from "react-youtube";
import { extractYoutubeId } from "@/lib/youtube";
import { getSupabase } from "@/lib/supabase";
import type { Song, SongLine, SongLineQuiz } from "@/lib/types";
import { Button, Field, TextInput, Card, TextArea } from "@/components/ui";
import { formatTime, parseTime } from "@/lib/time";
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
  interludeKind: InterludeKind; // 前奏/間奏/後奏（isInterlude時のみ有効）
  quizEnabled: boolean;
  authoring: QuizAuthoring;
  explanation: string;
  natural_ja: string;
}

type InterludeKind = "前奏" | "間奏" | "後奏";
const INTERLUDE_KINDS: InterludeKind[] = ["前奏", "間奏", "後奏"];

// その場編集できる曲メタ情報のフィールド
type EditableSongField =
  | "title"
  | "title_ja"
  | "artist"
  | "level"
  | "description";

const emptyDraft = (): LineDraft => ({
  startText: "",
  endText: "",
  korean_text: "",
  meaning_ja: "",
  isInterlude: false,
  interludeKind: "間奏",
  quizEnabled: false,
  authoring: emptyQuizAuthoring(),
  explanation: "",
  natural_ja: "",
});

export default function SongLinesPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [song, setSong] = useState<Song | null>(null);
  const [lines, setLines] = useState<SongLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  // 曲メタ情報のその場編集
  const [editField, setEditField] = useState<EditableSongField | null>(null);
  const [editValue, setEditValue] = useState("");
  const [draft, setDraft] = useState<LineDraft | null>(null);
  const [modalTab, setModalTab] = useState<"basic" | "quiz">("basic");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteSaving, setPasteSaving] = useState(false);
  const [pasteError, setPasteError] = useState("");
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

  // 編集用 YouTube プレイヤー（再生・シークは YouTube 標準UIで操作）
  const playerRef = useRef<YouTubePlayer | null>(null);

  const load = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) {
      setLoadError("Supabase未設定です");
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError("");
    const { data: songData, error: songErr } = await sb
      .from("songs")
      .select("*")
      .eq("id", params.id)
      .single();
    const { data: lineData, error: lineErr } = await sb
      .from("song_lines")
      .select("*")
      .eq("song_id", params.id)
      // 時間昇順 → 同じ時間（貼り付け直後は全て0）は登録順(order_index)で並べる
      .order("start_sec", { ascending: true })
      .order("order_index", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    if (songErr || lineErr) {
      setLoadError((songErr ?? lineErr)?.message ?? "読み込みに失敗しました");
    }
    setSong((songData as Song) ?? null);
    setLines((lineData as SongLine[]) ?? []);
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  // 曲メタ情報をその場で編集開始／確定
  function startFieldEdit(field: EditableSongField, current: string) {
    setEditField(field);
    setEditValue(current);
  }
  async function commitField() {
    if (!editField || !song) {
      setEditField(null);
      return;
    }
    const field = editField;
    const raw = editValue.trim();
    // 値を型に合わせて整形
    let value: string | number | null;
    if (field === "level") {
      const n = Number(raw);
      value = n >= 1 && n <= 5 ? n : song.level;
    } else if (field === "title" || field === "artist") {
      if (!raw) {
        setEditField(null);
        return;
      } // 必須は空なら変更しない
      value = raw;
    } else {
      value = raw || null; // title_ja / description は空なら null
    }
    setEditField(null);
    if (value === (song as unknown as Record<string, unknown>)[field]) return; // 変更なし
    const sb = getSupabase();
    if (!sb) return;
    const { error } = await sb
      .from("songs")
      .update({ [field]: value })
      .eq("id", song.id);
    if (error) setLoadError(error.message);
    else setSong({ ...song, [field]: value } as Song);
  }

  // 曲ごと削除（歌詞行も削除して一覧へ戻る）
  async function deleteSong() {
    if (!song) return;
    if (!confirm(`「${song.title}」を曲ごと削除しますか？この操作は戻せません。`))
      return;
    const sb = getSupabase();
    if (!sb) return;
    await sb.from("song_lines").delete().eq("song_id", params.id);
    const { error } = await sb.from("songs").delete().eq("id", params.id);
    if (error) {
      setLoadError(error.message);
      return;
    }
    router.push("/songs");
  }

  function startEdit(line: SongLine) {
    setModalTab("basic");
    // まだ時間未設定(0/0)の行を編集する時は、他行の最大終了秒を開始秒に自動入力
    const untimed = (line.start_sec ?? 0) === 0 && (line.end_sec ?? 0) === 0;
    const lastEnd = lines.reduce(
      (m, l) => (l.id === line.id ? m : Math.max(m, Number(l.end_sec) || 0)),
      0,
    );
    setDraft({
      id: line.id,
      startText:
        untimed && lastEnd > 0 ? formatTime(lastEnd) : formatTime(line.start_sec),
      endText: formatTime(line.end_sec),
      korean_text: line.korean_text,
      meaning_ja: line.meaning_ja,
      isInterlude: line.is_interlude ?? false,
      interludeKind: (INTERLUDE_KINDS as string[]).includes(line.korean_text)
        ? (line.korean_text as InterludeKind)
        : "間奏",
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
      // 間奏行は歌詞欄に種別ラベル（前奏/間奏/後奏）を保存して表示に使う
      korean_text = draft.interludeKind;
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


  if (loading) return <p className="text-zinc-400">読み込み中…</p>;
  if (!song)
    return (
      <div>
        <p className="text-sm text-zinc-400">
          {loadError
            ? `読み込みエラー: ${loadError}`
            : "曲が見つかりません。"}
        </p>
        <Link href="/songs" className="text-sm font-medium text-zinc-900">
          ← 楽曲一覧
        </Link>
      </div>
    );

  return (
    <div>
      {loadError && (
        <p className="mt-2 border-2 border-black bg-zinc-50 px-3 py-2 text-sm font-medium text-rose-600">
          読み込みエラー: {loadError}
        </p>
      )}
      {/* タイトル・操作ボタン・プレイヤーをまとめて上部固定 */}
      <div className="sticky top-0 z-20 mb-0 bg-zinc-50 pb-1 pt-1">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex flex-wrap items-center gap-x-3 gap-y-2 text-2xl font-bold tracking-tight text-black">
            <span className="inline-block border-2 border-black bg-accent px-2 py-0.5 text-xs font-bold text-black">
              Lv.{song.level}
            </span>
            <span>
              {song.title}
              {song.title_ja ? `　${song.title_ja}` : ""}
            </span>
            <span className="text-base font-medium text-zinc-500">
              {song.artist}
            </span>
          </h1>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <Button
            onClick={() => {
              // 直前（最後）の行の終了秒を新規行の開始秒に自動入力
              // （null/未設定があっても NaN にならないよう Number||0 でガード）
              const lastEnd = lines.reduce(
                (m, l) => Math.max(m, Number(l.end_sec) || 0),
                0,
              );
              setModalTab("basic");
              setDraft({
                ...emptyDraft(),
                startText: lastEnd > 0 ? formatTime(lastEnd) : "",
              });
            }}
          >
            ＋ 歌詞行を追加
          </Button>
          <Button variant="ghost" onClick={() => setPasteOpen(true)}>
            歌詞を貼り付け
          </Button>
          {selected.length > 0 && (
            <Button variant="danger" onClick={deleteSelected}>
              選択削除（{selected.length}）
            </Button>
          )}
        </div>
      </div>

      {/* 編集用 YouTube プレイヤー（再生しながら秒数・クイズを設定） */}
      <div className="border-2 border-black bg-white p-3">
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
                    modestbranding: 1,
                  },
                }}
                onReady={(e) => {
                  playerRef.current = e.target;
                }}
              />
            </div>
          </div>
          {/* 曲情報欄（各項目をクリックでその場編集・枠なし） */}
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {/* レベル */}
              {editField === "level" ? (
                <input
                  type="number"
                  min={1}
                  max={5}
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitField}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitField();
                    if (e.key === "Escape") setEditField(null);
                  }}
                  className="w-14 border-2 border-black px-1 py-0.5 text-xs font-bold"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => startFieldEdit("level", String(song.level))}
                  className="inline-block shrink-0 border-2 border-black bg-accent px-2 py-0.5 text-xs font-bold text-black hover:opacity-80"
                >
                  Lv.{song.level}
                </button>
              )}
              {/* 原題 */}
              {editField === "title" ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitField}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitField();
                    if (e.key === "Escape") setEditField(null);
                  }}
                  className="border-2 border-black px-2 py-0.5 text-sm font-bold"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => startFieldEdit("title", song.title)}
                  className="font-bold tracking-tight text-black underline decoration-dotted underline-offset-2 hover:bg-accent"
                >
                  {song.title}
                </button>
              )}
              {/* 日本語名 */}
              {editField === "title_ja" ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitField}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitField();
                    if (e.key === "Escape") setEditField(null);
                  }}
                  className="border-2 border-black px-2 py-0.5 text-sm font-bold"
                  placeholder="日本語名"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => startFieldEdit("title_ja", song.title_ja ?? "")}
                  className="text-sm font-bold text-zinc-600 underline decoration-dotted underline-offset-2 hover:bg-accent"
                >
                  {song.title_ja || "＋日本語名"}
                </button>
              )}
              {/* アーティスト */}
              {editField === "artist" ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitField}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitField();
                    if (e.key === "Escape") setEditField(null);
                  }}
                  className="border-2 border-black px-2 py-0.5 text-sm"
                  placeholder="アーティスト"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => startFieldEdit("artist", song.artist)}
                  className="text-sm font-medium text-zinc-500 underline decoration-dotted underline-offset-2 hover:bg-accent"
                >
                  {song.artist || "＋アーティスト"}
                </button>
              )}
            </div>
            {/* 説明 */}
            <div className="mt-2">
              {editField === "description" ? (
                <textarea
                  autoFocus
                  rows={2}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitField}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setEditField(null);
                  }}
                  className="w-full border-2 border-black px-2 py-1 text-sm"
                  placeholder="曲の説明"
                />
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    startFieldEdit("description", song.description ?? "")
                  }
                  className="block w-full whitespace-pre-line text-left text-sm text-zinc-600 underline decoration-dotted underline-offset-2 hover:bg-accent"
                >
                  {song.description || "＋曲の説明"}
                </button>
              )}
            </div>
            <p className="mt-1 text-[11px] text-zinc-400">
              各項目をクリックでその場編集
            </p>
          </div>
        </div>
      </div>
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

            {/* タブ（基本情報 / クイズ） */}
            <div className="mb-4 flex gap-2">
              {(
                [
                  ["basic", "歌詞・時間"],
                  ["quiz", "クイズ"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setModalTab(key)}
                  className={`border-2 border-black px-4 py-1.5 text-sm font-bold transition-colors ${
                    modalTab === key
                      ? "bg-black text-white"
                      : "bg-white text-black hover:bg-accent"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className={modalTab === "basic" ? "" : "hidden"}>
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

            <div className="mt-4 flex flex-wrap items-center gap-4">
              <span className="text-sm font-bold text-black">
                器楽パート（歌詞なし）
              </span>
              {INTERLUDE_KINDS.map((kind) => {
                const active = draft.isInterlude && draft.interludeKind === kind;
                return (
                  <label
                    key={kind}
                    className="flex items-center gap-1.5 text-sm font-bold text-black"
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          isInterlude: e.target.checked,
                          interludeKind: kind,
                        })
                      }
                    />
                    {kind}
                  </label>
                );
              })}
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
                <Field label="解説・ヒント（任意）">
                  <TextArea
                    rows={2}
                    value={draft.explanation}
                    onChange={(e) =>
                      setDraft({ ...draft, explanation: e.target.value })
                    }
                    placeholder="文法ポイントや補足など"
                  />
                </Field>
                <p className="mt-1 text-xs text-zinc-500">
                  クイズ有: 回答後に表示／クイズ無: 再生中にこの行で下部に HINT 表示
                </p>
              </div>
            )}
            </div>
            {/* /歌詞・時間タブ */}

            <div className={modalTab === "quiz" ? "" : "hidden"}>
            {draft.isInterlude && (
              <p className="text-sm text-zinc-500">
                間奏行（前奏/間奏/後奏）にはクイズを作成できません。
              </p>
            )}
            {!draft.isInterlude && (
              <div>
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

                  </div>
                );
              })()}
            </div>
            {/* /クイズタブ */}

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

      <div className="border-2 border-black bg-white p-3">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-slate-400">
              <th className="py-1 text-left">時間</th>
              <th className="text-left">歌詞</th>
              <th className="text-left">意味</th>
              <th className="text-center">クイズ</th>
              <th className="text-center">操作</th>
              <th className="py-2 text-center">
                <input
                  type="checkbox"
                  aria-label="全選択"
                  checked={lines.length > 0 && selected.length === lines.length}
                  onChange={toggleSelectAll}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-b border-slate-50">
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
                    <span className="text-zinc-400">
                      （{l.korean_text || "間奏"}）
                    </span>
                  ) : (
                    <div
                      className="max-w-[16rem] truncate"
                      title={l.korean_text}
                    >
                      {l.korean_text}
                    </div>
                  )}
                </td>
                <td className="text-zinc-500">
                  <div className="max-w-[16rem] truncate" title={l.meaning_ja}>
                    {l.meaning_ja}
                  </div>
                </td>
                <td className="text-center">
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
                <td className="text-center">
                  <div className="flex justify-center gap-2">
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
                <td className="py-2 text-center align-middle">
                  <input
                    type="checkbox"
                    aria-label="選択"
                    checked={selected.includes(l.id)}
                    onChange={() => toggleSelect(l.id)}
                  />
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
      </div>

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

      {/* 画面最下部：曲ごと削除 */}
      <div className="mt-10 border-t border-zinc-200 pt-6">
        <Button variant="danger" onClick={deleteSong}>
          この曲を削除
        </Button>
      </div>
    </div>
  );
}
