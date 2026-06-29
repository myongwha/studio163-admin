// 時間入力のユーティリティ
// 表示・入力は「秒の小数点表記」(例 12.34 = 12.34秒、小数2桁まで)。
// DB にもそのまま秒(number)で保存する。

// 秒(number) → 表示文字列（小数の不要な0は除去。例 83 → "83", 83.4 → "83.4"）
export function formatTime(totalSec: number): string {
  if (typeof totalSec !== "number" || !isFinite(totalSec)) return "";
  const sec = Math.max(0, Math.round(totalSec * 100) / 100);
  return String(sec);
}

// "12.34" / "83" → 秒(number)。小数2桁まで。不正なら NaN
export function parseTime(input: string): number {
  const s = input.trim();
  if (s === "") return NaN;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
  return Number(s);
}
