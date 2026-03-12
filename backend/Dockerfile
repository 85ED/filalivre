# Dockerfile for FilaLivre Backend Services
# Supports: API, WhatsApp Service, Worker, all in one container
# Note: WhatsApp service requires system Chromium/puppeteer support

FROM node:22-alpine

# Install system dependencies for WhatsApp service (Chromium/Puppeteer)
# These are required even if service.whatsapp.js is not running,
# because the container may need to start it on demand
RUN apk add --no-cache \
  chromium \
  ffmpeg \
  nss \
  freetype \
  harfbuzz \
  ca-certificates \
  ttf-freefont \
  dumb-init

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Configure Puppeteer to use system Chromium (critical!)
# PUPPETEER_SKIP_CHROMIUM_DOWNLOAD prevents attempting to download
# PUPPETEER_EXECUTABLE_PATH tells puppeteer exactly where to find it
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV CHROME_BIN=/usr/bin/chromium
ENV NODE_ENV=production

# Exposed ports for multiple services
EXPOSE 8080  # API
EXPOSE 3003  # WhatsApp service
EXPOSE 8888  # Worker

# Use dumb-init to handle signals properly
ENTRYPOINT ["/usr/sbin/dumb-init", "--"]

# Start main API server by default
# (Can be overridden with: docker run ... node server.whatsapp.js)
CMD ["node", "server.js"]
