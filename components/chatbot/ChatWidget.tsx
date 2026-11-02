"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  MessageCircle,
  X,
  Send,
  Bot,
  User,
  Loader2,
  Minimize2,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
} from "lucide-react";

import type { ChatMessage } from "@/types";
import Image from "next/image";

// ── Web Speech API type shim ────────────────────────────────────────────────
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function pickSpanishVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const priority = [
    // Edge / Windows neural voices (best quality, Mexican Spanish)
    (v: SpeechSynthesisVoice) => /sabina/i.test(v.name),
    (v: SpeechSynthesisVoice) => /raúl|raul/i.test(v.name),
    // Any es-MX voice (remote = cloud quality)
    (v: SpeechSynthesisVoice) => /es-MX/i.test(v.lang) && !v.localService,
    (v: SpeechSynthesisVoice) => /es-MX/i.test(v.lang),
    // Chrome fallback: US Spanish sounds more neutral than Spain Spanish
    (v: SpeechSynthesisVoice) => /estados unidos/i.test(v.name) && /^es/i.test(v.lang),
    (v: SpeechSynthesisVoice) => /es-US/i.test(v.lang),
    // Last resort: any Spanish (will be Spain accent in Chrome)
    (v: SpeechSynthesisVoice) => /^es/i.test(v.lang),
  ];
  for (const test of priority) {
    const match = voices.find(test);
    if (match) return match;
  }
  return null;
}

