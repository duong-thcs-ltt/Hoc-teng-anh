import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, Square, Volume2, Download, Sparkles, HelpCircle, RefreshCw } from "lucide-react";
import { ReadMode } from "../types";

// Helper function to add standard 44-byte WAV header to raw 24kHz 16-bit Mono PCM audio
function addWavHeader(pcmBytes: Uint8Array, sampleRate: number = 24000): Uint8Array {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  // RIFF identifier
  view.setUint32(0, 0x52494646, false); // "RIFF" in big-endian
  // File length minus RIFF/WAVE header size (8 bytes)
  view.setUint32(4, 36 + pcmBytes.length, true); // little-endian
  // WAVE identifier
  view.setUint32(8, 0x57415645, false); // "WAVE" in big-endian
  // Chunk identifier "fmt "
  view.setUint32(12, 0x666d7420, false); // "fmt " in big-endian
  // Subchunk1Size (16 for PCM)
  view.setUint32(16, 16, true);
  // AudioFormat (1 for PCM)
  view.setUint16(20, 1, true);
  // NumChannels (1 for mono)
  view.setUint16(22, 1, true);
  // SampleRate
  view.setUint32(24, sampleRate, true);
  // ByteRate (SampleRate * NumChannels * BitsPerSample/8) = 24000 * 1 * 2 = 48000
  view.setUint32(28, sampleRate * 1 * 2, true);
  // BlockAlign (NumChannels * BitsPerSample/8) = 2
  view.setUint16(32, 2, true);
  // BitsPerSample (16)
  view.setUint16(34, 16, true);
  // Chunk identifier "data"
  view.setUint32(36, 0x64617461, false); // "data" in big-endian
  // Subchunk2Size (PCM data length)
  view.setUint32(40, pcmBytes.length, true);

  // Combine header and PCM data
  const wavBytes = new Uint8Array(44 + pcmBytes.length);
  wavBytes.set(new Uint8Array(header), 0);
  wavBytes.set(pcmBytes, 44);

  return wavBytes;
}

interface TTSPlayerProps {
  text: string;
  onHighlightWord?: (startIndex: number, length: number) => void;
  onResetHighlight?: () => void;
}

