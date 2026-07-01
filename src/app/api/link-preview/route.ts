import { NextResponse } from "next/server";

// 引用元URLのページタイトル/OG情報を取得（サーバー経由でCORS回避）
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "valid url required" }, { status: 400 });
  }
  try {
    // YouTube はOGを返さないため oEmbed でタイトル・サムネを取得
    const ytId = url.match(
      /(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/)([A-Za-z0-9_-]{11})/,
    )?.[1];
    if (ytId) {
      const yt = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(
          `https://www.youtube.com/watch?v=${ytId}`,
        )}&format=json`,
        { cache: "no-store" },
      );
      if (yt.ok) {
        const d = (await yt.json()) as {
          title?: string;
          author_name?: string;
          thumbnail_url?: string;
        };
        return NextResponse.json({
          title: d.title ?? null,
          image: d.thumbnail_url ?? null,
          siteName: d.author_name ?? "YouTube",
        });
      }
      // oEmbed取得不可（限定公開/非公開/地域制限など）はHTMLに情報が無いので終了
      return NextResponse.json({
        title: null,
        image: null,
        siteName: "YouTube",
      });
    }

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; studio163-admin/1.0; +link-preview)",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const html = await res.text();
    const pick = (re: RegExp) => {
      const m = html.match(re);
      return m ? m[1].trim() : null;
    };
    const og = (prop: string) =>
      pick(
        new RegExp(
          `<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']+)["']`,
          "i",
        ),
      ) ??
      pick(
        new RegExp(
          `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${prop}["']`,
          "i",
        ),
      );
    const decode = (s: string | null) =>
      s
        ? s
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
        : s;
    const title = decode(og("title") ?? pick(/<title[^>]*>([^<]*)<\/title>/i));
    const image = og("image");
    const siteName = decode(og("site_name"));
    return NextResponse.json({ title, image, siteName });
  } catch {
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }
}