// Strip markdown AND emojis/symbols so TTS doesn't verbalize them
function stripForTTS(text: string): string {
  return text
    // ── Markdown ──────────────────────────────────────────────────────────
    .replace(/\*\*(.+?)\*\*/g, "$1")    // **bold**
    .replace(/\*(.+?)\*/g, "$1")         // *italic*
    .replace(/__(.+?)__/g, "$1")         // __bold__
    .replace(/_(.+?)_/g, "$1")           // _italic_
    .replace(/~~(.+?)~~/g, "$1")         // ~~strikethrough~~
    .replace(/`{3}[\s\S]*?`{3}/g, "")   // ```code blocks```
    .replace(/`(.+?)`/g, "$1")           // `inline code`
    .replace(/#{1,6}\s+/g, "")           // # headings
    .replace(/\[(.+?)\]\(.+?\)/g, "$1") // [text](url)
    .replace(/!?\[.*?\]\(.*?\)/g, "")   // images
    .replace(/^>\s+/gm, "")             // > blockquotes
    .replace(/^[-*+•]\s+/gm, "")        // - list items
    .replace(/^\d+\.\s+/gm, "")         // 1. numbered lists
    // ── Emojis (supplementary plane via surrogate pairs: 💰🔧🚗🎉 etc.) ──
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "")
    // ── BMP symbol blocks TTS verbalizes ──────────────────────────────────
    // Arrows, math, technical, dingbats ✔✗, misc symbols ☀★, etc.
    .replace(/[℀-⯿]/g, "")
    // Enclosed CJK, CJK compatibility, Kangxi radicals
    .replace(/[　-〿]/g, "")
    // Lone surrogate halves (malformed emoji)
    .replace(/[\uD800-\uDFFF]/g, "")
    // ── Whitespace cleanup ─────────────────────────────────────────────────
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const MIC_ERRORS: Record<string, string> = {
  "not-allowed": "Permiso de micrófono denegado. Habilítalo en la configuración del navegador.",
  "no-speech": "No se detectó voz. Intenta de nuevo.",
  "network": "Error de red con el reconocimiento de voz.",
  "aborted": "",
};

// ── Component ────────────────────────────────────────────────────────────────

export default function ChatWidget() {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPulse, setShowPulse] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      role: "assistant",
      content: t("chat_greeting"),
      timestamp: new Date(),
    },
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep a ref so recognition callbacks always see the latest messages
  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // ── Voice state ────────────────────────────────────────────────────────────
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [micError, setMicError] = useState("");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (SR && window.speechSynthesis) setVoiceSupported(true);
  }, []);

  const speak = useCallback((text: string) => {
    if (!voiceEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const clean = stripForTTS(text);
    if (!clean) return;

    const utter = new SpeechSynthesisUtterance(clean);
    utter.lang = "es-MX";
    utter.rate = 1.05;
    utter.pitch = 1;

    const tryVoice = () => {
      const voice = pickSpanishVoice();
      if (voice) utter.voice = voice;
    };
    tryVoice();
    if (!utter.voice) {
      window.speechSynthesis.addEventListener("voiceschanged", tryVoice, { once: true });
    }

    utter.onstart = () => setSpeaking(true);
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utter);
  }, [voiceEnabled]);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  // ── Speech recognition ─────────────────────────────────────────────────────
  // getUserMedia() is called first to force the browser permission dialog —
  // SpeechRecognition alone doesn't always trigger it in Chrome.
  async function startListening() {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) return;

    stopSpeaking();
    setMicError("");
    recognitionRef.current?.abort();

    // Step 1: request mic permission explicitly so the browser shows the dialog
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop()); // release immediately
    } catch {
      setMicError(
        "Micrófono bloqueado. En Chrome: haz clic en el candado (🔒) de la barra de dirección → Micrófono → Permitir, y recarga la página."
      );
      return;
    }

    // Step 2: start recognition now that permission is granted
    const recognition = new SR();
    recognitionRef.current = recognition;
    recognition.lang = "es-MX";
    recognition.interimResults = false;
    recognition.continuous = false;

    let gotResult = false;

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[0]?.[0]?.transcript?.trim() ?? "";
      if (transcript) {
        gotResult = true;
        setInput(transcript);
        setTimeout(() => sendWithText(transcript), 250);
      }
    };

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      const msg = MIC_ERRORS[e.error] ?? `Error de micrófono: ${e.error}`;
      if (msg) setMicError(msg);
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      if (!gotResult) setMicError((prev) => prev || "");
    };

    try {
      recognition.start();
      setListening(true);
    } catch (err) {
      setMicError("No se pudo iniciar el reconocimiento de voz.");
      console.error("[mic]", err);
    }
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      window.speechSynthesis?.cancel();
    };
  }, []);

  // ── Chat ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setShowPulse(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
    }
  }, [messages, isOpen]);

  // Core send — uses messagesRef so it's always fresh even inside recognition callbacks
  async function sendWithText(text: string) {
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messagesRef.current.slice(-8).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await res.json();
      const replyText = data.reply ?? "Lo siento, ocurrió un error. Escríbenos al WhatsApp.";
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: replyText,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
      speak(replyText); // speak() already strips markdown internally
    } catch {
      const errText = "Error de conexión. Contáctanos por WhatsApp: +52 81 3388-0010";
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: errText,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function sendMessage(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    sendWithText(text);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const quickReplies = [
    "¿Cuánto cuesta una afinación?",
    "¿Qué zonas cubren?",
    "¿Cuánto tardan en llegar?",
    "Necesito revisar mis frenos",
  ];

  return (
    <>
      {/* Chat Window */}
      {isOpen && !isMinimized && (
        <div
          className={`fixed bottom-24 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[380px] rounded-3xl shadow-2xl overflow-hidden transition-all border ${
            isDark
              ? "bg-slate-900 border-white/10 shadow-black/50"
              : "bg-white border-gray-200 shadow-gray-200"
          }`}
          style={{ maxHeight: "80vh" }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[var(--color-spm-red)] to-[var(--color-spm-orange)] px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative w-9 h-9">
                <Image src="/images/logo.png" alt="SPM" fill className="object-contain rounded-full" />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">{t("chat_title")}</p>
                <p className="text-white/70 text-xs flex items-center gap-1">
                  {speaking ? (
                    <>
                      <span className="w-1.5 h-1.5 bg-blue-300 rounded-full animate-pulse" />
                      Hablando…
                    </>
                  ) : listening ? (
                    <>
                      <span className="w-1.5 h-1.5 bg-yellow-300 rounded-full animate-pulse" />
                      Escuchando…
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                      {t("chat_online")}
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {voiceSupported && (
                <button
                  onClick={() => {
                    if (voiceEnabled) stopSpeaking();
                    setVoiceEnabled((v) => !v);
                  }}
                  title={voiceEnabled ? "Silenciar voz" : "Activar voz"}
                  className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                >
                  {voiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                </button>
              )}
              <button
                onClick={() => setIsMinimized(true)}
                className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all"
              >
                <Minimize2 size={14} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="h-72 overflow-y-auto p-4 space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-start gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center ${
                    msg.role === "assistant"
                      ? "bg-gradient-to-br from-[var(--color-spm-red)] to-[var(--color-spm-orange)]"
                      : isDark ? "bg-slate-700" : "bg-gray-200"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <Bot size={14} className="text-white" />
                  ) : (
                    <User size={14} className={isDark ? "text-slate-300" : "text-gray-600"} />
                  )}
                </div>
                <div
                  className={`max-w-[80%] px-3 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[var(--color-spm-red)] text-white rounded-tr-sm"
                      : isDark
                      ? "bg-slate-800 text-slate-200 rounded-tl-sm"
                      : "bg-gray-100 text-slate-800 rounded-tl-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--color-spm-red)] to-[var(--color-spm-orange)] flex items-center justify-center">
                  <Bot size={14} className="text-white" />
                </div>
                <div className={`px-3 py-2.5 rounded-2xl rounded-tl-sm ${isDark ? "bg-slate-800" : "bg-gray-100"}`}>
                  <Loader2 size={16} className="animate-spin text-[var(--color-spm-red)]" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Replies */}
          {messages.length <= 2 && (
            <div className={`px-3 pb-2 flex flex-wrap gap-1.5 border-t ${isDark ? "border-white/5" : "border-gray-100"}`}>
              <p className={`w-full text-xs pt-2 pb-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                Preguntas frecuentes:
              </p>
              {quickReplies.map((qr) => (
                <button
                  key={qr}
                  onClick={() => sendMessage(qr)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all hover:border-[var(--color-spm-red)] hover:text-[var(--color-spm-red)] ${
                    isDark ? "border-white/10 text-slate-400" : "border-gray-200 text-slate-500"
                  }`}
                >
                  {qr}
                </button>
              ))}
            </div>
          )}

          {/* Mic error */}
          {micError && (
            <div className="px-4 pb-2">
              <p className="text-xs text-red-400 flex items-center gap-1">
                <MicOff size={11} />
                {micError}
              </p>
            </div>
          )}

          {/* Input */}
          <div className={`px-3 pb-3 pt-2 border-t ${isDark ? "border-white/5" : "border-gray-100"}`}>
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => { setInput(e.target.value); setMicError(""); }}
                onKeyDown={handleKeyDown}
                placeholder={listening ? "Escuchando…" : t("chat_placeholder")}
                disabled={loading || listening}
                className={`flex-1 px-3 py-2.5 rounded-xl text-sm border outline-none transition-all focus:ring-1 focus:ring-[var(--color-spm-red)]/40 focus:border-[var(--color-spm-red)] ${
                  isDark
                    ? "bg-slate-800 border-white/10 text-white placeholder:text-slate-600"
                    : "bg-gray-50 border-gray-200 text-slate-900 placeholder:text-slate-400"
                }`}
              />

              {/* Mic button */}
              {voiceSupported && (
                <button
                  onClick={listening ? stopListening : startListening}
                  disabled={loading}
                  title={listening ? "Detener" : "Hablar"}
                  className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-50 ${
                    listening
                      ? "bg-red-500 text-white hover:bg-red-600"
                      : isDark
                      ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                      : "bg-gray-100 text-slate-600 hover:bg-gray-200"
                  }`}
                >
                  {listening && (
                    <span className="absolute inset-0 rounded-xl bg-red-500 animate-ping opacity-40" />
                  )}
                  {listening ? <MicOff size={15} /> : <Mic size={15} />}
                </button>
              )}

              {/* Send button */}
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className="w-10 h-10 bg-[var(--color-spm-red)] hover:bg-[var(--color-spm-red-dark)] text-white rounded-xl flex items-center justify-center transition-all hover:scale-105 disabled:opacity-50 disabled:scale-100"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Minimized bar */}
      {isOpen && isMinimized && (
        <button
          onClick={() => setIsMinimized(false)}
          className="fixed bottom-24 right-4 sm:right-6 z-50 flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-[var(--color-spm-red)] to-[var(--color-spm-orange)] text-white rounded-2xl shadow-xl"
        >
          <Bot size={16} />
          <span className="text-sm font-medium">{t("chat_title")}</span>
        </button>
      )}

      {/* FAB */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          setIsMinimized(false);
          setShowPulse(false);
        }}
        className="fixed bottom-6 right-4 sm:right-6 z-50 w-14 h-14 bg-gradient-to-br from-[var(--color-spm-red)] to-[var(--color-spm-orange)] text-white rounded-full shadow-xl shadow-red-900/40 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
        aria-label={isOpen ? "Cerrar chat" : "Abrir chat"}
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
        {showPulse && !isOpen && (
          <>
            <span className="absolute w-full h-full rounded-full bg-[var(--color-spm-red)] animate-ping opacity-30" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white text-[8px] font-bold flex items-center justify-center text-white">
              1
            </span>
          </>
        )}
      </button>
    </>
  );
}
