// 公開サイトと共通のドメイン型

export interface Unit {
  id: string;
  title: string;
  description: string;
  level: number;
  order_index: number;
}

export type Difficulty = "初級" | "中級" | "上級";

// カテゴリーマスタ（大>中>小の階層）: level 1=大 / 2=中 / 3=小
export interface Category {
  id: string;
  name: string;
  level: number;
  parent_id: string | null;
}

// 活用形の種別
export type ConjugationType = "平叙文" | "疑問文" | "命令文" | "感嘆文";

// 活用形バリエーション（韓国語：日本語）
export interface ConjugationVariation {
  type: ConjugationType;
  korean: string;
  meaning_ja: string;
}

export interface Word {
  id: string;
  unit_id: string | null;
  korean: string;
  reading: string;
  meaning_ja: string;
  example?: string | null;
  level: number;
  category?: string | null; // 旧: 単一カテゴリ（後方互換）
  category_large?: string | null; // 大カテゴリー
  category_medium?: string | null; // 中カテゴリー
  category_small?: string | null; // 小カテゴリー
  difficulty?: Difficulty | null; // 初級/中級/上級（任意）
  antonym?: string | null; // 対義語
  synonym?: string | null; // 類義語
  conjugations?: ConjugationVariation[]; // 活用形（韓国語：日本語のバリエーション）
}

export interface Sentence {
  id: string;
  unit_id: string | null;
  korean: string;
  meaning_ja: string;
  tokens: string[];
  level: number;
}

// 文法学習コース（1ページ目＝構造化／2ページ目以降＝ブログ形式）
export interface GrammarExample {
  korean: string;
  meaning_ja: string;
}
export interface GrammarPage {
  title: string;
  body: string;
}
export interface GrammarLesson {
  id: string;
  title: string; // 文法名
  description: string; // 説明
  image?: string | null; // 写真URL（1ページ目）
  examples?: GrammarExample[]; // 例文（1ページ目）
  level: number;
  pages: GrammarPage[]; // 2ページ目以降
}

export type SongLineQuizType = "blank" | "meaning";

export interface SongLineQuiz {
  type: SongLineQuizType;
  question: string;
  questionJa?: string | null; // 日本語の問題文（任意）
  options: string[];
  answer: string;
  hint?: string | null; // 出題時のヒント／正解後に「答え（ヒント）」表示
}

export interface SongLine {
  id: string;
  song_id: string;
  start_sec: number;
  end_sec: number;
  korean_text: string;
  meaning_ja: string;
  explanation?: string | null;
  natural_ja?: string | null; // 自然な翻訳
  is_interlude?: boolean;
  order_index?: number; // 表示・登録順（時間に依存しない並び）
  quiz: SongLineQuiz | null;
  quizzes?: SongLineQuiz[];
  // 再編集用にクイズ作成内容をそのまま保存
  quiz_authoring?: {
    type: SongLineQuizType;
    questionText: string;
    questionTextJa?: string;
    options: { text: string; blank: number | null }[];
  } | null;
}

export interface Song {
  id: string;
  title: string; // 原題（原語タイトル）
  title_ja?: string | null; // 日本語タイトル
  description?: string | null; // 曲の説明
  artist: string;
  youtube_id: string;
  thumbnail_url?: string | null;
  level: number;
}
