# 📦 Chromium/Puppeteer System Dependencies Reference

**Purpose:** Quick lookup table of all system packages needed  
**Used by:** Dockerfile and Nixpacks configuration  
**Version:** Chromium 120+ (bundled with Puppeteer v24.37.5)

---

## 🐧 Alpine Linux Packages (for Docker)

For `Dockerfile.whatsapp` using `node:22-alpine`:

```dockerfile
RUN apk add --no-cache \
  ca-certificates \              # SSL/TLS certificates
  chromium \                     # Chromium browser binary
  chromium-tools \               # Chromium helper tools
  dumb-init \                    # Process manager for signals
  ffmpeg \                       # Audio/video processing
  freetype \                     # Font rendering
  harfbuzz \                     # Text shaping
  libx11 \                       # X11 Window System core
  libx11-dev \                   # X11 development files
  libxcomposite1 \               # X11 compositing
  libxdamage1 \                  # X11 damage extension
  libxext \                      # X11 extension
  libxfixes3 \                   # X11 fixes
  libxrandr2 \                   # X11 RandR extension
  libxrender1 \                  # X11 rendering
  libxss1 \                      # X11 screensaver
  libxtst6 \                     # X11 test library
  noto-sans \                    # Unicode fonts
  xvfb                           # Virtual X server
```

**Total Size:** ~400MB added to image

---

## 🐧 Debian/Ubuntu Packages (for reference)

If deploying to Debian/Ubuntu servers:

```bash
apt-get update && apt-get install -y \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libatspi2.0-0 \
  libc6 \
  libcairo2 \
  libcups2 \
  libdbus-1-3 \
  libexpat1 \
  libfontconfig1 \
  libgcc1 \
  libgconf-2-4 \
  libgdk-pixbuf2.0-0 \
  libgdk-pixbuf2.0-common \
  libglib2.0-0 \
  libglib2.0-dev \
  libglib2.0-shared-media-service \
  libgtk-3-0 \
  libgtk-3-common \
  libharfbuzz0b \
  libharfbuzz-icu0 \
  libicu66 \
  libjpeg-turbo-progs \
  libjpeg62-turbo \
  libnspr4 \
  libnss3 \
  libnss3-tools \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libpangoft2-1.0-0 \
  libpixman-1-0 \
  libpng16-16 \
  libstdc++6 \
  libwayland-client0 \
  libwayland-cursor0 \
  libwayland-egl1 \
  libx11-6 \
  libx11-xcb1 \
  libxau6 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxdmcp6 \
  libxext6 \
  libxfixes3 \
  libxi6 \
  libxinerama1 \
  libxkbcommon0 \
  libxkbcommon-x11-0 \
  libxrandr2 \
  libxrender1 \
  libxss1 \
  libxtst6 \
  libxv1 \
  libxvmc1 \
  libxext-dev \
  libfreetype6 \
  libpixman-1-dev \
  fontconfig-config \
  fonts-dejavu-core \
  fonts-liberation \
  ffmpeg
```

---

## 🔧 Environment Variables for Puppeteer

When using Alpine/Docker with Chromium from system:

```bash
# Skip downloading Chromium (use system version)
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Path to system Chromium
CHROME_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Flags for containerized Chromium
PUPPETEER_ARGS="--no-sandbox,--disable-setuid-sandbox,--disable-dev-shm-usage"
```

**In code:**
```javascript
const client = await wppconnect.create({
  headless: true,
  browserArgs: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--no-zygote',
    '--single-process',
  ],
  // Browser will use /usr/bin/chromium-browser automatically
});
```

---

## 📊 Package Dependencies Breakdown

### Core Window System (Required)
| Package | Purpose | Size | Critical |
|---------|---------|------|----------|
| `libx11-6` | X11 core | 6MB | ⭐⭐⭐ |
| `libx11-xcb1` | X11-XCB bridge | 2MB | ⭐⭐⭐ |
| `libxcomposite1` | Compositing | 1MB | ⭐⭐ |
| `libxdamage1` | Damage event | <1MB | ⭐⭐ |
| `libxext6` | Extensions | 2MB | ⭐⭐⭐ |
| `libxfixes3` | Fixes | <1MB | ⭐⭐ |
| `libxrandr2` | RandR extension | 1MB | ⭐⭐ |
| `libxrender1` | Rendering | 1MB | ⭐⭐⭐ |
| `libxss1` | Screensaver | <1MB | ⭐ |
| `libxtst6` | Test library | <1MB | ⭐ |

### Graphics & Rendering (Required)
| Package | Purpose | Size | Critical |
|---------|---------|------|----------|
| `libcairo2` | Graphics | 2MB | ⭐⭐⭐ |
| `libpango-1.0-0` | Text layout | 2MB | ⭐⭐⭐ |
| `libpangocairo-1.0-0` | Cairo integration | 1MB | ⭐⭐⭐ |
| `libgdk-pixbuf2.0-0` | Image loading | 4MB | ⭐⭐⭐ |
| `libpixman-1-0` | Pixel operations | 1MB | ⭐⭐⭐ |
| `libfreetype6` | Font rendering | 2MB | ⭐⭐⭐ |
| `libharfbuzz0b` | Text shaping | 2MB | ⭐⭐ |
| `fontconfig-config` | Font config | <1MB | ⭐⭐ |
| `fonts-liberation` | Fallback fonts | 3MB | ⭐⭐ |
| `fonts-dejavu-core` | More fonts | 2MB | ⭐ |

