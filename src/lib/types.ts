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
  options: string[];
  answer: string;
}

export interface SongLine {
  id: string;
  song_id: string;
  start_sec: number;
  end_sec: number;
  korean_text: string;
  meaning_ja: string;
  quiz: SongLineQuiz | null;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  youtube_id: string;
  thumbnail_url?: string | null;
  level: number;
}
