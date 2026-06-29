// YouTube の URL から動画IDを取り出す。
// 既にID（11文字程度）が渡された場合はそのまま返す。
// 対応: watch?v=ID / youtu.be/ID / embed/ID / shorts/ID / live/ID
export function extractYoutubeId(input: string): string {
  const s = input.trim();
  if (!s) return "";

  // URL でなければ（v= や / を含まない）ID とみなす
  if (!s.includes("/") && !s.includes("v=")) return s;

  const patterns = [
    /[?&]v=([^&]+)/, // watch?v=ID
    /youtu\.be\/([^?&/]+)/, // youtu.be/ID
    /\/embed\/([^?&/]+)/, // /embed/ID
    /\/shorts\/([^?&/]+)/, // /shorts/ID
    /\/live\/([^?&/]+)/, // /live/ID
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) return m[1];
  }
  // 取り出せなければ末尾セグメントを返す
  const tail = s.split("/").pop() ?? s;
  return tail.split("?")[0];
}
