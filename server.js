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
    const { url, format } = req.body;

    // 1. Validation
    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL is required.' });
    }

    if (!isValidUrl(url)) {
        return res.status(400).json({ error: 'Invalid or unsafe URL format provided.' });
    }

    if (format !== 'mp4' && format !== 'mp3') {
        return res.status(400).json({ error: 'Format must be either "mp4" or "mp3".' });
    }

    console.log(`[INFO] Received request - Format: ${format}, URL: ${url}`);

    // Create a secure, unique identifier on disk to avoid conflicts
    const tempId = `download_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const finalFilePath = path.join(downloadsDir, `${tempId}.${format}`);

    try {
        // 2. Fetch the video title securely in parallel/ahead to provide a clean name to client
        let videoTitle = 'youtube_video';
        try {
            console.log('[INFO] Fetching video title...');
            const { stdout } = await execPromise(`yt-dlp --get-title "${url}"`);
            if (stdout && stdout.trim()) {
                // Remove filesystem-unfriendly characters and restrict spaces/special symbols to underscores
                videoTitle = stdout.trim().replace(/[/\\?%*:|"<>\s]+/g, '_');
            }
        } catch (titleError) {
            console.warn('[WARN] Failed to fetch video title, using fallback name:', titleError.message);
        }

        // 3. Define commands exactly as specified
        let ytDlpCommand = '';
        if (format === 'mp3') {
            // For MP3: yt-dlp -x --audio-format mp3 -o "<filename>.mp3" "<url>"
            ytDlpCommand = `yt-dlp -x --audio-format mp3 -o "${finalFilePath}" "${url}"`;
        } else {
            // For MP4: yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]" -o "<filename>.mp4" "<url>"
            ytDlpCommand = `yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]" -o "${finalFilePath}" "${url}"`;
        }

        console.log(`[INFO] Executing download command: ${ytDlpCommand}`);

        // 4. Execute yt-dlp securely in the background using child_process.exec
        await execPromise(ytDlpCommand);

        // 5. Verify the file exists on the hard drive
        if (!fs.existsSync(finalFilePath)) {
            throw new Error(`Downloaded file was not created or found at: ${finalFilePath}`);
        }

        const downloadName = `${videoTitle}.${format}`;
        console.log(`[SUCCESS] File downloaded: ${downloadName}. Sending to client...`);

        // 6. Send the downloaded file back to the client using res.download()
        res.download(finalFilePath, downloadName, (downloadErr) => {
            // 7. Once successfully sent or failed, immediately delete the file to save server space
            fs.unlink(finalFilePath, (unlinkErr) => {
                if (unlinkErr) {
                    console.error(`[ERROR] Failed to delete temporary file ${finalFilePath}:`, unlinkErr);
                } else {
                    console.log(`[INFO] Successfully cleaned up temporary file from server: ${finalFilePath}`);
                }
            });

            if (downloadErr) {
                console.error('[ERROR] Error sending file to client:', downloadErr);
            }
        });

    } catch (error) {
        console.error('[ERROR] Processing failed:', error);
        
        // Return 500 error payload
        res.status(500).json({ error: 'An error occurred during downloading or processing the video.' });

        // Cleanup file if it exists but error occurred before res.download
        if (fs.existsSync(finalFilePath)) {
            fs.unlink(finalFilePath, (err) => {
                if (!err) console.log(`[INFO] Cleaned up file on error: ${finalFilePath}`);
            });
        }
    }
});

// Start the lightweight Express server
app.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(` TubeFlow server listening on: http://localhost:${PORT}`);
    console.log(`=================================================`);
});
