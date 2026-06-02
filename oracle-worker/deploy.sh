#!/bin/bash
# Deploy the video transcription microservice on Oracle Cloud.
# Run this ON the Oracle instance (same one running EchoNest + WealthClaude).
#
# Usage: bash deploy.sh

set -e
SERVICE_NAME="video-transcriber"
INSTALL_DIR="$HOME/video-transcriber"

echo "=== Video Transcriber — Oracle Cloud Setup ==="

# Install system deps
echo "→ Installing yt-dlp + ffmpeg..."
sudo apt-get update -qq
sudo apt-get install -y -qq ffmpeg
pip3 install -q --user yt-dlp requests 2>/dev/null || {
    python3 -m pip install -q --user yt-dlp requests
}

# Ensure yt-dlp is in PATH
export PATH="$HOME/.local/bin:$PATH"
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc 2>/dev/null || true

# Verify
yt-dlp --version && echo "✅ yt-dlp installed"
ffmpeg -version 2>/dev/null | head -1 && echo "✅ ffmpeg installed"

# Setup directory
mkdir -p "$INSTALL_DIR"
cp transcriber.py "$INSTALL_DIR/" 2>/dev/null || {
    echo "Downloading transcriber.py from repo..."
    curl -sL "https://raw.githubusercontent.com/krishnaamarneni-cell/portfolio/main/oracle-worker/transcriber.py" -o "$INSTALL_DIR/transcriber.py"
}

# Create .env if not exists
if [ ! -f "$INSTALL_DIR/.env" ]; then
    cat > "$INSTALL_DIR/.env" << 'EOF'
TRANSCRIBER_PORT=8090
TRANSCRIBER_SECRET=your-secret-here
GROQ_API_KEY=your-groq-key-here
EOF
    echo "⚠️  Edit $INSTALL_DIR/.env with your secrets"
    echo "    nano $INSTALL_DIR/.env"
fi

# Create systemd service
sudo tee /etc/systemd/system/${SERVICE_NAME}.service > /dev/null << SERVICEEOF
[Unit]
Description=Video Transcription Microservice
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$INSTALL_DIR/.env
ExecStart=/usr/bin/python3 $INSTALL_DIR/transcriber.py
Restart=always
RestartSec=10
Environment=PYTHONUNBUFFERED=1
StandardOutput=append:/var/log/${SERVICE_NAME}.log
StandardError=append:/var/log/${SERVICE_NAME}.log
MemoryMax=256M

[Install]
WantedBy=multi-user.target
SERVICEEOF

sudo touch /var/log/${SERVICE_NAME}.log
sudo chown $USER:$USER /var/log/${SERVICE_NAME}.log

sudo systemctl daemon-reload
sudo systemctl enable ${SERVICE_NAME}
sudo systemctl restart ${SERVICE_NAME}

sleep 2
echo ""
echo "=== Status ==="
sudo systemctl status ${SERVICE_NAME} --no-pager | head -8
echo ""
echo "=== Test ==="
curl -s http://localhost:8090/health | python3 -m json.tool 2>/dev/null || echo "Waiting for startup..."
echo ""
echo "============================================================"
echo "✅ Video Transcriber running on port 8090"
echo ""
echo "Test: curl http://localhost:8090/health"
echo "Logs: tail -f /var/log/${SERVICE_NAME}.log"
echo ""
echo "⚠️  IMPORTANT: Open port 8090 in Oracle Cloud:"
echo "   Oracle Console → Networking → VCN → Security List"
echo "   → Add Ingress Rule: Source 0.0.0.0/0, Port 8090, TCP"
echo "   Also: sudo iptables -I INPUT -p tcp --dport 8090 -j ACCEPT"
echo "============================================================"
