"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTable } from "@/lib/db";
import { extractYoutubeId } from "@/lib/youtube";
import type { Song } from "@/lib/types";
import {
  Button,
  Field,
  TextInput,
  TextArea,
  Card,
} from "@/components/ui";
import { ImageUpload } from "@/components/ImageUpload";

type Draft = Partial<Song>;

export default function SongsPage() {
  const { rows, loading, error, save } = useTable<Song>("songs");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [fetchingMeta, setFetchingMeta] = useState(false);
  const [fetchedMeta, setFetchedMeta] = useState<{
    title: string | null;
    author: string | null;
  } | null>(null);

  // YouTube URL/ID を入れたら動画タイトル・チャンネル名を取得（空欄は自動補完＋取得結果を表示）
  const draftVideoId = extractYoutubeId(draft?.youtube_id ?? "");
  useEffect(() => {
    if (!draftVideoId) {
      setFetchedMeta(null);
      return;
    }
    let cancelled = false;
    setFetchingMeta(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/youtube?id=${draftVideoId}`);
        if (!res.ok) return;
        const d = (await res.json()) as {
          title?: string | null;
          author?: string | null;
        };
        if (cancelled) return;
        setFetchedMeta({ title: d.title ?? null, author: d.author ?? null });
        setDraft((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            title: prev.title?.trim() ? prev.title : d.title ?? prev.title,
            artist: prev.artist?.trim() ? prev.artist : d.author ?? prev.artist,
          };
        });
      } catch {
        /* 取得失敗時は何もしない */
      } finally {
        if (!cancelled) setFetchingMeta(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [draftVideoId]);

  async function submit() {
    const videoId = extractYoutubeId(draft?.youtube_id ?? "");
    if (!draft?.title || !videoId) {
      setFormError("タイトルと YouTube URL（またはID）は必須です");
      return;
    }
    setSaving(true);
    setFormError("");
    const { error } = await save({
      id: draft.id,
      title: draft.title,
      title_ja: draft.title_ja || null,
      description: draft.description || null,
      artist: draft.artist ?? "",
      youtube_id: videoId,
      level: Number(draft.level ?? 1),
      thumbnail_url: draft.thumbnail_url || null,
    });
    setSaving(false);
    if (error) setFormError(error);
    else setDraft(null);
  }

  return (
    <div>
      <div className="sticky top-0 z-20 -mx-10 -mt-10 mb-6 flex items-center justify-between gap-4 border-b border-zinc-200 bg-zinc-100 px-10 pb-5 pt-10">
        <h1 className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-2xl font-bold tracking-tight text-zinc-900">
          楽曲
          <span className="text-sm font-medium text-zinc-500">
            YouTube動画を登録し、詳細で歌詞行とクイズを設定します
          </span>
        </h1>
        <Button onClick={() => setDraft({ level: 1 })}>＋ 新規追加</Button>
      </div>

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
                {draft.id ? "楽曲を編集" : "楽曲を新規追加"}
              </h2>
            <div className="mb-4">
              <Field label="サムネイル画像（任意・未設定ならYouTube既定）">
                <ImageUpload
                  value={draft.thumbnail_url}
                  onChange={(url) => setDraft({ ...draft, thumbnail_url: url })}
                  folder="songs"
                />
              </Field>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="原題（原語タイトル）">
                <TextInput
                  value={draft.title ?? ""}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="강남스타일"
                />
              </Field>
              <Field label="日本語タイトル">
                <TextInput
                  value={draft.title_ja ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, title_ja: e.target.value })
                  }
                  placeholder="江南スタイル"
                />
              </Field>
              <Field label="アーティスト">
                <TextInput
                  value={draft.artist ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, artist: e.target.value })
                  }
                />
              </Field>
              <Field label="YouTube URL（リンクをそのまま貼れます）">
                <TextInput
                  value={draft.youtube_id ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, youtube_id: e.target.value })
                  }
                  placeholder="https://www.youtube.com/watch?v=9bZkp7q19f0"
                />
                {fetchingMeta && (
                  <p className="mt-1 text-xs text-zinc-400">
                    タイトルを取得中…
                  </p>
                )}
                {!fetchingMeta && fetchedMeta?.title && (
                  <div className="mt-1.5 border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs text-zinc-600">
                    <span className="text-zinc-400">取得タイトル：</span>
                    <span className="font-bold text-zinc-900">
                      {fetchedMeta.title}
                    </span>
                    {fetchedMeta.author && (
                      <span className="text-zinc-400">
                        {" "}
                        ／ {fetchedMeta.author}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                title: fetchedMeta.title ?? prev.title,
                                artist: fetchedMeta.author ?? prev.artist,
                              }
                            : prev,
                        )
                      }
                      className="ml-2 font-bold text-zinc-900 underline decoration-dotted underline-offset-2 hover:opacity-70"
                    >
                      原題に適用
                    </button>
                  </div>
                )}
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
              <Field label="曲の説明（任意）">
                <TextArea
                  rows={2}
                  value={draft.description ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, description: e.target.value })
                  }
                  placeholder="曲やアーティストの紹介、学習ポイントなど"
                />
              </Field>
            </div>
            {!draft.thumbnail_url && extractYoutubeId(draft.youtube_id ?? "") && (
              <img
                src={`https://img.youtube.com/vi/${extractYoutubeId(
                  draft.youtube_id ?? "",
                )}/hqdefault.jpg`}
                alt=""
                className="mt-4 h-28 w-48 border border-zinc-200 object-cover"
              />
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
        </div>
      )}

      {loading ? (
        <p className="text-zinc-400">読み込み中…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((s) => (
            <Card key={s.id}>
              <div className="flex gap-3">
                <img
                  src={
                    s.thumbnail_url ||
                    `https://img.youtube.com/vi/${s.youtube_id}/hqdefault.jpg`
                  }
                  alt=""
                  className="h-16 w-28 shrink-0 rounded-xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-bold text-zinc-900">
                    <span className="inline-block shrink-0 border border-zinc-200 bg-accent px-2 py-0.5 text-xs font-bold text-zinc-900">
                      Lv.{s.level}
                    </span>
                    <span className="min-w-0 truncate">
                      {s.title}
                      {s.title_ja ? `　${s.title_ja}` : ""}
                    </span>
                  </p>
                  <p className="mt-1 truncate text-sm text-zinc-400">
                    {s.artist}
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <Link href={`/songs/${s.id}`} className="block">
                  <Button className="w-full">歌詞・クイズを編集</Button>
                </Link>
              </div>
            </Card>
          ))}
          {rows.length === 0 && (
            <p className="text-zinc-400">楽曲がありません。</p>
          )}
        </div>
      )}
    </div>
  );
}