export default function TTSPlayer({
  text,
  onHighlightWord,
  onResetHighlight,
}: TTSPlayerProps) {
  // TTS State
  const [readMode, setReadMode] = useState<ReadMode>("browser");
  const [rate, setRate] = useState<number>(0); // slider -50% to +50%, mapped to 0.5 - 1.5 in browser or edge-tts
  const [pitch, setPitch] = useState<number>(1); // browser only: 0.5 - 2
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Browser voices list
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedBrowserVoice, setSelectedBrowserVoice] = useState<string>("");

  // Gemini neural TTS voices
  const geminiVoices = [
    { name: "Kore", description: "Giọng Nữ - Trong trẻo, chuẩn quốc tế" },
    { name: "Zephyr", description: "Giọng Nam - Ấm áp, chuyên nghiệp" },
    { name: "Fenrir", description: "Giọng Nam - Trầm ấm, uy quyền" },
    { name: "Puck", description: "Giọng Nam - Vui vẻ, thân thiện" },
    { name: "Charon", description: "Giọng Nữ - Nhẹ nhàng, truyền cảm" },
  ];
  const [selectedGeminiVoice, setSelectedGeminiVoice] = useState<string>("Kore");
  const [isGeneratingGeminiAudio, setIsGeneratingGeminiAudio] = useState<boolean>(false);
  const [geminiAudioUrl, setGeminiAudioUrl] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Initialize browser speech synthesis voices
  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      synthRef.current = window.speechSynthesis;

      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        // Filter for English voices (en-US, en-GB, en-AU, en-CA etc.)
        const enVoices = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
        setBrowserVoices(enVoices);

        if (enVoices.length > 0) {
          // Select Google US English or Microsoft Aria or just the first available English voice
          const defaultVoice =
            enVoices.find(
              (v) =>
                v.name.includes("Google") ||
                v.name.includes("Natural") ||
                v.name.includes("Aria") ||
                v.name.includes("Zira")
            ) || enVoices[0];
          setSelectedBrowserVoice(defaultVoice.name);
        }
      };

      loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }

    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  // Sync rate mapping
  // rate goes from -50 (representing -50%) to 50 (representing +50%)
  // mapped rate: -50% is 0.5x, 0% is 1.0x, +50% is 1.5x speed
  const getSpeedMultiplier = () => {
    return 1 + rate / 100;
  };

  // 1. Browser TTS speak
  const speakBrowser = () => {
    if (!synthRef.current) return;

    if (isSpeaking && isPaused) {
      synthRef.current.resume();
      setIsPaused(false);
      return;
    }

    // Stop anything currently speaking
    synthRef.current.cancel();

    if (!text || text.trim() === "") return;

    const utterance = new SpeechSynthesisUtterance(text);
    const selectedVoiceObj = browserVoices.find((v) => v.name === selectedBrowserVoice);
    if (selectedVoiceObj) {
      utterance.voice = selectedVoiceObj;
    }

    utterance.rate = getSpeedMultiplier();
    utterance.pitch = pitch;

    // Word highlighting handler using standard SpeechSynthesis boundary event
    utterance.onboundary = (event) => {
      if (event.name === "word" && onHighlightWord) {
        const charIndex = event.charIndex;
        // Find length of the current word
        const remainingText = text.substring(charIndex);
        const nextSpace = remainingText.search(/[\s,.:;?!"'()]/);
        const length = nextSpace === -1 ? remainingText.length : nextSpace;
        onHighlightWord(charIndex, length);
      }
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
      if (onResetHighlight) onResetHighlight();
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setIsPaused(false);
      if (onResetHighlight) onResetHighlight();
    };

    utteranceRef.current = utterance;
    setIsSpeaking(true);
    setIsPaused(false);
    synthRef.current.speak(utterance);
  };

  const pauseBrowser = () => {
    if (synthRef.current && isSpeaking) {
      synthRef.current.pause();
      setIsPaused(true);
    }
  };

  const stopBrowser = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
      setIsPaused(false);
      if (onResetHighlight) onResetHighlight();
    }
  };

  // 2. Gemini Neural TTS Generation
  const generateGeminiAudio = async () => {
    if (!text || text.trim() === "") return;

    setIsGeneratingGeminiAudio(true);
    setGeminiAudioUrl(null);

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: text,
          voice: selectedGeminiVoice,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Không thể tạo giọng đọc AI.");
      }

      // Convert base64 audio to object URL for playback
      const base64Data = data.audio;
      const binaryString = window.atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Gemini TTS output is raw PCM. We add a standard WAV header so browsers can decode and play it natively
      const wavBytes = addWavHeader(bytes, 24000);
      const blob = new Blob([wavBytes], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      setGeminiAudioUrl(url);

      // Play immediately
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.playbackRate = getSpeedMultiplier();
          audioRef.current.play();
          setIsSpeaking(true);
          setIsPaused(false);
        }
      }, 100);
    } catch (error: any) {
      console.error(error);
      alert("Lỗi tạo giọng đọc AI: " + (error.message || "Không thể kết nối máy chủ."));
    } finally {
      setIsGeneratingGeminiAudio(false);
    }
  };

  // Gemini Audio Event Listeners
  const playGeminiAudio = () => {
    if (audioRef.current) {
      audioRef.current.playbackRate = getSpeedMultiplier();
      audioRef.current.play();
      setIsSpeaking(true);
      setIsPaused(false);
    }
  };

  const pauseGeminiAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPaused(true);
    }
  };

  const stopGeminiAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsSpeaking(false);
      setIsPaused(false);
    }
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = getSpeedMultiplier();
    }
  }, [rate]);

  // Clean stop when changing modes
  const handleModeChange = (mode: ReadMode) => {
    // stop current playback
    if (readMode === "browser") {
      stopBrowser();
    } else {
      stopGeminiAudio();
    }
    setReadMode(mode);
  };

  const handleGlobalStop = () => {
    if (readMode === "browser") {
      stopBrowser();
    } else {
      stopGeminiAudio();
    }
  };

  const handleGlobalPlayPause = () => {
    if (readMode === "browser") {
      if (isSpeaking && !isPaused) {
        pauseBrowser();
      } else {
        speakBrowser();
      }
    } else {
      // Gemini mode
      if (geminiAudioUrl) {
        if (isSpeaking && !isPaused) {
          pauseGeminiAudio();
        } else {
          playGeminiAudio();
        }
      } else {
        generateGeminiAudio();
      }
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
      {/* Read Mode Tabs */}
      <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
        <button
          id="tab-browser-tts"
          onClick={() => handleModeChange("browser")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs md:text-sm font-semibold rounded-lg transition-all ${
            readMode === "browser"
              ? "bg-slate-800 text-slate-200 shadow-sm"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <Volume2 className="h-4 w-4 text-blue-400" />
          Trình đọc Trực tiếp (Browser)
        </button>
        <button
          id="tab-gemini-tts"
          onClick={() => handleModeChange("gemini")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs md:text-sm font-semibold rounded-lg transition-all ${
            readMode === "gemini"
              ? "bg-slate-800 text-slate-200 shadow-sm"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <Sparkles className="h-4 w-4 text-indigo-400" />
          Giọng đọc AI Cao cấp (Gemini)
        </button>
      </div>

      {/* Voice configuration fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {readMode === "browser" ? (
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Chọn giọng người bản xứ (Browser)
            </label>
            {browserVoices.length > 0 ? (
              <select
                id="voice-select-browser"
                value={selectedBrowserVoice}
                onChange={(e) => {
                  stopBrowser();
                  setSelectedBrowserVoice(e.target.value);
                }}
                className="w-full text-sm bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-300"
              >
                {browserVoices.map((voice) => (
                  <option key={voice.name} value={voice.name} className="bg-slate-900 text-slate-300">
                    {voice.name} ({voice.lang})
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-xs text-amber-400 bg-amber-950/20 p-2.5 rounded-lg border border-amber-900/40 flex items-center gap-1.5">
                <HelpCircle className="h-4 w-4 shrink-0" />
                Không tìm thấy giọng nói Tiếng Anh trên trình duyệt của bạn. Hệ thống sẽ sử dụng giọng mặc định.
              </div>
            )}
          </div>
        ) : (
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Chọn nhân vật đọc AI (Expressive Neural)
            </label>
            <select
              id="voice-select-gemini"
              value={selectedGeminiVoice}
              onChange={(e) => {
                stopGeminiAudio();
                setGeminiAudioUrl(null);
                setSelectedGeminiVoice(e.target.value);
              }}
              className="w-full text-sm bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-300"
            >
              {geminiVoices.map((voice) => (
                <option key={voice.name} value={voice.name} className="bg-slate-900 text-slate-300">
                  {voice.name} — {voice.description}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Speed Slider */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Tốc độ đọc (Rate)
            </label>
            <span className="text-xs font-bold text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded-md">
              {rate >= 0 ? `+${rate}%` : `${rate}%`}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-slate-500 font-medium">Chậm</span>
            <input
              id="rate-slider"
              type="range"
              min="-50"
              max="50"
              step="5"
              value={rate}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setRate(val);
                if (readMode === "browser" && isSpeaking) {
                  // restart to apply rate in browser synthesis immediately
                  setTimeout(() => speakBrowser(), 50);
                }
              }}
              className="flex-1 accent-blue-500 h-1.5 bg-slate-850 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-[10px] text-slate-500 font-medium">Nhanh</span>
          </div>
        </div>
      </div>

      {/* Unified Playback Action Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2 shrink-0">
          {/* Main Play/Pause Button */}
          <button
            id="btn-speak-play"
            onClick={handleGlobalPlayPause}
            disabled={readMode === "gemini" && isGeneratingGeminiAudio}
            className={`flex items-center gap-2 py-2 px-4 rounded-lg font-semibold text-sm shadow-sm transition-all ${
              isSpeaking && !isPaused
                ? "bg-amber-600 hover:bg-amber-500 text-white"
                : readMode === "browser"
                ? "bg-blue-600 text-white hover:bg-blue-500"
                : "bg-indigo-600 text-white hover:bg-indigo-500"
            } disabled:opacity-50`}
          >
            {readMode === "gemini" && isGeneratingGeminiAudio ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Đang tổng hợp...
              </>
            ) : isSpeaking && !isPaused ? (
              <>
                <Pause className="h-4 w-4" />
                Tạm dừng
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-current" />
                {readMode === "browser"
                  ? "Đọc văn bản"
                  : geminiAudioUrl
                  ? "Phát lại âm thanh"
                  : "🎧 Phát giọng AI"}
              </>
            )}
          </button>

          {/* Stop Button */}
          {(isSpeaking || isPaused) && (
            <button
              id="btn-speak-stop"
              onClick={handleGlobalStop}
              className="p-2 bg-red-950/45 text-red-400 border border-red-900/50 hover:bg-red-900/30 rounded-lg transition-colors"
              title="Dừng"
            >
              <Square className="h-4 w-4 fill-current" />
            </button>
          )}

          {/* Gemini Force Regenerate Button */}
          {readMode === "gemini" && geminiAudioUrl && !isGeneratingGeminiAudio && (
            <button
              id="btn-speak-regenerate"
              onClick={generateGeminiAudio}
              className="p-2 bg-indigo-950/45 text-indigo-400 border border-indigo-900/50 hover:bg-indigo-900/30 rounded-lg transition-colors text-xs font-semibold flex items-center gap-1"
              title="Tạo lại âm thanh mới"
            >
              <RefreshCw className="h-4 w-4" />
              Tạo lại
            </button>
          )}
        </div>

        {/* Informative Status Badge */}
        <div className="flex-1 text-center sm:text-left">
          {readMode === "browser" ? (
            <p className="text-xs text-slate-400">
              💡 <span className="font-semibold text-blue-400">Trình đọc trực tiếp</span> tự động làm nổi bật từ đang đọc trên khung văn bản phía trên.
            </p>
          ) : isGeneratingGeminiAudio ? (
            <p className="text-xs text-indigo-400 animate-pulse font-medium">
              ✨ Gemini đang vẽ nên giọng nói sinh động... Vui lòng chờ vài giây.
            </p>
          ) : geminiAudioUrl ? (
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-slate-400 flex items-center gap-1">
                🎉 Đã tạo âm thanh AI thành công!
              </span>
              <a
                id="btn-download-audio"
                href={geminiAudioUrl}
                download={`pronunciation_${selectedGeminiVoice}.wav`}
                className="flex items-center gap-1 text-xs text-indigo-400 font-semibold hover:underline"
              >
                <Download className="h-3.5 w-3.5" />
                Tải xuống MP3/WAV
              </a>
            </div>
          ) : (
            <p className="text-xs text-slate-400">
              🤖 <span className="font-semibold text-indigo-400">Giọng đọc AI</span> phân tích và thổi hồn cảm xúc thực tế từ mô hình Gemini TTS cao cấp.
            </p>
          )}
        </div>
      </div>

      {/* Hidden Native Audio Element for Gemini AI Audio Playback */}
      <audio
        ref={audioRef}
        src={geminiAudioUrl || undefined}
        className="hidden"
        onEnded={() => {
          setIsSpeaking(false);
          setIsPaused(false);
        }}
        onError={(e) => {
          console.error("Audio playback error event:", e);
          setIsSpeaking(false);
          setIsPaused(false);
        }}
      />
    </div>
  );
}
