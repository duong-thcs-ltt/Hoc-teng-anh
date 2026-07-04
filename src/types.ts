export interface VocabularyWord {
  word: string;
  type: string;
  phonetic: string;
  meaning: string;
  example: string;
}

export interface TranslationResult {
  translation: string;
  analysis: string;
  vocabulary: VocabularyWord[];
}

export interface VoiceOption {
  id: string;
  name: string;
  gender: "male" | "female";
  origin: "US" | "UK" | "Neural";
  systemName: string; // Browser voice name or Gemini voice name
}

export type ReadMode = "browser" | "gemini";
