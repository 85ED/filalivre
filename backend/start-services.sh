#!/bin/bash

# FilaLivre Multi-Service Startup Script
# Inicia API, WhatsApp Service e Worker em paralelo

set -e

echo "📦 Installing dependencies..."
npm install

echo ""
echo "🚀 Starting FilaLivre Services..."
echo "=================================="
echo ""

# API Principal (porta 3001)
echo "📡 Starting API Principal (port 3001)..."
node server.js &
API_PID=$!
echo "   ✅ API PID: $API_PID"

# WhatsApp Service (porta 3003)
echo "📱 Starting WhatsApp Service (port 3003)..."
node server.whatsapp.js &
WHATSAPP_PID=$!
echo "   ✅ WhatsApp PID: $WHATSAPP_PID"

# Worker (background jobs)
echo "⚙️  Starting Worker..."
node server.worker.js &
WORKER_PID=$!
echo "   ✅ Worker PID: $WORKER_PID"

echo ""
echo "=================================="
echo "✅ All services started!"
echo "   API:      http://localhost:3001"
echo "   WhatsApp: http://localhost:3003"
echo "   Worker:   Running in background"
echo "=================================="
echo ""

# Mantém os processos rodando
wait $API_PID $WHATSAPP_PID $WORKER_PID
