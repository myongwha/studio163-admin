// クイズ作成（シンプル版）
// 入力:
//  - questionText: 歌詞を #1<…> #2<…> で空欄指定した文字列（<> の中はその箇所の元の語）
//  - options: 選択肢の語群。各語に blank(=その空欄の正解) か null を付ける
// 出力:
//  - quizzes: SongLineQuiz[]（空欄ごとに1問。answer=その番号ラベルの語）
// 再編集のため authoring(questionText, options) はそのまま song_lines に保存する。

import type { SongLineQuiz, SongLineQuizType } from "@/lib/types";

export interface AuthorOption {
  text: string;
  blank: number | null;
}

export interface QuizAuthoring {
  type: SongLineQuizType;
  questionText: string; // 韓国語（#1<> で空欄）
  questionTextJa: string; // 日本語（#1<> で空欄、任意）
  options: AuthorOption[];
}

// 問題文の指示（タブで選ぶ）
export const QUIZ_INSTRUCTION: Record<SongLineQuizType, string> = {
  meaning: "空欄に当てはまる日本語の意味を選びましょう",
  blank: "空欄に当てはまる韓国語を選びましょう",
};

const MARK_RE = /#(\d+)\s*<([^>]*)>/g;

export function emptyQuizAuthoring(): QuizAuthoring {
  return { type: "meaning", questionText: "", questionTextJa: "", options: [] };
}

// questionText 内の空欄番号一覧（昇順・重複排除）
export function blankNumbers(questionText: string): number[] {
  const set = new Set<number>();
  let m: RegExpExecArray | null;
  MARK_RE.lastIndex = 0;
  while ((m = MARK_RE.exec(questionText)) !== null) set.add(Number(m[1]));
  return [...set].sort((a, b) => a - b);
}

export interface BuildResult {
  quizzes: SongLineQuiz[];
  error?: string;
}

// 空欄N の元の語（<> の中身）
function wordOf(questionText: string, n: number): string {
  let m: RegExpExecArray | null;
  MARK_RE.lastIndex = 0;
  while ((m = MARK_RE.exec(questionText)) !== null) {
    if (Number(m[1]) === n) return m[2].trim();
  }
  return "";
}

// 旧データ（quizzes のみ）から編集用 authoring を近似復元
export function reconstructAuthoring(
  quizzes: SongLineQuiz[] | null | undefined,
): QuizAuthoring {
  const qs = quizzes ?? [];
  if (qs.length === 0) return emptyQuizAuthoring();
  const pool: string[] = [];
  for (const q of qs) for (const o of q.options) if (!pool.includes(o)) pool.push(o);
  const options: AuthorOption[] = pool.map((text) => {
    const idx = qs.findIndex((q) => q.answer === text);
    return { text, blank: idx >= 0 ? idx + 1 : null };
  });
  let questionText = qs[0].question.replace("___", "#1<>");
  for (let i = 1; i < qs.length; i++) questionText += ` #${i + 1}<>`;
  return { type: qs[0].type, questionText, questionTextJa: "", options };
}

// 全角/半角スペース整理
const tidy = (s: string) => s.replace(/[ 　]{2,}/g, " ").trim();

export function buildQuizzes(a: QuizAuthoring): BuildResult {
  const krNums = blankNumbers(a.questionText);
  const jaNums = blankNumbers(a.questionTextJa);

  // 種別に応じて「空欄を作る言語(primary)」と「対訳表示(secondary)」を決める。
  //  - 意味を選ぶ(meaning): 日本語に空欄（無ければ韓国語にフォールバック）
  //  - 韓国語を選ぶ(blank):  韓国語に空欄（無ければ日本語にフォールバック）
  // primaryIsKo: 空欄を作る言語が韓国語かどうかを「文字列比較」ではなく
  // 選択時のフラグで保持する（韓国語/日本語が同一文字列でも誤判定しない）
  let primary: string;
  let primaryIsKo: boolean;
  if (a.type === "meaning") {
    // 意味を選ぶ: 日本語に空欄（無ければ韓国語にフォールバック）
    primaryIsKo = jaNums.length === 0;
  } else {
    // 韓国語を選ぶ: 韓国語に空欄（無ければ日本語にフォールバック）
    primaryIsKo = krNums.length > 0;
  }
  primary = primaryIsKo ? a.questionText : a.questionTextJa;

  const nums = blankNumbers(primary);
  if (nums.length === 0) {
    return {
      quizzes: [],
      error:
        a.type === "meaning"
          ? "日本語（または韓国語）の問題文に空欄 #1<> を1つ以上指定してください"
          : "韓国語（または日本語）の問題文に空欄 #1<> を1つ以上指定してください",
    };
  }

  const pool = a.options.map((o) => o.text.trim()).filter(Boolean);
  const answerOf = (n: number) =>
    a.options.find((o) => o.blank === n && o.text.trim())?.text.trim() ?? "";

  for (const n of nums) {
    if (!answerOf(n)) {
      return { quizzes: [], error: `空欄 #${n} の正解語を選択肢で「#${n}」に設定してください` };
    }
  }

  // 韓国語が空欄側か
  const koIsPrimary = primaryIsKo;

  // 指定言語の行を作る（isPrimary の時だけ空欄n を ___、他は語で埋める）
  const lineFor = (text: string, n: number, isPrimary: boolean) =>
    text
      ? tidy(
          text.replace(MARK_RE, (_f, num) =>
            isPrimary && Number(num) === n ? "___" : wordOf(text, Number(num)),
          ),
        )
      : "";

  const quizzes: SongLineQuiz[] = nums.map((n) => {
    const answer = answerOf(n);
    const koLine = lineFor(a.questionText, n, koIsPrimary); // 上段：韓国語
    const jaLine = lineFor(a.questionTextJa, n, !koIsPrimary); // 下段：日本語
    const options = pool.includes(answer) ? pool : [...pool, answer];
    return {
      type: a.type,
      question: koLine, // 韓国語（上段・大きく表示）
      questionJa: jaLine || null, // 日本語（下段）
      options,
      answer,
    };
  });

  return { quizzes };
}
