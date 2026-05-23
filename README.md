# ⚡ DownWizard — Premium Minimal YouTube Downloader

**DownWizard** is a lightweight, responsive, and secure full-stack web application that allows users to seamlessly download YouTube videos in high-quality **MP4** or **MP3** formats. Powered by a self-cleaning Node.js + Express backend and dynamic `yt-dlp` scripts.

---

## ✨ Features

- **Gorgeous Glassmorphic UI:** A visual-first dark theme built with pure vanilla HTML5, modern HSL-defined colors, responsive flex grids, and ambient CSS glowing spheres.
- **Double Format Conversions:**
  - **MP4 Video:** Downloads maximum MP4 video and dynamic audio, merging them beautifully utilizing local `ffmpeg` configurations.
  - **MP3 Audio:** Directly extracts and converts high-fidelity audio streams to `.mp3` format.
- **Strict Shell Security:** Strict, multi-tiered URL validation regex filters prevent command execution or shell injection attacks.
- **Zero-Trace Auto-Clean:** Downloaded media is immediately removed (`fs.unlink`) from the server’s hard drive once streaming completes to maximize space efficiency.
- **No Heavy Frameworks:** Crafted with clean, performant, pure Vanilla JavaScript (no React, Vue, Tailwind, or complex build setups).

---

## 🛠️ Prerequisites

To run this application locally, ensure you have:
1. **Node.js** (v16 or higher recommended)
2. **yt-dlp** installed on your system path.
3. **ffmpeg** installed on your system path (necessary for merging streams and audio conversion).

---

## 🚀 Quick Start Guide

Follow these quick commands to spin up the local server:

### 1. Install Dependencies
```bash
# Install the Express framework
npm install
```

### 2. Start the Server
```bash
# Start the server on its configured port
node server.js
```

### 3. Open in Browser
Visit **`http://localhost:8000`** in your browser to start downloading!

---

## 📂 Project Architecture

```text
yt-dlp-online/
├── server.js            # Node.js + Express backend
├── package.json         # Dependency configuration manifest
├── DOWNLOAD_APP_GUIDE.md# Exhaustive development documentation
├── downloads/           # Temporary download cache (Git-ignored)
└── public/              # Static frontend assets
    ├── index.html       # Centered card layout UI
    ├── style.css        # Sleek dark glassmorphic stylesheet
    └── script.js        # Dynamic fetch, state and download handler
```

---

## 🛡️ Security Implementation

- **URL Sanitization:** Incoming URL query payloads are ran against Node's native `URL` validator and filtered through a highly restrictive regex pattern (`/^[a-zA-Z0-9.:/?=&_#%\-\[\]]+$/`).
- **Command Escape Safe:** Double quotes encapsulate all terminal arguments. Without shell metacharacters like `;`, `&`, `|`, `` ` ``, `$`, or `\`, command execution overflows are mathematically eliminated.
- **Disk Auto-Purging:** The application relies on Express's `res.download()` completion hooks to guarantee the immediate deletion of cached media files, even in event of a user cancellation or connection error.

---

## 📄 License
This project is open-source and available under the terms of the MIT License.