### Security & Networking (Required)
| Package | Purpose | Size | Critical |
|---------|---------|------|----------|
| `libnss3` | SSL/TLS | 8MB | ⭐⭐⭐ |
| `libnspr4` | NSPR runtime | 1MB | ⭐⭐⭐ |
| `ca-certificates` | SSL certs | 2MB | ⭐⭐⭐ |

### GTK & UI (Required)
| Package | Purpose | Size | Critical |
|---------|---------|------|----------|
| `libgtk-3-0` | GTK3 | 4MB | ⭐⭐⭐ |
| `libgdk-pixbuf2.0-0` | (see above) | 4MB | ⭐⭐⭐ |
| `libatk1.0-0` | Accessibility | 1MB | ⭐⭐ |
| `libatspi2.0-0` | A11y | 1MB | ⭐⭐ |

### Core Libraries (Required)
| Package | Purpose | Size | Critical |
|---------|---------|------|----------|
| `libc6` | C runtime | 2MB | ⭐⭐⭐ |
| `libstdc++6` | C++ runtime | 1MB | ⭐⭐⭐ |
| `libglib2.0-0` | GLib core | 2MB | ⭐⭐⭐ |
| `libexpat1` | XML parsing | <1MB | ⭐⭐ |
| `libdbus-1-3` | IPC system | 1MB | ⭐⭐ |
| `libcups2` | Print support | 3MB | ⭐ |
| `libgconf-2-4` | Configuration | 1MB | ⭐ |

### Media Processing (Recommended)
| Package | Purpose | Size | Critical |
|---------|---------|------|----------|
| `ffmpeg` | Media codec | 50MB | ⭐⭐⭐ |
| `libx264` | H.264 video | 2MB | ⭐⭐ |
| `libx265` | H.265 video | 2MB | ⭐⭐ |
| `libvpx` | VP8/VP9 video | 2MB | ⭐⭐ |
| `libopus` | Audio codec | 1MB | ⭐⭐ |
| `libvorbis` | Audio codec | <1MB | ⭐⭐ |

### Optional but Recommended
| Package | Purpose | Size | Critical |
|---------|---------|------|----------|
| `xvfb` | Virtual X server | 5MB | ⭐⭐ |
| `dumb-init` | Init system | <1MB | ⭐⭐⭐ |

---

## 🎯 Minimum Configuration

For bare minimum (just Chromium launching):

```dockerfile
FROM node:22-alpine

RUN apk add --no-cache \
  ca-certificates \
  chromium \
  libx11 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxext \
  libxfixes3 \
  libxrandr2 \
  libxrender1 \
  libnss3 \
  libgtk-3-0 \
  libpango-1.0-0 \
  libcairo2

# Rest of Dockerfile...
```

**Estimated size:** +250MB

---

## ⚡ Optimized Configuration (Recommended)

For full functionality with media processing:

```dockerfile
FROM node:22-alpine

RUN apk add --no-cache \
  ca-certificates \
  chromium \
  chromium-tools \
  dumb-init \
  ffmpeg \
  freetype \
  harfbuzz \
  libx11 \
  libx11-dev \
  libxcomposite1 \
  libxdamage1 \
  libxext \
  libxfixes3 \
  libxrandr2 \
  libxrender1 \
  libxss1 \
  libxtst6 \
  noto-sans \
  xvfb

# Rest of Dockerfile...
```

**Estimated size:** +400MB

---

## 🔍 Verification Scripts

### Check if Chromium Works

```bash
# In container
/usr/bin/chromium-browser --version

# Should output: Google Chrome 120.x...
```

### Check if All Dependencies Exist

```bash
#!/bin/bash
LIBS=(
  "libx11.so.6"
  "libgtk-3.so.0"
  "libnss3.so"
  "libpango-1.0.so.0"
  "libcairo.so.2"
)

for lib in "${LIBS[@]}"; do
  if find /usr -name "$lib" 2>/dev/null | grep -q .; then
    echo "✓ $lib found"
  else
    echo "✗ $lib NOT FOUND"
  fi
done
```

### Test Puppeteer Specifically

```javascript
import puppeteer from 'puppeteer';

try {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox']
  });
  console.log('✓ Puppeteer works!');
  await browser.close();
} catch (err) {
  console.error('✗ Puppeteer failed:', err.message);
}
```

---

## 📝 Troubleshooting

### Error: "libgtk-3.so.0: cannot open shared object file"
**Fix:** Add `libgtk-3-0` to docker apk add

### Error: "libnss3 not found"
**Fix:** Add `libnss3` to docker apk add

### Error: "cannot open display"
**Fix:** Set `DISPLAY=:99` or use `xvfb` (virtual X server)

### Error: "Chromium failed to start"
**Fix:** Add browserArgs: `['--no-sandbox', '--disable-dev-shm-usage']`

### Error: "Out of memory"
**Fix:** Increase container memory or use `--single-process` flag

---

## 📚 References

- [Puppeteer System Requirements](https://github.com/puppeteer/puppeteer#system-requirements)
- [Chromium Build Instructions](https://chromium.googlesource.com/chromium/src/+/main/docs/linux_build_instructions.md)
- [Alpine Linux Package Search](https://pkgs.alpinelinux.org/packages)
- [WPPConnect Configuration](https://wppconnect.io/docs/tutorial/basics/creating-client)

---

**Last Updated:** 2026-03-11  
**Alpine Version:** 3.18+  
**Node Version:** 18+, 20+, 22+  
**Puppeteer Version:** 24.x  
