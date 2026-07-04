import React from "react";
import { GraduationCap, Sparkles, BookOpen } from "lucide-react";

export default function Header() {
  return (
    <header className="relative overflow-hidden bg-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-800">
      {/* Visual glowing accents */}
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800/80 rounded-full border border-slate-700/60 text-xs text-blue-400 font-medium">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Trợ Lý Ngôn Ngữ AI Cao Cấp</span>
          </div>

          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-300">
            Trợ Lý Học Tiếng Anh & Phiên Dịch
          </h1>
          <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
            Dịch song ngữ chính xác theo ngữ cảnh nhờ trí tuệ nhân tạo Gemini. Luyện nghe phát âm với giọng đọc người bản xứ chuẩn mực, phân tích từ vựng trọng tâm IPA và điểm ngữ pháp tiện lợi.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-center bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
          <GraduationCap className="h-10 w-10 text-blue-400 shrink-0" />
          <div>
            <p className="text-xs text-slate-400 font-semibold">Tối Ưu Cho Học Tập</p>
            <p className="text-xs font-bold text-slate-200">Hỗ trợ PDF, DOCX và Word</p>
          </div>
        </div>
      </div>
    </header>
  );
}
