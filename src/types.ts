export type PageTab = 'home' | 'learn' | 'practice' | 'flash' | 'settings';
export type LearnTab = 'Words' | 'Sentences' | 'Q & A' | 'Grammar';
export type PracticeMode = 'quiz' | 'blank' | 'rearrange';

export type WordItem = [string, string, string, string]; // [thai, phonetic, myanmar, category]
export type SentenceItem = [string, string, string, string]; // [thai, phonetic, myanmar, category]

export interface GrammarPattern {
  title: string;
  formula: string;
  explain: string;
  examples: string[];
}

export type QAPair = [string, string, string, string]; // [qThai, aThai, qMyanmar, aMyanmar]

export interface RearrangeItem {
  meaning: string;
  parts: [string, string, string][]; // [thai, phonetic, myanmarSound]
}

export interface QuizItem {
  q: string;
  choices: string[];
  correct: number;
  why: string;
  audio?: string;
}

export interface BlankItem {
  full: string;
  blank: string;
  answer: string;
  meaning: string;
  choices: string[];
}

export type FillVocabDetails = [string, string, string]; // [phonetic, pronunciation, meaning]
