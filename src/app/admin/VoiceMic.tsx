"use client";

import { useEffect, useRef, useState } from "react";
import { FiMic, FiMicOff, FiLoader } from "react-icons/fi";

/**
 * Tap-to-record voice button. Uses MediaRecorder + Groq Whisper.
 *
 * - First tap: requests mic access (browser prompts the user) and starts
 *   recording. Button turns red and pulses.
 * - Second tap: stops recording, sends to /api/admin/voice/transcribe,
 *   calls onText() with the transcribed string when done.
 *
 * The parent decides what to do with the text (append, replace, etc).
 */
export default function VoiceMic({
  onText,
  onError,
  size = "md",
  className = "",
}: {
  onText: (text: string) => void;
  onError?: (msg: string) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "recording" | "uploading">("idle");
  const [unsupported, setUnsupported] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (
      !navigator.mediaDevices ||
      typeof window.MediaRecorder === "undefined"
    ) {
      setUnsupported(true);
    }
  }, []);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      // Pick a supported mime type; browsers vary.
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
      recorder.onstop = handleStop;
      recorderRef.current = recorder;
      recorder.start();
      setState("recording");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Could not access microphone";
      onError?.(msg);
    }
  }

  function stop() {
    const recorder = recorderRef.current;
    if (!recorder) return;
    recorder.stop();
    // The actual upload happens in onstop → handleStop()
  }

  async function handleStop() {
    setState("uploading");
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    try {
      const blob = new Blob(chunksRef.current, {
        type: recorderRef.current?.mimeType || "audio/webm",
      });
      if (blob.size < 500) {
        // Less than half a kilobyte ≈ no audio.
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
      if (text) onText(text);
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
        title="Stop recording"
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
      title="Tap to record a voice note"
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
