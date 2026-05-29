"use client";

import { useEffect, useRef, useState } from "react";
import { FiMic, FiMicOff, FiLoader } from "react-icons/fi";

/**
 * Tap-to-record voice button with two modes:
 *
 *   live (default)  — Uses the browser's SpeechRecognition API. Text appears
 *                     in real-time as you speak. Free, no API call. Falls back
 *                     to "batch" if SpeechRecognition isn't available (some
 *                     Android browsers, older iOS).
 *
 *   batch           — Records audio with MediaRecorder, uploads to Groq
 *                     Whisper when you stop. Higher accuracy, supports
 *                     non-English, but text doesn't appear until upload
 *                     finishes (~1-3s).
 *
 * Both modes call onText() with the running transcript. In live mode, onText
 * fires repeatedly as words arrive; in batch mode it fires once with the
 * final string.
 */
export default function VoiceMic({
  onText,
  onError,
  size = "md",
  className = "",
  mode = "live",
}: {
  onText: (text: string, isFinal?: boolean) => void;
  onError?: (msg: string) => void;
  size?: "sm" | "md";
  className?: string;
  mode?: "live" | "batch";
}) {
  const [state, setState] = useState<"idle" | "recording" | "uploading">("idle");
  const [unsupported, setUnsupported] = useState(false);
  const [activeMode, setActiveMode] = useState<"live" | "batch">(mode);

  // batch-mode refs
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // live-mode ref
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const liveBufferRef = useRef<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Decide actual mode at mount based on capabilities.
    const SR =
      (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor })
        .webkitSpeechRecognition;
    if (mode === "live" && !SR) {
      // Fall back to batch transparently.
      setActiveMode("batch");
    }
    const hasMediaRecorder =
      !!navigator.mediaDevices && typeof window.MediaRecorder !== "undefined";
    if (activeMode === "batch" && !hasMediaRecorder) {
      setUnsupported(true);
    }
    if (mode === "live" && !SR && !hasMediaRecorder) {
      setUnsupported(true);
    }
  }, [mode, activeMode]);

  async function start() {
    if (activeMode === "live") return startLive();
    return startBatch();
  }

  function stop() {
    if (activeMode === "live") return stopLive();
    return stopBatch();
  }

  /* ─── Live mode (SpeechRecognition) ─── */

  function startLive() {
    const SR =
      (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor })
        .webkitSpeechRecognition;
    if (!SR) {
      // Shouldn't get here because of useEffect fallback, but defensive.
      return startBatch();
    }
    try {
      const recognition: SpeechRecognitionLike = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || "en-US";
      liveBufferRef.current = "";

      recognition.onresult = (event) => {
        let interim = "";
        let finalChunk = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const r = event.results[i];
          if (r.isFinal) finalChunk += r[0].transcript;
          else interim += r[0].transcript;
        }
        if (finalChunk) {
          liveBufferRef.current += finalChunk;
        }
        const combined = (liveBufferRef.current + " " + interim).trim();
        onText(combined, false);
      };
      recognition.onerror = (e) => {
        const msg = e?.error || "Speech recognition failed";
        if (msg === "no-speech") {
          // Silence isn't really an error worth nagging.
          return;
        }
        if (msg === "not-allowed") {
          onError?.("Microphone access denied — enable it in your browser settings.");
        } else if (msg === "aborted") {
          // Normal stop event — no error.
        } else {
          onError?.(`Voice error: ${msg}`);
        }
      };
      recognition.onend = () => {
        // Fire one last final-flag callback so the consumer can save state.
        if (liveBufferRef.current.trim()) {
          onText(liveBufferRef.current.trim(), true);
        }
        setState("idle");
      };
      recognitionRef.current = recognition;
      recognition.start();
      setState("recording");
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Could not start mic");
    }
  }

  function stopLive() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    // onend will fire and set state to idle.
  }

  /* ─── Batch mode (MediaRecorder + Whisper) ─── */

  async function startBatch() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg",
      ];
      const supported = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m));
      const recorder = supported
        ? new MediaRecorder(stream, { mimeType: supported })
        : new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = handleStopBatch;
      recorderRef.current = recorder;
      recorder.start();
      setState("recording");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Could not access microphone";
      onError?.(msg);
    }
  }

  function stopBatch() {
    recorderRef.current?.stop();
  }

  async function handleStopBatch() {
    setState("uploading");
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    try {
      const blob = new Blob(chunksRef.current, {
        type: recorderRef.current?.mimeType || "audio/webm",
      });
      if (blob.size < 500) {
        onError?.("Recording was empty — hold longer next time.");
        setState("idle");
        return;
      }
      const fd = new FormData();
      fd.set("file", blob, "voice.webm");
      const r = await fetch("/api/admin/voice/transcribe", {
        method: "POST",
        body: fd,
      });
      const data = (await r.json().catch(() => ({}))) as {
        text?: string;
        error?: string;
      };
      if (!r.ok) {
        onError?.(data.error || "Transcription failed");
        setState("idle");
        return;
      }
      const text = (data.text ?? "").trim();
      if (text) onText(text, true);
      else onError?.("Couldn't understand the audio. Try again.");
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Upload failed");
    }
    setState("idle");
  }

  if (unsupported) {
    return (
      <button
        type="button"
        disabled
        title="Voice input not supported in this browser"
        className={`${sizeClass(size)} rounded-full bg-white/[0.04] border border-white/[0.06] text-[#555] flex items-center justify-center shrink-0 ${className}`}
      >
        <FiMicOff size={iconSize(size)} />
      </button>
    );
  }

  if (state === "uploading") {
    return (
      <button
        type="button"
        disabled
        className={`${sizeClass(size)} rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center justify-center shrink-0 ${className}`}
        title="Transcribing…"
      >
        <FiLoader size={iconSize(size)} className="animate-spin" />
      </button>
    );
  }

  if (state === "recording") {
    return (
      <button
        type="button"
        onClick={stop}
        className={`${sizeClass(size)} rounded-full bg-red-500 text-white flex items-center justify-center shrink-0 animate-pulse ${className}`}
        title={activeMode === "live" ? "Stop (live)" : "Stop recording"}
      >
        <FiMic size={iconSize(size)} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      className={`${sizeClass(size)} rounded-full bg-white/[0.04] border border-white/[0.08] text-[#888] hover:border-[#ff6b00]/40 hover:text-[#ff6b00] flex items-center justify-center shrink-0 transition-colors ${className}`}
      title={
        activeMode === "live"
          ? "Tap to talk — text appears live"
          : "Tap to record a voice note"
      }
    >
      <FiMic size={iconSize(size)} />
    </button>
  );
}

function sizeClass(s: "sm" | "md"): string {
  return s === "sm" ? "w-8 h-8" : "w-10 h-10";
}
function iconSize(s: "sm" | "md"): number {
  return s === "sm" ? 12 : 14;
}

/* ─── Minimal SpeechRecognition typings (TS doesn't ship them) ─── */

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
