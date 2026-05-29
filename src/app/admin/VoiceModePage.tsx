"use client";

import { useEffect, useRef, useState } from "react";
import { FiX, FiSend, FiMic, FiMicOff, FiPause, FiPlay } from "react-icons/fi";

/**
 * Full-screen voice page — Perplexity-style. Opens when the user taps the mic
 * in the chat composer. Shows:
 *
 *  - Animated Siri-style orb at the top half (pulsing concentric rings when
 *    listening, dimmed when paused)
 *  - LARGE live transcription centered below the orb
 *  - Bottom dock: Pause/Resume · big Send · Cancel
 *
 * The transcript flows in as the user speaks (Web Speech API, free). Tap Send
 * to ship it to the chat conversation; tap Cancel/X to drop it.
 */
export default function VoiceModePage({
  isOpen,
  onClose,
  onSend,
  onError,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSend: (text: string) => void;
  onError?: (msg: string) => void;
}) {
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR =
      (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor })
        .webkitSpeechRecognition;
    if (!SR) setUnsupported(true);
  }, []);

  // Auto-start when the page opens
  useEffect(() => {
    if (!isOpen) return;
    setTranscript("");
    setInterim("");
    startListening();
    return () => stopListening();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function startListening() {
    const SR =
      (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor })
        .webkitSpeechRecognition;
    if (!SR) {
      setUnsupported(true);
      return;
    }
    try {
      const r: SpeechRecognitionLike = new SR();
      r.continuous = true;
      r.interimResults = true;
      r.lang = navigator.language || "en-US";

      r.onresult = (event) => {
        let interimBuffer = "";
        let finalBuffer = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) finalBuffer += res[0].transcript;
          else interimBuffer += res[0].transcript;
        }
        if (finalBuffer) {
          setTranscript((t) => (t ? `${t} ${finalBuffer}`.trim() : finalBuffer.trim()));
        }
        setInterim(interimBuffer);
      };
      r.onerror = (e) => {
        const err = e?.error;
        if (err === "no-speech" || err === "aborted") return;
        if (err === "not-allowed") {
          onError?.("Microphone permission denied — enable it in browser settings.");
          setListening(false);
        } else {
          onError?.(`Voice error: ${err ?? "unknown"}`);
        }
      };
      r.onend = () => {
        // Browser auto-stops after silence; flip state but don't auto-close.
        setListening(false);
      };
      r.start();
      recognitionRef.current = r;
      setListening(true);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Could not start mic");
    }
  }

  function stopListening() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  }

  function send() {
    const finalText = (transcript + " " + interim).trim();
    stopListening();
    if (finalText) {
      onSend(finalText);
    }
    setTranscript("");
    setInterim("");
    onClose();
  }

  function cancel() {
    stopListening();
    setTranscript("");
    setInterim("");
    onClose();
  }

  if (!isOpen) return null;

  const displayText = (transcript + " " + interim).trim();

  return (
    <div
      className="fixed inset-0 z-[100] bg-[#050505] flex flex-col"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Ambient gradient backdrop */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className={`absolute top-[20%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full blur-[160px] transition-all duration-500 ${
            listening ? "bg-[#ff6b00]/[0.18]" : "bg-[#ff6b00]/[0.05]"
          }`}
        />
      </div>

      {/* Top bar */}
      <div className="relative flex items-center justify-between px-5 py-4 z-10">
        <button
          type="button"
          onClick={cancel}
          className="w-10 h-10 rounded-full bg-white/[0.06] border border-white/[0.08] text-[#aaa] hover:text-white flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Close voice mode"
        >
          <FiX size={18} />
        </button>
        <div className="flex items-center gap-2">
          <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#ff8c38]">
            {unsupported ? "Not supported" : listening ? "Listening" : "Paused"}
          </div>
          {listening && (
            <div className="flex items-end gap-0.5 h-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-[3px] bg-[#ff8c38] rounded-sm animate-pulse"
                  style={{
                    animationDelay: `${i * 0.15}s`,
                    height: `${50 + i * 25}%`,
                  }}
                />
              ))}
            </div>
          )}
        </div>
        <div className="w-10" />
      </div>

      {/* Orb */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-6 z-10">
        <div className="relative w-44 h-44 sm:w-56 sm:h-56">
          {/* Outer pulsing rings — only animate when listening */}
          {listening && (
            <>
              <div className="absolute inset-0 rounded-full bg-[#ff6b00]/30 animate-ping" />
              <div
                className="absolute inset-3 rounded-full bg-[#ff6b00]/40 animate-ping"
                style={{ animationDelay: "0.3s", animationDuration: "1.8s" }}
              />
              <div
                className="absolute inset-6 rounded-full bg-[#ff6b00]/50 animate-ping"
                style={{ animationDelay: "0.6s", animationDuration: "2.4s" }}
              />
            </>
          )}
          {/* Core orb */}
          <div
            className={`absolute inset-10 rounded-full shadow-[0_20px_60px_rgba(255,107,0,0.5)] transition-all duration-300 ${
              listening
                ? "bg-gradient-to-br from-[#ff6b00] via-[#ff8c38] to-[#ffaa66] scale-100"
                : "bg-gradient-to-br from-[#ff6b00]/40 to-[#ff8c38]/40 scale-90"
            }`}
          >
            {/* Glossy highlight */}
            <div className="absolute top-2 left-3 right-1/3 h-1/3 rounded-full bg-white/30 blur-md" />
            {/* Center mic glyph */}
            <div className="absolute inset-0 flex items-center justify-center">
              {unsupported ? (
                <FiMicOff size={28} className="text-black/60" />
              ) : (
                <FiMic
                  size={28}
                  className={`text-black ${listening ? "" : "opacity-50"}`}
                />
              )}
            </div>
          </div>
        </div>

        {/* Live transcription */}
        <div className="mt-10 sm:mt-14 max-w-2xl w-full text-center min-h-[120px]">
          {displayText ? (
            <p className="text-2xl sm:text-3xl text-white leading-relaxed font-light tracking-tight">
              <span>{transcript}</span>
              {interim && (
                <span className="text-[#aaa] italic"> {interim}</span>
              )}
            </p>
          ) : unsupported ? (
            <p className="text-base text-[#888] leading-relaxed max-w-md mx-auto">
              Voice mode needs SpeechRecognition (Chrome / Safari / Edge). On
              older Android, type instead.
            </p>
          ) : listening ? (
            <p className="text-lg text-[#888]">
              Speak now — I'm listening<span className="animate-pulse">…</span>
            </p>
          ) : (
            <p className="text-lg text-[#888]">Tap the orb to resume.</p>
          )}
        </div>
      </div>

      {/* Bottom controls */}
      <div className="relative px-6 pb-6 pt-3 z-10">
        <div className="flex items-center justify-around">
          {/* Pause / Resume */}
          {!unsupported && (
            <button
              type="button"
              onClick={() => (listening ? stopListening() : startListening())}
              className="w-14 h-14 rounded-full bg-white/[0.06] border border-white/[0.08] text-[#aaa] flex items-center justify-center active:scale-95 transition-transform"
              aria-label={listening ? "Pause" : "Resume"}
            >
              {listening ? <FiPause size={20} /> : <FiPlay size={20} />}
            </button>
          )}

          {/* Send — primary action */}
          <button
            type="button"
            onClick={send}
            disabled={!displayText.trim()}
            className="w-20 h-20 rounded-full bg-gradient-to-br from-[#ff6b00] to-[#ff8c38] text-black shadow-[0_8px_30px_rgba(255,107,0,0.5)] flex items-center justify-center active:scale-95 transition-transform disabled:opacity-30 disabled:shadow-none"
            aria-label="Send"
          >
            <FiSend size={28} />
          </button>

          {/* Cancel */}
          <button
            type="button"
            onClick={cancel}
            className="w-14 h-14 rounded-full bg-white/[0.06] border border-white/[0.08] text-[#aaa] flex items-center justify-center active:scale-95 transition-transform"
            aria-label="Cancel"
          >
            <FiX size={20} />
          </button>
        </div>
        <p className="text-center mt-3 text-[10px] uppercase tracking-widest text-[#555]">
          {displayText.trim() ? "Tap ↑ to send" : "Tap pause when done"}
        </p>
      </div>
    </div>
  );
}

/* ─── Minimal SpeechRecognition types ─── */
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (event: SpeechRecognitionEventLike) => void;
  onerror: (event: { error?: string }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    [index: number]: { transcript: string };
  }>;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;
