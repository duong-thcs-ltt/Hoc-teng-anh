import React from "react";
import { Volume2, BookOpen } from "lucide-react";
import { VocabularyWord } from "../types";

interface VocabularySectionProps {
  vocabulary: VocabularyWord[];
}

export default function VocabularySection({ vocabulary }: VocabularySectionProps) {
  const speakWord = (word: string) => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = "en-US";
      utterance.rate = 0.9; // speak slightly slower for clarity
      window.speechSynthesis.speak(utterance);
    }
  };

  if (!vocabulary || vocabulary.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
        <BookOpen className="h-5 w-5 text-blue-400 animate-pulse" />
        <h3 className="text-base font-bold text-slate-200">
          Từ vựng trọng tâm & Ngữ âm (Key Vocabulary)
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {vocabulary.map((item, index) => (
          <div
            key={index}
            className="group relative bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md hover:shadow-lg hover:border-blue-500/50 transition-all duration-300 flex flex-col justify-between"
          >
            {/* Header section of card */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-start gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h4 className="text-base font-extrabold text-slate-100 group-hover:text-blue-400 transition-colors">
                    {item.word}
                  </h4>
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 bg-slate-950 text-slate-400 border border-slate-800 rounded-md">
                    {item.type}
                  </span>
                </div>

                <button
                  onClick={() => speakWord(item.word)}
                  className="p-1.5 bg-blue-950/40 text-blue-400 border border-blue-900/40 rounded-lg hover:bg-blue-900/30 hover:scale-105 active:scale-95 transition-all"
                  title="Nghe phát âm"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Phonetics IPA */}
              <p className="text-xs font-mono text-blue-400 font-medium">
                {item.phonetic}
              </p>

              {/* Meaning in Vietnamese */}
              <p className="text-sm font-semibold text-slate-200 bg-blue-950/20 px-2 py-1 rounded-md border border-blue-900/30">
                {item.meaning}
              </p>
            </div>

            {/* Example sentence */}
            <div className="mt-3 pt-3 border-t border-slate-800 text-xs">
              <span className="font-bold text-slate-500 block mb-0.5">Ví dụ:</span>
              <p className="text-slate-300 italic leading-relaxed">
                "{item.example}"
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
