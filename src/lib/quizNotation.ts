// クイズ記法のパーサ
// 1ブロック（空行区切り）= 1歌詞行。例:
//
//   #1<살다 보면> 시련은 분명히 있을 거야
//   生きていれば試練はきっとあるはずだ
//   1.하고 2.틀려도 3.살다 보면 [#1] 4.생각해
//
// - 歌詞行中の #N<答え> が空欄。複数(#1 #2 ...)可。
// - [#N] を含む行が、その空欄Nの選択肢。先頭の「数字.」は除去。半角/全角スペース区切り。
// - 選択肢行が無い空欄は 1択（答えのみ）になる。
// - #N<> が無いブロックは、クイズ無しの通常歌詞行（1行目=韓国語, 2行目=意味）。

export interface ParsedQuiz {
  type: "blank";
  question: string;
  options: string[];
  answer: string;
}

export interface ParsedLine {
  korean_text: string;
  meaning_ja: string;
  quizzes: ParsedQuiz[];
}

const BLANK_RE = /#(\d+)\s*<([^>]*)>/g;
const OPT_TAG_RE = /\[#(\d+)\]/;

// 「1.A 2.B 3.살다 보면 4.C」のように "数字." 区切りで選択肢を抽出する。
// 選択肢自体に空白が含まれていても（例: 살다 보면）正しく1つとして取得する。
function parseOptions(line: string): string[] {
  const opts: string[] = [];
  const re = /\d+\s*[.．、]\s*([\s\S]*?)(?=\s*\d+\s*[.．、]|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    const t = m[1].trim();
    if (t) opts.push(t);
  }
  return opts;
}

export function parseQuizNotation(text: string): ParsedLine[] {
  const blocks = text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const result: ParsedLine[] = [];

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) continue;

    const lyricLine = lines.find((l) => /#\d+\s*<[^>]*>/.test(l));

    // 空欄なし = 通常歌詞行
    if (!lyricLine) {
      result.push({
        korean_text: lines[0],
        meaning_ja: lines[1] ?? "",
        quizzes: [],
      });
      continue;
    }

    // 空欄の抽出
    const blanks: { n: number; answer: string }[] = [];
    let m: RegExpExecArray | null;
    BLANK_RE.lastIndex = 0;
    while ((m = BLANK_RE.exec(lyricLine)) !== null) {
      blanks.push({ n: Number(m[1]), answer: m[2].trim() });
    }

    // 韓国語本文（空欄を答えで埋めた完全な歌詞）
    const korean_text = lyricLine
      .replace(BLANK_RE, (_full, _n, ans) => ans.trim())
      .replace(/[ 　]{2,}/g, " ")
      .trim();

    // 選択肢行とその他（意味）を分類
    const optionMap = new Map<number, string[]>();
    const otherLines: string[] = [];
    for (const l of lines) {
      if (l === lyricLine) continue;
      const tag = l.match(OPT_TAG_RE);
      if (tag) {
        const n = Number(tag[1]);
        const rest = l.replace(OPT_TAG_RE, " ");
        optionMap.set(n, parseOptions(rest));
      } else {
        otherLines.push(l);
      }
    }
    const meaning_ja = otherLines[0] ?? "";

    // 空欄ごとにクイズ生成
    const quizzes: ParsedQuiz[] = blanks
      .sort((a, b) => a.n - b.n)
      .map((blank) => {
        let options = optionMap.get(blank.n) ?? [];
        if (options.length === 0) options = [blank.answer]; // 選択肢なし=1択
        if (!options.includes(blank.answer)) options = [...options, blank.answer];

        // 設問: 対象の空欄は ___、他の空欄は答えで埋める
        const question = lyricLine
          .replace(BLANK_RE, (_full, n, ans) =>
            Number(n) === blank.n ? "___" : ans.trim(),
          )
          .replace(/[ 　]{2,}/g, " ")
          .trim();

        return { type: "blank" as const, question, options, answer: blank.answer };
      });

    result.push({ korean_text, meaning_ja, quizzes });
  }

  return result;
}
