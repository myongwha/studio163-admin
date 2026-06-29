"use client";

import { useState } from "react";
import Link from "next/link";
import { useTable } from "@/lib/db";
import { extractYoutubeId } from "@/lib/youtube";
import type { Song } from "@/lib/types";
import {
  PageHeader,
  Button,
  Field,
  TextInput,
  Card,
} from "@/components/ui";

type Draft = Partial<Song>;

export default function SongsPage() {
  const { rows, loading, error, save, remove } = useTable<Song>("songs");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

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
      <PageHeader
        title="楽曲"
        subtitle="YouTube動画を登録し、詳細で歌詞行とクイズを設定します"
        action={
          <Button onClick={() => setDraft({ level: 1 })}>＋ 新規追加</Button>
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
            {extractYoutubeId(draft.youtube_id ?? "") && (
              <img
                src={`https://img.youtube.com/vi/${extractYoutubeId(
                  draft.youtube_id ?? "",
                )}/hqdefault.jpg`}
                alt=""
                className="mt-4 h-28 w-48 border-2 border-black object-cover"
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
      )}

      {loading ? (
        <p className="text-slate-400">読み込み中…</p>
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
                  <p className="truncate font-bold text-slate-700">{s.title}</p>
                  <p className="truncate text-sm text-slate-400">{s.artist}</p>
                  <p className="text-xs text-slate-400">Lv.{s.level}</p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Link href={`/songs/${s.id}`} className="flex-1">
                  <Button className="w-full">歌詞・クイズを編集</Button>
                </Link>
                <Button variant="ghost" onClick={() => setDraft(s)}>
                  編集
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    if (confirm(`「${s.title}」を削除しますか？`)) remove(s.id);
                  }}
                >
                  削除
                </Button>
              </div>
            </Card>
          ))}
          {rows.length === 0 && (
            <p className="text-slate-400">楽曲がありません。</p>
          )}
        </div>
      )}
    </div>
  );
}
