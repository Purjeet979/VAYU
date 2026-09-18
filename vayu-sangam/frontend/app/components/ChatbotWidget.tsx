"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import AvatarFace from "./AvatarFace";
import { Send, Loader2, RotateCcw, X } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

interface VayuContext {
  currentAQI?: number;
  currentPM25?: number;
  inversionCategory?: string;
  topSource?: string;
  dataMode?: string;
  forecastPeak?: string;
}

// ─── Puter.js model fallback chain ───────────────────────────────────────────
const MODEL_CHAIN = [
  "gemini-3.1-pro-preview",
  "x-ai/grok-4.6",
  "gpt-5.4-nano",
] as const;

// ─── Suggestion chips ────────────────────────────────────────────────────────
const SUGGESTIONS = [
  "What is the current PM2.5?",
  "Explain atmospheric inversion",
  "Which fire sources affect Delhi?",
  "How does the 72-hour forecast work?",
];

// ─── Puter global ────────────────────────────────────────────────────────────
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    puter: any;
  }
}
function getPuter() {
  return typeof window !== "undefined" && window.puter ? window.puter : null;
}

// ─── System prompt ────────────────────────────────────────────────────────────
function buildSystemPrompt(ctx: VayuContext): string {
  const dataSnippet =
    ctx.currentPM25 !== undefined
      ? `
LIVE DATA (fetched from VayuSangam API):
- PM2.5: ${ctx.currentPM25} µg/m³  |  AQI: ${ctx.currentAQI ?? "N/A"}
- Inversion: ${ctx.inversionCategory ?? "Unknown"}
- Top source: ${ctx.topSource ?? "N/A"}
- Mode: ${ctx.dataMode ?? "demo"}
- Forecast peak: ${ctx.forecastPeak ?? "N/A"}`
      : "\nLive data unavailable — backend may be offline.";

  return `You are VayuAI, the intelligent assistant for VayuSangam — a 72-hour coupled air quality and weather forecasting platform for Delhi NCR, India.

STRICT RULE: ONLY answer questions about VayuSangam, Delhi NCR air quality, pollution forecasting, atmospheric science related to the platform, or its tech stack. For ANY off-topic question respond ONLY with: "I'm VayuAI, and I only assist with VayuSangam and Delhi NCR air quality topics."

PLATFORM KNOWLEDGE:
1. VayuSangam delivers 72-hour PM2.5, PM10, O3, AQI forecasts for Delhi NCR
2. Tech: Next.js 14 frontend, FastAPI backend, XGBoost (PM2.5 R²=0.97), NetCDF atmospheric data, CPCB data
3. Features: Forecast timeline, Live Map (fires/HCHO/wind), Source Intelligence, Inversion Detection, What-If Scenarios, SHAP Explainability
4. Data: WRF-Chem (physics), CPCB (ground truth), FIRMS (satellite fires), Tropomi (HCHO)
5. API: /api/forecast, /api/sources, /api/inversion, /api/scenario, /api/explanation, /api/ml/shap
${dataSnippet}

TONE: Friendly, concise, scientifically accurate. Use plain language. Use 🌫️ 🔥 💨 sparingly.`;
}

