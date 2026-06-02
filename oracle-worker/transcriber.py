#!/usr/bin/env python3
"""
Video Transcription Microservice — runs on Oracle Cloud.

Downloads YouTube/Instagram videos via yt-dlp, extracts audio,
transcribes via Groq's Whisper API, returns the transcript.

Endpoints:
  POST /transcribe  { "url": "https://instagram.com/reel/..." }
  → { "transcript": "...", "title": "...", "duration": 45 }

  GET /health → { "status": "ok" }

Auth: Bearer token (TRANSCRIBER_SECRET env var).

Runs as a systemd service on the same Oracle instance as WealthClaude
social processor and EchoNest yt-proxy.
"""

import os
import sys
import json
import time
import tempfile
import subprocess
import hashlib
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

PORT = int(os.environ.get("TRANSCRIBER_PORT", "8090"))
SECRET = os.environ.get("TRANSCRIBER_SECRET", "")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
MAX_DURATION = 600  # 10 min max video
TEMP_DIR = Path(tempfile.gettempdir()) / "transcriber"
TEMP_DIR.mkdir(exist_ok=True)


def is_authorized(headers):
    if not SECRET:
        return True  # No secret set = open (dev mode)
    auth = headers.get("Authorization", "")
    return auth == f"Bearer {SECRET}"


def download_video(url: str) -> tuple[str | None, str, float]:
    """Download video via yt-dlp, return (audio_path, title, duration)."""
    video_id = hashlib.md5(url.encode()).hexdigest()[:12]
    output_path = str(TEMP_DIR / f"{video_id}")

    cmd = [
        "yt-dlp",
        "--no-playlist",
        "--max-filesize", "100M",
        "--extract-audio",
        "--audio-format", "mp3",
        "--audio-quality", "5",  # lower quality = smaller file = faster
        "-o", f"{output_path}.%(ext)s",
        "--print-json",
        "--no-warnings",
        url,
    ]

    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=120
        )
        if result.returncode != 0:
            print(f"[yt-dlp] Error: {result.stderr[:500]}", file=sys.stderr)
            return None, "", 0

        # Parse the JSON output for metadata
        info = {}
        for line in result.stdout.strip().split("\n"):
            try:
                info = json.loads(line)
                break
            except json.JSONDecodeError:
                continue

        title = info.get("title", "")
        duration = float(info.get("duration", 0))

        # Find the downloaded audio file
        audio_file = None
        for ext in ["mp3", "m4a", "wav", "opus", "webm"]:
            p = Path(f"{output_path}.{ext}")
            if p.exists():
                audio_file = str(p)
                break

        if not audio_file:
            # Check if yt-dlp used a different naming
            for f in TEMP_DIR.glob(f"{video_id}*"):
                if f.suffix in (".mp3", ".m4a", ".wav", ".opus", ".webm"):
                    audio_file = str(f)
                    break

        return audio_file, title, duration
    except subprocess.TimeoutExpired:
        print("[yt-dlp] Timeout after 120s", file=sys.stderr)
        return None, "", 0
    except Exception as e:
        print(f"[yt-dlp] Exception: {e}", file=sys.stderr)
        return None, "", 0


def transcribe_audio(audio_path: str) -> str | None:
    """Transcribe audio via Groq's Whisper API."""
    if not GROQ_API_KEY:
        print("[whisper] No GROQ_API_KEY set", file=sys.stderr)
        return None

    try:
        import requests

        with open(audio_path, "rb") as f:
            response = requests.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
                files={"file": (Path(audio_path).name, f, "audio/mpeg")},
                data={
                    "model": "whisper-large-v3-turbo",
                    "language": "en",
                    "response_format": "text",
                },
                timeout=120,
            )

        if response.status_code != 200:
            print(f"[whisper] Groq {response.status_code}: {response.text[:300]}", file=sys.stderr)
            return None

        return response.text.strip()
    except Exception as e:
        print(f"[whisper] Exception: {e}", file=sys.stderr)
        return None


def cleanup(path: str):
    """Remove temp file."""
    try:
        Path(path).unlink(missing_ok=True)
    except Exception:
        pass


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"[{time.strftime('%H:%M:%S')}] {fmt % args}")

    def send_json(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            self.send_json({"status": "ok", "service": "transcriber"})
        else:
            self.send_json({"error": "Not found"}, 404)

    def do_POST(self):
        if self.path != "/transcribe":
            self.send_json({"error": "Not found"}, 404)
            return

        if not is_authorized(self.headers):
            self.send_json({"error": "Unauthorized"}, 401)
            return

        # Read body
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length > 0 else {}
        url = body.get("url", "").strip()

        if not url:
            self.send_json({"error": "url required"}, 400)
            return

        start = time.time()
        print(f"[transcribe] Starting: {url}")

        # Step 1: Download
        audio_path, title, duration = download_video(url)
        if not audio_path:
            self.send_json({
                "error": "Failed to download video. The URL may be invalid or the video may be private.",
            }, 422)
            return

        if duration > MAX_DURATION:
            cleanup(audio_path)
            self.send_json({
                "error": f"Video is {duration:.0f}s — max is {MAX_DURATION}s",
            }, 422)
            return

        download_time = time.time() - start
        print(f"[transcribe] Downloaded in {download_time:.1f}s: {title} ({duration:.0f}s)")

        # Step 2: Transcribe
        transcript = transcribe_audio(audio_path)
        cleanup(audio_path)

        if not transcript:
            self.send_json({
                "error": "Transcription failed. The audio may be too short or unclear.",
                "title": title,
                "duration": duration,
            }, 422)
            return

        total_time = time.time() - start
        print(f"[transcribe] Done in {total_time:.1f}s: {len(transcript)} chars")

        self.send_json({
            "transcript": transcript,
            "title": title,
            "duration": duration,
            "processingTime": round(total_time, 1),
        })


if __name__ == "__main__":
    # Check dependencies
    try:
        subprocess.run(["yt-dlp", "--version"], capture_output=True, check=True)
    except FileNotFoundError:
        print("ERROR: yt-dlp not found. Install: pip install yt-dlp", file=sys.stderr)
        sys.exit(1)

    try:
        import requests  # noqa
    except ImportError:
        print("ERROR: requests not found. Install: pip install requests", file=sys.stderr)
        sys.exit(1)

    print(f"Transcriber starting on port {PORT}...")
    print(f"  Auth: {'enabled' if SECRET else 'DISABLED (dev mode)'}")
    print(f"  Groq: {'configured' if GROQ_API_KEY else 'NOT SET'}")
    print(f"  yt-dlp: available")
    print(f"  Temp dir: {TEMP_DIR}")
    print()

    server = HTTPServer(("0.0.0.0", PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
