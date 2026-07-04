import React, { useState, useEffect } from "react";
import {
  Sparkles,
  BookOpen,
  FileText,
  Brain,
  Globe,
  RefreshCw,
  Trash2,
  BookMarked,
  Layers,
  ChevronRight,
  Smile,
} from "lucide-react";
import Header from "./components/Header";
import FileUploader from "./components/FileUploader";
import TTSPlayer from "./components/TTSPlayer";
import VocabularySection from "./components/VocabularySection";
import { TranslationResult } from "./types";

const DEFAULT_ENGLISH_TEXT =
  "Success in learning English is built on daily consistency, curious reading, and practicing proper pronunciation. When you listen to native speakers, try to shadow their rhythm and mimic their pronunciation to speak naturally.";

export default function App() {
  const [inputText, setInputText] = useState<string>(DEFAULT_ENGLISH_TEXT);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [isFileExtracting, setIsFileExtracting] = useState<boolean>(false);
  const [translationResult, setTranslationResult] = useState<TranslationResult | null>(null);
  const [translationError, setTranslationError] = useState<string | null>(null);

  // Spoken word highlight state
  const [highlightRange, setHighlightRange] = useState<{ startIndex: number; length: number } | null>(
    null
  );
  const [isPlayingSpeak, setIsPlayingSpeak] = useState<boolean>(false);

  // Auto-translate default text on first load
  useEffect(() => {
    handleTranslate();
  }, []);

  const handleTranslate = async () => {
    if (!inputText || inputText.trim() === "") {
      setTranslationError("Vui lòng nhập văn bản tiếng Anh để dịch.");
      return;
    }

    setIsTranslating(true);
    setTranslationError(null);

    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: inputText }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Lỗi xử lý yêu cầu phiên dịch.");
      }

      setTranslationResult(data);
    } catch (error: any) {
      console.error(error);
      setTranslationError(error.message || "Không thể kết nối với máy chủ để dịch.");
    } finally {
      setIsTranslating(false);
    }
  };

  const handleClear = () => {
    setInputText("");
    setTranslationResult(null);
    setTranslationError(null);
    setHighlightRange(null);
    setIsPlayingSpeak(false);
  };

  const handleTextExtracted = (extractedText: string) => {
    setInputText(extractedText);
    setTranslationResult(null);
    setTranslationError(null);
    setHighlightRange(null);
    setIsPlayingSpeak(false);
  };

  const onHighlightWord = (startIndex: number, length: number) => {
    setHighlightRange({ startIndex, length });
    setIsPlayingSpeak(true);
  };

  const onResetHighlight = () => {
    setHighlightRange(null);
    setIsPlayingSpeak(false);
  };

  // Helper to render text with highlighted active word
  const renderHighlightedText = () => {
    if (!highlightRange || highlightRange.startIndex < 0) {
      return <p className="text-slate-200 leading-relaxed font-serif text-lg">{inputText}</p>;
    }

    const start = highlightRange.startIndex;
    const end = start + highlightRange.length;

    const before = inputText.substring(0, start);
    const word = inputText.substring(start, end);
    const after = inputText.substring(end);

    return (
      <p className="text-slate-200 leading-relaxed font-serif text-lg whitespace-pre-wrap">
        {before}
        <span className="bg-amber-500 text-slate-950 font-bold px-1.5 py-0.5 rounded shadow-sm scale-105 inline-block transition-all duration-75 border-b-2 border-amber-300">
          {word}
        </span>
        {after}
      </p>
    );
  };

  // Helper to render markdown returned by Gemini in the explanation section
  const renderMarkdown = (markdown: string) => {
    if (!markdown) return null;

    const lines = markdown.split("\n");
    return lines.map((line, idx) => {
      // Bold syntax conversion **bold**
      const parseBold = (text: string) => {
        const parts = text.split(/\*\*(.*?)\*\*/g);
        return parts.map((part, i) => (i % 2 === 1 ? <strong key={i} className="font-extrabold text-blue-400">{part}</strong> : part));
      };

      // Header syntax
      if (line.startsWith("### ")) {
        return (
          <h4 key={idx} className="text-base font-bold text-slate-200 mt-4 mb-2">
            {parseBold(line.replace("### ", ""))}
          </h4>
        );
      }
      if (line.startsWith("## ")) {
        return (
          <h3 key={idx} className="text-lg font-bold text-slate-100 mt-5 mb-2.5 pb-1 border-b border-slate-800">
            {parseBold(line.replace("## ", ""))}
          </h3>
        );
      }
      if (line.startsWith("# ")) {
        return (
          <h2 key={idx} className="text-xl font-extrabold text-indigo-400 mt-6 mb-3">
            {parseBold(line.replace("# ", ""))}
          </h2>
        );
      }

      // Unordered list items (* or -)
      if (line.trim().startsWith("* ") || line.trim().startsWith("- ")) {
        const content = line.trim().substring(2);
        return (
          <li key={idx} className="ml-5 list-disc text-sm text-slate-300 leading-relaxed my-1">
            {parseBold(content)}
          </li>
        );
      }

      // Empty lines
      if (line.trim() === "") {
        return <div key={idx} className="h-2"></div>;
      }

      // Normal paragraphs
      return (
        <p key={idx} className="text-sm text-slate-300 leading-relaxed my-1.5">
          {parseBold(line)}
        </p>
      );
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-6 md:py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">
        {/* Header App Title */}
        <Header />

        {/* Action Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT SIDE: Input text, file upload and controls (7 columns) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-400" />
                  <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
                    Nhập văn bản tiếng Anh
                  </h2>
                </div>
                {inputText && (
                  <button
                    id="btn-clear-text"
                    onClick={handleClear}
                    className="flex items-center gap-1 text-xs text-red-400 font-semibold hover:text-red-300 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Xóa sạch
                  </button>
                )}
              </div>

              {/* Dynamic Read View vs Standard Textarea */}
              {isPlayingSpeak ? (
                <div className="relative border border-amber-900/40 bg-amber-950/20 rounded-xl p-4 min-h-[160px] max-h-[300px] overflow-y-auto">
                  <div className="absolute top-2 right-2 px-2 py-0.5 bg-amber-900/40 text-amber-300 text-[10px] font-bold rounded-md uppercase tracking-wider border border-amber-800/40">
                    Đang Luyện Đọc
                  </div>
                  {renderHighlightedText()}
                </div>
              ) : (
                <textarea
                  id="english-input-area"
                  rows={6}
                  value={inputText}
                  onChange={(e) => handleTextExtracted(e.target.value)}
                  placeholder="Gõ hoặc dán nội dung đoạn văn tiếng Anh của bạn tại đây để dịch và tập đọc..."
                  disabled={isTranslating || isFileExtracting}
                  className="w-full font-serif text-lg leading-relaxed text-slate-200 bg-slate-950 border border-slate-800 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-500 resize-none"
                />
              )}

              {/* File Uploader component */}
              <FileUploader
                onTextExtracted={handleTextExtracted}
                isLoading={isFileExtracting}
                setIsLoading={setIsFileExtracting}
              />

              {/* Main Translate Button */}
              <div className="flex gap-2">
                <button
                  id="btn-trigger-translate"
                  onClick={handleTranslate}
                  disabled={isTranslating || isFileExtracting || !inputText.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/40 text-white font-bold rounded-xl shadow-lg shadow-blue-950/40 disabled:shadow-none hover:scale-[1.01] transition-all cursor-pointer disabled:cursor-not-allowed"
                >
                  {isTranslating ? (
                    <>
                      <RefreshCw className="h-5 w-5 animate-spin" />
                      <span>Gemini đang dịch thuật và phân tích...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5 fill-current" />
                      <span>Dịch song ngữ & Phân tích từ vựng</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Pronunciation TTS Board */}
            {inputText && (
              <TTSPlayer
                text={inputText}
                onHighlightWord={onHighlightWord}
                onResetHighlight={onResetHighlight}
              />
            )}
          </div>

          {/* RIGHT SIDE: Translations & explanations (5 columns) */}
          <div className="lg:col-span-5 space-y-6">
            {isTranslating ? (
              /* Loading Skeleton */
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6 animate-pulse">
                <div className="space-y-2">
                  <div className="h-5 bg-slate-800 rounded w-1/3"></div>
                  <div className="h-3 bg-slate-850 rounded w-3/4"></div>
                </div>

                <div className="space-y-3">
                  <div className="h-4 bg-slate-800 rounded"></div>
                  <div className="h-4 bg-slate-800 rounded"></div>
                  <div className="h-4 bg-slate-800 rounded w-5/6"></div>
                </div>

                <hr className="border-slate-800" />

                <div className="space-y-4">
                  <div className="h-5 bg-slate-800 rounded w-1/2"></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-20 bg-slate-850 rounded-xl"></div>
                    <div className="h-20 bg-slate-850 rounded-xl"></div>
                  </div>
                </div>

                <div className="bg-blue-950/20 p-4 rounded-2xl border border-blue-900/20 space-y-2">
                  <div className="h-3 bg-slate-800 rounded w-2/3"></div>
                  <div className="h-3 bg-slate-850 rounded w-1/2"></div>
                </div>
              </div>
            ) : translationError ? (
              /* Translation error box */
              <div className="bg-red-950/30 border border-red-900/40 rounded-2xl p-6 text-center space-y-3 shadow-xl">
                <div className="p-3 bg-red-900/30 text-red-400 rounded-full inline-block">
                  <Trash2 className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-red-400 text-lg">Không thể dịch thuật</h3>
                <p className="text-sm text-red-300">{translationError}</p>
                <button
                  onClick={handleTranslate}
                  className="px-4 py-2 bg-red-600 text-white font-semibold text-sm rounded-lg hover:bg-red-500 transition-colors"
                >
                  Thử lại
                </button>
              </div>
            ) : translationResult ? (
              /* Render Translation results */
              <div className="space-y-6">
                {/* 1. Vietnamese translation card */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Globe className="h-5 w-5 text-blue-400" />
                      <h3 className="text-sm font-extrabold text-slate-300 uppercase tracking-wider">
                        Bản dịch tiếng Việt (Translation)
                      </h3>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold uppercase tracking-wider">
                      AI Dịch thuật
                    </span>
                  </div>
                  <p className="text-slate-200 leading-relaxed font-sans text-base whitespace-pre-wrap">
                    {translationResult.translation}
                  </p>
                </div>

                {/* 2. Vocabulary extraction flashcards */}
                {translationResult.vocabulary && translationResult.vocabulary.length > 0 && (
                  <VocabularySection vocabulary={translationResult.vocabulary} />
                )}

                {/* 3. Grammar or contextual explain card */}
                {translationResult.analysis && (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                      <Brain className="h-5 w-5 text-indigo-400 animate-pulse" />
                      <h3 className="text-sm font-extrabold text-slate-300 uppercase tracking-wider">
                        Phân tích ngữ pháp & Ngữ cảnh
                      </h3>
                    </div>
                    <div className="prose prose-invert max-w-none text-slate-300">
                      {renderMarkdown(translationResult.analysis)}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* No translation yet screen placeholder */
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-4 shadow-xl flex flex-col items-center justify-center min-h-[300px]">
                <div className="p-4 bg-blue-950/40 text-blue-400 border border-blue-900/30 rounded-full">
                  <BookMarked className="h-8 w-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-slate-200 text-base">Giao diện học tập thông minh</h3>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    Hãy bấm nút <span className="font-semibold text-blue-400">"Dịch song ngữ"</span> ở cột bên trái để Gemini dịch văn bản, phân tích ngữ pháp, và trích lọc từ vựng IPA.
                  </p>
                </div>
                <div className="flex gap-2 text-[10px] text-slate-500 font-medium">
                  <span className="bg-slate-950 border border-slate-800 text-slate-400 px-2 py-1 rounded">Dịch mượt mà</span>
                  <span className="bg-slate-950 border border-slate-800 text-slate-400 px-2 py-1 rounded">IPA chuẩn quốc tế</span>
                  <span className="bg-slate-950 border border-slate-800 text-slate-400 px-2 py-1 rounded">Học ngữ pháp</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
