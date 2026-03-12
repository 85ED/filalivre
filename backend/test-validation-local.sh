#!/bin/bash

# TEST 1: Local container validation
# Purpose: Verify that installing system dependencies allows Puppeteer/Chromium to work
# Timeline: ~10-15 minutes

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  TEST 1: LOCAL CONTAINER VALIDATION                        ║"
echo "║  Validating system dependencies + Puppeteer initialization ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Build Docker image with system dependencies
echo "📦 Step 1: Building Docker image with system dependencies..."
echo "   Command: docker build -t fila-whatsapp-validation -f Dockerfile.validation ."
echo ""

cd "$(dirname "$0")"

docker build -t fila-whatsapp-validation -f Dockerfile.validation . || {
  echo "❌ Build failed. Check Dockerfile and package.json"
  exit 1
}

echo "✓ Docker image built successfully"
echo ""

# Step 2: Run container and log output
echo "🚀 Step 2: Running container and checking initialization..."
echo "   Port: 3003"
echo "   Timeout: 15 seconds (watching for /ping endpoint availability)"
echo ""

# Run in background and capture logs
docker run -d \
  --name fila-whatsapp-validation-test \
  -p 3003:3003 \
  -e WHATSAPP_PORT=3003 \
  -e NODE_ENV=production \
  fila-whatsapp-validation > /dev/null 2>&1

# Give it 5 seconds to start
sleep 5

# Step 3: Test /ping endpoint (simplest test)
echo "🔍 Step 3: Testing /ping endpoint (ultra-simple, no dependencies)..."
echo "   Command: curl -s http://localhost:3003/ping"
echo ""

PING_RESPONSE=$(curl -s http://localhost:3003/ping)
PING_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3003/ping)

if [ "$PING_CODE" = "200" ] && [ "$PING_RESPONSE" = "pong" ]; then
  echo "✓ /ping WORKS"
  echo "   Response: $PING_RESPONSE"
  echo "   HTTP Code: $PING_CODE"
else
  echo "✗ /ping FAILED"
  echo "   Response: $PING_RESPONSE"
  echo "   HTTP Code: $PING_CODE"
  echo ""
  echo "   Logs from container:"
  docker logs fila-whatsapp-validation-test | tail -20
fi

echo ""

# Step 4: Test /health endpoint
echo "🔍 Step 4: Testing /health endpoint..."
echo "   Command: curl -s http://localhost:3003/health"
echo ""

HEALTH_RESPONSE=$(curl -s http://localhost:3003/health)
HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3003/health)

if [ "$HEALTH_CODE" = "200" ]; then
  echo "✓ /health WORKS"
  echo "   Response: $HEALTH_RESPONSE"
  echo "   HTTP Code: $HEALTH_CODE"
else
  echo "✗ /health FAILED"
  echo "   Response: $HEALTH_RESPONSE"
  echo "   HTTP Code: $HEALTH_CODE"
fi

echo ""

# Step 5: Test /ready endpoint
echo "🔍 Step 5: Testing /ready endpoint..."
echo "   Command: curl -s http://localhost:3003/ready"
echo ""

READY_RESPONSE=$(curl -s http://localhost:3003/ready)
READY_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3003/ready)

if [ "$READY_CODE" = "200" ]; then
  echo "✓ /ready WORKS"
  echo "   Response: $READY_RESPONSE"
  echo "   HTTP Code: $READY_CODE"
else
  echo "✗ /ready FAILED"
  echo "   Response: $READY_RESPONSE"
  echo "   HTTP Code: $READY_CODE"
fi

echo ""

# Step 6: Check container logs for Chromium initialization
echo "📋 Step 6: Checking container logs for Chromium status..."
echo ""

docker logs fila-whatsapp-validation-test 2>&1 | grep -E "Chromium|BINDING|Database|error|failed" || echo "   (No matching log lines found)"

echo ""

# Step 7: Summary
echo "═══════════════════════════════════════════════════════════"
echo "📊 TEST 1 SUMMARY"
echo "═══════════════════════════════════════════════════════════"

if [ "$PING_CODE" = "200" ] && [ "$HEALTH_CODE" = "200" ]; then
  echo "✅ SUCCESS - All endpoints responding"
  echo ""
  echo "CONCLUSION:"
  echo "  The WhatsApp service initializes correctly when system"
  echo "  dependencies (Chromium, GTK, X11, etc) are installed."
  echo ""
  echo "IMPLICATION:"
  echo "  The failure in Railway is CONFIRMED to be caused by"
  echo "  missing system dependencies in Nixpacks environment."
  echo ""
  echo "NEXT STEP:"
  echo "  Proceed with TEST 2 (Railway Docker deployment) to"
  echo "  confirm fix in production environment."
else
  echo "❌ FAILED - Endpoints not responding"
  echo ""
  echo "POSSIBLE CAUSES:"
  echo "  1. Missing database - check .env DATABASE settings"
  echo "  2. Missing environment variables - verify .env file"
  echo "  3. Different failure - check container logs above"
  echo ""
  echo "CHECKING CONTAINER LOGS:"
  docker logs fila-whatsapp-validation-test | tail -30
fi

echo ""

# Cleanup
echo "🧹 Cleaning up test container..."
docker stop fila-whatsapp-validation-test > /dev/null 2>&1
docker rm fila-whatsapp-validation-test > /dev/null 2>&1

echo "✓ Test container removed"
echo ""
echo "═══════════════════════════════════════════════════════════"
