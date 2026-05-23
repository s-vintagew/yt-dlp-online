# TubeFlow: Development Guide & Reference

This guide provides deep technical insights, security considerations, and detailed code mappings for **TubeFlow**, a secure full-stack media downloader.

---

## 📂 Project Architecture

```text
yt-dlp-online/
├── server.js            # Node.js + Express backend
├── package.json         # Configuration manifest
├── DOWNLOAD_APP_GUIDE.md# Exhaustive development documentation
├── downloads/           # Temp downloads directory (Git-ignored)
└── public/              # Vanilla static web assets
    ├── index.html       # Centered card layout UI
    ├── style.css        # Sleek dark glassmorphic stylesheet
    └── script.js        # Dynamic fetch, state and download handler
```

---

## 💻 Technical Code Maps

### 1. `server.js` (Express Backend)

```javascript
const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const util = require('util');

const execPromise = util.promisify(exec);
const app = express();
const PORT = process.env.PORT || 8000;

// Middleware to parse JSON payloads
app.use(express.json());

// Serve the static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Ensure downloads directory exists
const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
}

/**
 * Validate and sanitize URLs securely to prevent shell injection.
 * We enforce standard URL protocols and only allow a strict set of safe characters.
 */
function isValidUrl(string) {
    try {
        const parsed = new URL(string);
        // Allow only standard http or https protocols
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return false;
        }
        // Strict safe pattern: only allow alphanumeric characters and standard URL symbols.
        // Avoid shell metacharacters like ;, &, |, $, `, <, >, \, ', ", etc.
        const safePattern = /^[a-zA-Z0-9.:/?=&_#%\-\[\]]+$/;
        return safePattern.test(string);
    } catch (_) {
        return false;
    }
}

