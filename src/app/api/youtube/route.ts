import { NextResponse } from "next/server";

// YouTube の oEmbed から動画タイトル・チャンネル名を取得（APIキー不要・サーバー経由でCORS回避）
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(
        `https://www.youtube.com/watch?v=${id}`,
      )}&format=json`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const data = (await res.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    };
    return NextResponse.json({
      title: data.title ?? null,
      author: data.author_name ?? null,
      thumbnail: data.thumbnail_url ?? null,
    });
  } catch {
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }
}
