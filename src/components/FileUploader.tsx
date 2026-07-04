import React, { useState, useRef } from "react";
import { Upload, FileText, Loader2, AlertCircle, CheckCircle } from "lucide-react";

interface FileUploaderProps {
  onTextExtracted: (text: string) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export default function FileUploader({
  onTextExtracted,
  isLoading,
  setIsLoading,
}: FileUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setError(null);
    setSuccess(null);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        // Strip out the data url scheme prefix (e.g. "data:application/pdf;base64,")
        const base64String = (reader.result as string).split(",")[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const processFile = async (file: File) => {
    const extension = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    const validExtensions = [".txt", ".pdf", ".docx"];

    if (!validExtensions.includes(extension)) {
      setError("Định dạng file không hỗ trợ. Chỉ nhận .txt, .pdf, .docx");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (extension === ".txt") {
        // Process text client-side
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          onTextExtracted(text);
          setSuccess(`Trích xuất thành công từ: ${file.name}`);
          setIsLoading(false);
        };
        reader.onerror = () => {
          throw new Error("Không thể đọc file văn bản.");
        };
        reader.readAsText(file);
      } else {
        // Process PDF or DOCX server-side
        const base64 = await convertToBase64(file);
        const response = await fetch("/api/extract-text", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fileBase64: base64,
            fileName: file.name,
            fileType: file.type,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Lỗi giải mã file trên máy chủ.");
        }

        if (!data.text || data.text.trim() === "") {
          throw new Error("Không tìm thấy nội dung văn bản nào trong tài liệu.");
        }

        onTextExtracted(data.text);
        setSuccess(`Đã trích xuất ${data.text.length} ký tự từ file: ${file.name}`);
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Đã xảy ra lỗi khi xử lý file.");
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div
        id="drag-drop-zone"
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={onButtonClick}
        className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 md:p-8 text-center cursor-pointer transition-all duration-300 ${
          dragActive
            ? "border-blue-500 bg-blue-950/30"
            : "border-slate-800 hover:border-blue-500 hover:bg-slate-900/30 bg-slate-900/20"
        } ${isLoading ? "pointer-events-none opacity-60" : ""}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".txt,.pdf,.docx"
          onChange={handleChange}
          disabled={isLoading}
        />

        {isLoading ? (
          <div className="flex flex-col items-center space-y-3">
            <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
            <p className="text-sm font-medium text-slate-300">
              Đang phân tích và giải mã tệp tài liệu...
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-2">
            <div className="p-3 bg-blue-950/50 rounded-full text-blue-400 border border-blue-900/30 mb-2">
              <Upload className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-slate-300">
              Kéo thả tệp hoặc <span className="text-blue-400 font-semibold underline">chọn tệp từ thiết bị</span>
            </p>
            <p className="text-xs text-slate-500">
              Hỗ trợ: .txt, .pdf, .docx (tự động trích xuất nội dung)
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 text-xs text-red-400 bg-red-950/30 p-3 rounded-lg border border-red-900/40 animate-fadeIn">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mt-3 flex items-center gap-2 text-xs text-blue-400 bg-blue-950/30 p-3 rounded-lg border border-blue-900/40 animate-fadeIn">
          <CheckCircle className="h-4 w-4 shrink-0 text-blue-500" />
          <span>{success}</span>
        </div>
      )}
    </div>
  );
}