// ─── Streaming AI with fallback ───────────────────────────────────────────────
async function chatWithFallback(
  messages: Array<{ role: string; content: string }>,
  onToken: (t: string) => void
): Promise<void> {
  const puter = getPuter();
  if (!puter) throw new Error("Puter.js not loaded yet. Please try again in a moment.");

  let lastError: Error | null = null;
  for (const model of MODEL_CHAIN) {
    try {
      const response = await puter.ai.chat(messages, { model, stream: true });
      for await (const part of response) {
        const token =
          part?.text ??
          part?.message?.content?.[0]?.text ??
          part?.choices?.[0]?.delta?.content ??
          "";
        if (token) onToken(token);
      }
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[VayuAI] ${model} failed:`, lastError.message);
    }
  }
  throw lastError ?? new Error("All AI models failed. Please try again.");
}

// ─── Markdown-lite renderer ───────────────────────────────────────────────────
function renderText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return (
      <span key={i}>
        {part.split("\n").map((line, j, arr) => (
          <React.Fragment key={j}>
            {line}
            {j < arr.length - 1 && <br />}
          </React.Fragment>
        ))}
      </span>
    );
  });
}

// ─── Main Widget ──────────────────────────────────────────────────────────────
export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [vayuCtx, setVayuCtx] = useState<VayuContext>({});
  const [ctxLoaded, setCtxLoaded] = useState(false);
  const [puterReady, setPuterReady] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const systemPromptRef = useRef<string>("");

  // Wait for Puter.js
  useEffect(() => {
    const check = () => {
      if (getPuter()) setPuterReady(true);
      else setTimeout(check, 400);
    };
    check();
  }, []);

  // Hide hint after 5s
  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 5000);
    return () => clearTimeout(t);
  }, []);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch live VayuSangam context
  const loadContext = useCallback(async () => {
    if (ctxLoaded) return;
    try {
      const BASE = "";
      const [forecastRes, inversionRes, sourcesRes, healthRes] = await Promise.allSettled([
        fetch(`${BASE}/api/forecast?hours=72`).then((r) => r.json()),
        fetch(`${BASE}/api/inversion?hour=24`).then((r) => r.json()),
        fetch(`${BASE}/api/sources?hour=24`).then((r) => r.json()),
        fetch(`${BASE}/api/health`).then((r) => r.json()),
      ]);
      const ctx: VayuContext = {};
      if (healthRes.status === "fulfilled") ctx.dataMode = healthRes.value?.mode;
      if (forecastRes.status === "fulfilled") {
        const forecast = forecastRes.value?.forecast ?? [];
        if (forecast.length > 0) {
          const h24 = forecast.find((f: { hour?: number }) => f.hour === 24) ?? forecast[0];
          ctx.currentPM25 = Math.round(h24.pm25_ug_m3 ?? 0);
          ctx.currentAQI = Math.round(h24.aqi ?? 0);
          const peak = forecast.reduce(
            (mx: { aqi: number; timestamp: string }, f: { aqi: number; timestamp: string }) =>
              f.aqi > mx.aqi ? f : mx,
            forecast[0]
          );
          ctx.forecastPeak = `AQI ${Math.round(peak.aqi)} at ${peak.timestamp}`;
        }
      }
      if (inversionRes.status === "fulfilled") ctx.inversionCategory = inversionRes.value?.category;
      if (sourcesRes.status === "fulfilled") {
        const src = (sourcesRes.value?.sources ?? [])[0];
        if (src) ctx.topSource = `Cluster at (${src.centroid_lat?.toFixed(2)}, ${src.centroid_lon?.toFixed(2)}) FRP ${src.total_frp?.toFixed(0)} MW`;
      }
      setVayuCtx(ctx);
      systemPromptRef.current = buildSystemPrompt(ctx);
      setCtxLoaded(true);
    } catch {
      systemPromptRef.current = buildSystemPrompt({});
      setCtxLoaded(true);
    }
  }, [ctxLoaded]);

  // Open chat
  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setShowHint(false);
    loadContext();
    if (messages.length === 0) {
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: "👋 Hi! I'm **VayuAI** — your guide to VayuSangam, Delhi NCR's 72-hour air quality platform.\n\nAsk me about PM2.5 forecasts, pollution sources, inversions, or the what-if scenario tool! 🌫️",
      }]);
    }
    setTimeout(() => inputRef.current?.focus(), 350);
  }, [loadContext, messages.length]);

  // Send message
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text.trim() };
    const assistantId = `a-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: "assistant", content: "", isStreaming: true },
    ]);
    setInput("");
    setIsLoading(true);
    setIsSpeaking(true);

    const history = [
      { role: "system", content: systemPromptRef.current || buildSystemPrompt(vayuCtx) },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: text.trim() },
    ];

    try {
      let accumulated = "";
      await chatWithFallback(history, (token) => {
        accumulated += token;
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, content: accumulated } : m)
        );
      });
      setMessages((prev) =>
        prev.map((m) => m.id === assistantId ? { ...m, isStreaming: false } : m)
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setMessages((prev) =>
        prev.map((m) => m.id === assistantId ? { ...m, content: `⚠️ ${msg}`, isStreaming: false } : m)
      );
    } finally {
      setIsLoading(false);
      setIsSpeaking(false);
    }
  }, [isLoading, messages, vayuCtx]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const resetChat = () => {
    setMessages([{
      id: "reset",
      role: "assistant",
      content: "👋 Conversation reset! Ask me anything about VayuSangam. 🌫️",
    }]);
  };

  // Character: viewBox 100×200 → display at width=150, height proportional
  const [charW, setCharW] = useState(150);

  useEffect(() => {
    const handleResize = () => {
      setCharW(window.innerWidth < 768 ? 100 : 150);
    };
    handleResize(); // Set initial size
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const CHAR_W = charW;
  const CHAR_H = CHAR_W * 2;

  return (
    <>
      <style>{`
        @keyframes vs-slide-in {
          from { opacity: 0; transform: translateX(20px) scale(0.97); }
          to   { opacity: 1; transform: translateX(0)    scale(1); }
        }
        @keyframes vs-hint-bob {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-4px); }
        }
        @keyframes vs-char-idle {
          0%, 100% { transform: rotate(0deg); }
          30%       { transform: rotate(0.8deg); }
          70%       { transform: rotate(-0.8deg); }
        }
        @keyframes vs-char-speak {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-3px); }
        }
        @keyframes vs-dot-bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40%            { transform: translateY(-5px); }
        }
        @keyframes vs-cursor-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }

        .vs-char {
          cursor: pointer;
          transform-origin: bottom center;
          animation: vs-char-idle 4s ease-in-out infinite;
          transition: filter 0.25s;
        }
        .vs-char:hover {
          filter: drop-shadow(0 0 12px rgba(0,212,255,0.55));
        }
        .vs-char.speaking {
          animation: vs-char-speak 0.45s ease-in-out infinite;
        }

        .vs-hint {
          animation: vs-hint-bob 2s ease-in-out infinite;
        }

        .vs-panel {
          animation: vs-slide-in 0.28s cubic-bezier(0.34,1.56,0.64,1) forwards;
          background: rgba(10, 13, 20, 0.96);
          backdrop-filter: blur(22px);
          -webkit-backdrop-filter: blur(22px);
          border: 1px solid rgba(0,212,255,0.2);
          box-shadow: -8px 8px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,212,255,0.07);
        }

        .vs-msg-bot  { background: linear-gradient(135deg,#1a2744,#131821); border:1px solid #1f3a5f; }
        .vs-msg-user { background: linear-gradient(135deg,#0e4166,#0a2d47); border:1px solid #1a5a88; }

        .vs-input {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(0,212,255,0.22);
          color: #f3f4f6;
          transition: border-color 0.2s;
        }
        .vs-input:focus {
          outline: none;
          border-color: rgba(0,212,255,0.6);
          box-shadow: 0 0 0 2px rgba(0,212,255,0.12);
        }
        .vs-input::placeholder { color: rgba(156,163,175,0.55); }

        .vs-send {
          background: linear-gradient(135deg,#00d4ff,#0077cc);
          transition: opacity 0.2s, transform 0.15s;
        }
        .vs-send:hover:not(:disabled) { opacity: 0.85; transform: scale(1.06); }
        .vs-send:disabled { opacity: 0.3; cursor: not-allowed; }

        .vs-chip {
          background: rgba(0,212,255,0.07);
          border: 1px solid rgba(0,212,255,0.2);
          color: rgba(0,212,255,0.85);
          transition: background 0.15s;
          cursor: pointer;
          white-space: nowrap;
        }
        .vs-chip:hover { background: rgba(0,212,255,0.15); }

        .vs-dot-1 { animation: vs-dot-bounce 1.2s ease-in-out infinite 0s; }
        .vs-dot-2 { animation: vs-dot-bounce 1.2s ease-in-out infinite 0.2s; }
        .vs-dot-3 { animation: vs-dot-bounce 1.2s ease-in-out infinite 0.4s; }

        .vs-cursor { animation: vs-cursor-blink 0.8s ease-in-out infinite; }

        .vs-scroll::-webkit-scrollbar { width: 4px; }
        .vs-scroll::-webkit-scrollbar-track { background: transparent; }
        .vs-scroll::-webkit-scrollbar-thumb { background: rgba(0,212,255,0.2); border-radius: 9999px; }
      `}</style>

      {/* ══════════════════════════════════════════════════════════════════
          ROOT — fixed wrapper, bottom-right, character + panel side by side
      ══════════════════════════════════════════════════════════════════ */}
      <div
        className="fixed z-[9999] flex items-end"
        style={{ bottom: 0, right: 12 }}
      >
        {/* ── Chat Panel (left of character, slides in) ── */}
        {isOpen && (
          <div
            className={`vs-panel rounded-2xl flex flex-col ${charW < 150 ? 'fixed bottom-4 right-3 left-3 shadow-2xl z-[10000]' : 'mr-2 mb-2'}`}
            style={
              charW < 150
                ? {
                    height: "85vh",
                  }
                : {
                    width: 360,
                    height: 520,
                    maxWidth: "calc(100vw - 140px)",
                    maxHeight: "calc(100vh - 80px)",
                  }
            }
          >
            {/* Header */}
            <div
              className="flex-shrink-0 flex items-center gap-2.5 px-3.5 py-2.5"
              style={{
                background: "linear-gradient(135deg,rgba(0,180,216,0.12),rgba(0,100,160,0.08))",
                borderBottom: "1px solid rgba(0,212,255,0.14)",
              }}
            >
              {/* Tiny character in header */}
              <div
                className="flex-shrink-0 rounded-lg overflow-hidden"
                style={{
                  background: "rgba(0,212,255,0.06)",
                  border: isSpeaking ? "1.5px solid rgba(0,212,255,0.7)" : "1.5px solid rgba(0,212,255,0.22)",
                  boxShadow: isSpeaking ? "0 0 12px rgba(0,212,255,0.35)" : "none",
                  padding: "1px 3px 0",
                  transition: "all 0.3s",
                }}
              >
                <AvatarFace isSpeaking={isSpeaking} size={44} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-white font-bold text-sm flex items-center gap-1.5">
                  VayuAI
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                    style={{ background: "rgba(0,212,255,0.15)", color: "#00d4ff" }}
                  >
                    AI
                  </span>
                </div>
                <div className="text-[11px]" style={{ color: "rgba(156,163,175,0.75)" }}>
                  {isSpeaking ? "Speaking…" : isLoading ? "Thinking…" : puterReady ? "VayuSangam Assistant" : "Loading AI…"}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={resetChat}
                  title="Reset"
                  className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ color: "rgba(156,163,175,0.6)" }}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  title="Close"
                  className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ color: "rgba(156,163,175,0.6)" }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="vs-scroll flex-1 overflow-y-auto px-3 py-3 space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                >
                  <div
                    className={`rounded-2xl px-3 py-2 text-sm leading-relaxed max-w-[85%] ${
                      msg.role === "user"
                        ? "vs-msg-user text-blue-50 rounded-tr-sm"
                        : "vs-msg-bot text-gray-100 rounded-tl-sm"
                    }`}
                  >
                    {msg.content ? (
                      renderText(msg.content)
                    ) : (
                      <div className="flex items-center gap-1.5 py-0.5 px-1">
                        <span className="vs-dot-1 w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
                        <span className="vs-dot-2 w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
                        <span className="vs-dot-3 w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
                      </div>
                    )}
                    {msg.isStreaming && msg.content && (
                      <span className="vs-cursor inline-block w-0.5 h-3.5 bg-cyan-400 ml-0.5 align-middle" />
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Suggestion chips */}
            {messages.filter((m) => m.role === "user").length === 0 && !isLoading && (
              <div className="flex-shrink-0 px-3 pb-2">
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => sendMessage(s)} className="vs-chip text-[11px] px-2.5 py-1 rounded-full font-medium">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div
              className="flex-shrink-0 flex items-center gap-2 px-3 py-2.5"
              style={{ borderTop: "1px solid rgba(0,212,255,0.1)" }}
            >
              <input
                ref={inputRef}
                id="vayu-chat-input"
                className="vs-input flex-1 rounded-xl px-3.5 py-2 text-sm"
                placeholder={puterReady ? "Ask about air quality…" : "Loading AI…"}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading || !puterReady}
                autoComplete="off"
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={isLoading || !puterReady || !input.trim()}
                className="vs-send w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                id="vayu-chat-send"
              >
                {isLoading
                  ? <Loader2 className="w-4 h-4 text-white animate-spin" />
                  : <Send className="w-4 h-4 text-white" />
                }
              </button>
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 text-center text-[10px] pb-1.5" style={{ color: "rgba(107,114,128,0.5)" }}>
              Powered by Puter.js · VayuSangam only
            </div>
          </div>
        )}

        {/* ── Standing Character ── */}
        <div className="flex flex-col items-center flex-shrink-0" style={{ width: CHAR_W }}>

          {/* Hint bubble above character (before first click) */}
          {showHint && !isOpen && (
            <div
              className="vs-hint mb-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-white whitespace-nowrap"
              style={{
                background: "rgba(0,212,255,0.18)",
                border: "1px solid rgba(0,212,255,0.35)",
                backdropFilter: "blur(8px)",
                boxShadow: "0 2px 12px rgba(0,212,255,0.2)",
              }}
            >
              💬 Ask me!
            </div>
          )}

          {/* Speech bubble when chat is open (replaces hint) */}
          {isOpen && isSpeaking && (
            <div
              className="mb-1 px-2.5 py-1 rounded-xl text-[11px] font-medium text-cyan-300 whitespace-nowrap"
              style={{
                background: "rgba(0,212,255,0.1)",
                border: "1px solid rgba(0,212,255,0.25)",
              }}
            >
              Speaking…
            </div>
          )}

          {/* The character SVG — clickable, physically standing */}
          <div
            id="vayu-chatbot-toggle"
            role="button"
            tabIndex={0}
            aria-label="Open VayuAI assistant"
            onClick={isOpen ? () => setIsOpen(false) : handleOpen}
            onKeyDown={(e) => e.key === "Enter" && (isOpen ? setIsOpen(false) : handleOpen())}
            className={`vs-char ${isSpeaking ? "speaking" : ""}`}
            style={{ width: CHAR_W, height: CHAR_H }}
          >
            <AvatarFace isSpeaking={isSpeaking} size={CHAR_W} />
          </div>
        </div>
      </div>
    </>
  );
}
