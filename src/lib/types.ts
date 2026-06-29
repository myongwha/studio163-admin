// 公開サイトと共通のドメイン型

export interface Unit {
  id: string;
  title: string;
  description: string;
  level: number;
  order_index: number;
}

export interface Word {
  id: string;
  unit_id: string | null;
  korean: string;
  reading: string;
  meaning_ja: string;
  example?: string | null;
  level: number;
  category?: string | null;
}

export interface Sentence {
  id: string;
  unit_id: string | null;
  korean: string;
  meaning_ja: string;
  tokens: string[];
  level: number;
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