// POST endpoint at /download
app.post('/download', async (req, res) => {
    const { url, format, quality } = req.body;

    // 1. Validation
    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL is required.' });
    }

    if (!isValidUrl(url)) {
        return res.status(400).json({ error: 'Invalid or unsafe URL format provided.' });
    }

    const validFormats = ['mp4', 'mp3', 'playlist-mp4', 'playlist-mp3'];
    if (!validFormats.includes(format)) {
        return res.status(400).json({ error: 'Format must be one of: mp4, mp3, playlist-mp4, playlist-mp3.' });
    }

    console.log(`[INFO] Received request - Format: ${format}, Quality: ${quality || 'N/A'}, URL: ${url}`);

    // Create unique identifiers
    const tempId = `download_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const extension = format.startsWith('playlist-') ? 'zip' : format;
    const finalFilePath = path.join(downloadsDir, `${tempId}.${extension}`);
    const playlistDir = path.join(downloadsDir, tempId);

    try {
        let downloadName = 'media';
        
        // 2. Query Title (Video title for single, Playlist title for playlist)
        if (format.startsWith('playlist-')) {
            let playlistTitle = 'youtube_playlist';
            try {
                console.log('[INFO] Fetching playlist title...');
                // Fast execution using flat-playlist and end range limit
                const { stdout } = await execPromise(`yt-dlp --flat-playlist --playlist-end 1 --print playlist_title "${url}"`);
                if (stdout && stdout.trim()) {
                    playlistTitle = stdout.trim().replace(/[/\\?%*:|"<>\s]+/g, '_');
                }
            } catch (err) {
                console.warn('[WARN] Failed to fetch playlist title, using default:', err.message);
            }
            downloadName = `${playlistTitle}.zip`;
        } else {
            let videoTitle = 'youtube_video';
            try {
                console.log('[INFO] Fetching video title...');
                const { stdout } = await execPromise(`yt-dlp --get-title "${url}"`);
                if (stdout && stdout.trim()) {
                    videoTitle = stdout.trim().replace(/[/\\?%*:|"<>\s]+/g, '_');
                }
            } catch (titleError) {
                console.warn('[WARN] Failed to fetch video title, using default:', titleError.message);
            }
            downloadName = `${videoTitle}.${format}`;
        }

        // 3. Configure MP4 Quality Formatting
        let formatSelector = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]';
        if (format === 'mp4' || format === 'playlist-mp4') {
            const validQualities = ['best', '720', '480', '360'];
            const chosenQuality = validQualities.includes(quality) ? quality : 'best';

            if (chosenQuality === '720') {
                formatSelector = 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]';
            } else if (chosenQuality === '480') {
                formatSelector = 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]';
            } else if (chosenQuality === '360') {
                formatSelector = 'bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360][ext=mp4]';
            }
        }

        // 4. Construct Command Line execution structures
        let ytDlpCommand = '';
        if (format.startsWith('playlist-')) {
            // Ensure temp directory is created for storing separate elements
            fs.mkdirSync(playlistDir, { recursive: true });

            if (format === 'playlist-mp3') {
                ytDlpCommand = `yt-dlp --yes-playlist -x --audio-format mp3 -o "${playlistDir}/%(title)s.%(ext)s" "${url}"`;
            } else {
                ytDlpCommand = `yt-dlp --yes-playlist -f "${formatSelector}" -o "${playlistDir}/%(title)s.%(ext)s" "${url}"`;
            }
        } else {
            if (format === 'mp3') {
                ytDlpCommand = `yt-dlp --no-playlist -x --audio-format mp3 -o "${finalFilePath}" "${url}"`;
            } else {
                ytDlpCommand = `yt-dlp --no-playlist -f "${formatSelector}" -o "${finalFilePath}" "${url}"`;
            }
        }

        console.log(`[INFO] Executing download command: ${ytDlpCommand}`);

        // 5. Run yt-dlp
        await execPromise(ytDlpCommand);

        // 6. Handle playlist post-processing (zipping the contents folder)
        if (format.startsWith('playlist-')) {
            const downloadedFiles = fs.readdirSync(playlistDir);
            if (downloadedFiles.length === 0) {
                throw new Error('No playlist files were successfully downloaded.');
            }

            console.log(`[INFO] Zipping playlist directory containing ${downloadedFiles.length} files...`);
            // Run native zip compressing flattening subdirectories via junk-paths (-j)
            await execPromise(`zip -j -r "${finalFilePath}" "${playlistDir}"`);

            // Clean up temporary subfolder immediately
            fs.rmSync(playlistDir, { recursive: true, force: true });
        }

        // 7. Verify the final file exists (either media or zip)
        if (!fs.existsSync(finalFilePath)) {
            throw new Error(`Downloaded output file was not found at: ${finalFilePath}`);
        }

        console.log(`[SUCCESS] File prepared: ${downloadName}. Sending to client...`);

        // 8. Stream the file using res.download() and purge on completion
        res.download(finalFilePath, downloadName, (downloadErr) => {
            fs.unlink(finalFilePath, (unlinkErr) => {
                if (unlinkErr) {
                    console.error(`[ERROR] Failed to delete temporary file ${finalFilePath}:`, unlinkErr);
                } else {
                    console.log(`[INFO] Successfully cleaned up temporary file: ${finalFilePath}`);
                }
            });

            if (downloadErr) {
                console.error('[ERROR] Error sending file to client:', downloadErr);
            }
        });

    } catch (error) {
        console.error('[ERROR] Processing failed:', error);
        
        // Clean up any remaining directories/files
        if (fs.existsSync(playlistDir)) {
            fs.rmSync(playlistDir, { recursive: true, force: true });
        }
        if (fs.existsSync(finalFilePath)) {
            fs.unlink(finalFilePath, (err) => {});
        }

        res.status(500).json({ error: 'An error occurred during downloading or converting the media.' });
    }
});

// Start the lightweight Express server
app.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(` TubeFlow server listening on: http://localhost:${PORT}`);
    console.log(`=================================================`);
});
```

---

## 🔒 Security Operations

1. **Injection Block:** Restricts character symbols on URLs. It blocks standard symbols like `&`, `;`, `|`, `$`, and others in the command parameters, preventing shell over-allocations when executing commands inside standard `exec` systems.
2. **File Disposal:** Once the media packet downloads, Node executes `fs.unlink()` in the callback to keep the disk 100% clean of all downloaded materials.
