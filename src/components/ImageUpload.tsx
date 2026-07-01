"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";

// Supabase Storage の公開バケット名（ダッシュボードで作成しておく）
const BUCKET = "images";

export function ImageUpload({
  value,
  onChange,
  folder = "misc",
  source,
  onSourceChange,
}: {
  value?: string | null;
  onChange: (url: string | null) => void;
  folder?: string;
  source?: string | null; // 画像の引用元（出典）
  onSourceChange?: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  // 引用元URLのリンクプレビュー
  const [srcLoading, setSrcLoading] = useState(false);
  const [srcPreview, setSrcPreview] = useState<{
    title: string | null;
    image: string | null;
    siteName: string | null;
  } | null>(null);

  const srcUrl = (source ?? "").trim();
  const srcIsUrl = /^https?:\/\//i.test(srcUrl);
  useEffect(() => {
    if (!onSourceChange || !srcIsUrl) {
      setSrcPreview(null);
      return;
    }
    let cancelled = false;
    setSrcLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/link-preview?url=${encodeURIComponent(srcUrl)}`,
        );
        if (!res.ok) return;
        const d = (await res.json()) as {
          title?: string | null;
          image?: string | null;
          siteName?: string | null;
        };
        if (cancelled) return;
        setSrcPreview({
          title: d.title ?? null,
          image: d.image ?? null,
          siteName: d.siteName ?? null,
        });
      } catch {
        /* 取得失敗は無視 */
      } finally {
        if (!cancelled) setSrcLoading(false);
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcUrl]);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("画像ファイルを選んでください");
      return;
    }
    const sb = getSupabase();
    if (!sb) {
      setError("Supabase未設定です");
      return;
    }
    setUploading(true);
    setError("");
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await sb.storage
      .from(BUCKET)
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (upErr) {
      setError(
        upErr.message.includes("Bucket not found")
          ? "バケット 'images' が未作成です（Supabaseで作成してください）"
          : upErr.message,
      );
      setUploading(false);
      return;
    }
    const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
    onChange(data.publicUrl);
    setUploading(false);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (!dragging) setDragging(true);
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      {/* ドラッグ＆ドロップ or クリックで選択・上書きできる 16:9 固定ゾーン */}
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        role="button"
        tabIndex={0}
        className={`relative flex aspect-video w-56 max-w-full cursor-pointer items-center justify-center overflow-hidden border text-center transition-colors ${
          value ? "border-solid border-zinc-200" : "border-dashed"
        } ${
          dragging
            ? "border-zinc-900 bg-zinc-50"
            : value
              ? "hover:opacity-90"
              : "border-zinc-300 hover:bg-zinc-50"
        }`}
      >
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            {/* 削除（プレビュー内・右上の✖） */}
            <button
              type="button"
              aria-label="画像を削除"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center border border-zinc-300 bg-white/90 text-sm font-bold text-zinc-700 transition-colors hover:bg-white"
            >
              ✖
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1 px-3">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-zinc-400"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p className="text-[11px] leading-tight text-zinc-500">
              {dragging ? "ここにドロップ" : "ドラッグ＆ドロップ / クリック"}
            </p>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 text-xs font-medium text-zinc-600">
            アップロード中…
          </div>
        )}
      </div>
      {onSourceChange && (
        <div className="mt-2 w-56 max-w-full">
          <input
            type="text"
            value={source ?? ""}
            onChange={(e) => onSourceChange(e.target.value)}
            placeholder="引用元（出典・URLも可）"
            className="block w-full border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 placeholder:text-zinc-400 transition-colors focus:border-zinc-900 focus:outline-none"
          />
          {srcIsUrl && srcLoading && (
            <p className="mt-1 text-[11px] text-zinc-400">出典を取得中…</p>
          )}
          {srcIsUrl && !srcLoading && srcPreview && !srcPreview.title && (
            <p className="mt-1 text-[11px] text-zinc-400">
              プレビューを取得できませんでした（限定公開/非公開の可能性）
            </p>
          )}
          {srcIsUrl && !srcLoading && srcPreview?.title && (
            <a
              href={srcUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 flex items-center gap-2 border border-zinc-200 bg-zinc-50 p-1.5 transition-colors hover:bg-zinc-100"
            >
              {srcPreview.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={srcPreview.image}
                  alt=""
                  className="h-8 w-8 shrink-0 border border-zinc-200 object-cover"
                />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-bold text-zinc-900">
                  {srcPreview.title}
                </span>
                {srcPreview.siteName && (
                  <span className="block truncate text-[10px] text-zinc-400">
                    {srcPreview.siteName}
                  </span>
                )}
              </span>
            </a>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-sm text-rose-500">{error}</p>}
    </div>
  );
}
