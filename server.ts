import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Increase body limit to handle PDF/DOCX file uploads in base64
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Initialize Google Gen AI SDK lazily
let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// 1. Text Extraction Endpoint for PDF & DOCX
app.post("/api/extract-text", async (req, res) => {
  try {
    const { fileBase64, fileName, fileType } = req.body;

    if (!fileBase64) {
      return res.status(400).json({ error: "Missing file data" });
    }

    let text = "";

    if (fileName.endsWith(".pdf") || fileType === "application/pdf") {
      // Use Gemini Multimodal API to extract text from PDF cleanly with zero server dependencies
      const response = await getAI().models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          {
            inlineData: {
              mimeType: "application/pdf",
              data: fileBase64,
            },
          },
          "Extract and return all the text from this PDF document. Keep the exact content of the document, do not add any extra text or summary. Return only the extracted text of the PDF.",
        ],
      });
      text = response.text || "";
    } else if (
      fileName.endsWith(".docx") ||
      fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const mammoth = await import("mammoth");
      const buffer = Buffer.from(fileBase64, "base64");
      const docxData = await mammoth.default.extractRawText({ buffer });
      text = docxData.value;
    } else {
      // Fallback for txt or other raw text files
      const buffer = Buffer.from(fileBase64, "base64");
      text = buffer.toString("utf-8");
    }

    res.json({ text: text.trim() });
  } catch (error: any) {
    console.error("Error extracting text:", error);
    res.status(500).json({ error: error.message || "Failed to extract text from file." });
  }
});

// 2. Translate & Explain English Learning API Route
app.post("/api/translate", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim() === "") {
      return res.status(400).json({ error: "No text provided for translation" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured. Please add it to your secrets.",
      });
    }

    const response = await getAI().models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Translate the following English text to natural, contextual Vietnamese. Also analyze it for an English learner.
English text:
"""
${text}
"""`,
      config: {
        systemInstruction: `You are an expert English-Vietnamese translator and English learning mentor. 
Translate the text to elegant, contextual, and natural Vietnamese.
In addition, extract key vocabulary words (up to 5 or 6 important words or idioms) with their word type, IPA phonetic symbols, Vietnamese meaning, and an example sentence.
Also provide a brief learning analysis explaining any noteworthy grammatical structures, idioms, or cultural context.
Respond STRICTLY with a valid JSON object matching this schema:
{
  "translation": "Sự dịch nghĩa tiếng Việt tự nhiên và mượt mà nhất...",
  "analysis": "Phân tích ngữ pháp hoặc giải thích ngữ cảnh chi tiết (dùng Markdown để định dạng)...",
  "vocabulary": [
    {
      "word": "English word",
      "type": "noun/verb/adjective/idiom...",
      "phonetic": "/IPA phonetic symbols/",
      "meaning": "Nghĩa tiếng Việt",
      "example": "English example sentence."
    }
  ]
}`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["translation", "analysis", "vocabulary"],
          properties: {
            translation: {
              type: Type.STRING,
              description: "The complete natural Vietnamese translation of the source English text.",
            },
            analysis: {
              type: Type.STRING,
              description: "Grammar, idiom, or usage analysis in Vietnamese. Supports markdown formatting.",
            },
            vocabulary: {
              type: Type.ARRAY,
              description: "A list of selected key words or idioms with learning details.",
              items: {
                type: Type.OBJECT,
                required: ["word", "type", "phonetic", "meaning", "example"],
                properties: {
                  word: { type: Type.STRING, description: "The English word or idiom." },
                  type: { type: Type.STRING, description: "Part of speech, e.g., 'verb', 'noun', 'phrasal verb'." },
                  phonetic: { type: Type.STRING, description: "Phonetic IPA string, e.g. /æbˈstɹækt/." },
                  meaning: { type: Type.STRING, description: "Vietnamese meaning." },
                  example: { type: Type.STRING, description: "An example English sentence using this word." },
                },
              },
            },
          },
        },
      },
    });

    const jsonText = response.text?.trim() || "{}";
    const result = JSON.parse(jsonText);
    res.json(result);
  } catch (error: any) {
    console.error("Error translating text:", error);
    res.status(500).json({ error: error.message || "Failed to translate and analyze text." });
  }
});

// 3. Premium Google Gemini AI Text-To-Speech Endpoint
app.post("/api/tts", async (req, res) => {
  try {
    const { text, voice } = req.body;
    if (!text || text.trim() === "") {
      return res.status(400).json({ error: "No text provided for TTS" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured. Please add it to your secrets.",
      });
    }

    // Supported voices: Puck, Charon, Kore, Fenrir, Zephyr
    const selectedVoice = voice || "Kore";

    const response = await getAI().models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: selectedVoice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      throw new Error("Failed to generate audio from Gemini TTS model");
    }

    res.json({ audio: base64Audio });
  } catch (error: any) {
    console.error("Error in TTS:", error);
    res.status(500).json({ error: error.message || "Failed to generate TTS audio." });
  }
});

// Vite Middleware Setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite Middleware...");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error("Failed to start server:", err);
  });
}

export default app;
