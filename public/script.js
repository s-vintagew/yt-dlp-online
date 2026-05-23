document.addEventListener('DOMContentLoaded', () => {
    const downloadForm = document.getElementById('download-form');
    const youtubeUrlInput = document.getElementById('youtube-url');
    const formatSelect = document.getElementById('format-select');
    const downloadBtn = document.getElementById('download-btn');
    const statusContainer = document.getElementById('status-container');
    const statusIndicator = document.getElementById('status-indicator');
    const statusTitle = document.getElementById('status-title');
    const statusMessage = document.getElementById('status-message');
    const progressBarContainer = document.getElementById('progress-bar-container');
    const qualityGroup = document.getElementById('quality-group');
    const qualitySelect = document.getElementById('quality-select');

    // Toggle quality selector visibility based on chosen format
    function toggleQualitySelector() {
        const format = formatSelect.value;
        if (format === 'mp4' || format === 'playlist-mp4') {
            qualityGroup.classList.remove('hidden');
        } else {
            qualityGroup.classList.add('hidden');
        }
    }

    formatSelect.addEventListener('change', toggleQualitySelector);
    // Trigger initially to align with default state (mp4 active)
    toggleQualitySelector();

    // Utility function to validate URL format in frontend
    function isValidHttpUrl(string) {
        let url;
        try {
            url = new URL(string);
        } catch (_) {
            return false;  
        }
        return url.protocol === "http:" || url.protocol === "https:";
    }

    // Update frontend state with corresponding styling
    function updateStatus(state, title, message) {
        statusContainer.classList.remove('hidden');
        
        // Reset indicator classes
        statusIndicator.className = 'status-indicator';
        
        switch(state) {
            case 'processing':
                statusIndicator.classList.add('status-processing');
                progressBarContainer.classList.remove('hidden');
                downloadBtn.disabled = true;
                downloadBtn.querySelector('.btn-text').textContent = 'Processing Download...';
                downloadBtn.querySelector('.btn-loader').classList.remove('hidden');
                break;
                
            case 'success':
                statusIndicator.classList.add('status-success');
                progressBarContainer.classList.add('hidden');
                downloadBtn.disabled = false;
                downloadBtn.querySelector('.btn-text').textContent = 'Generate Download Link';
                downloadBtn.querySelector('.btn-loader').classList.add('hidden');
                break;
                
            case 'error':
                statusIndicator.classList.add('status-error');
                progressBarContainer.classList.add('hidden');
                downloadBtn.disabled = false;
                downloadBtn.querySelector('.btn-text').textContent = 'Try Again';
                downloadBtn.querySelector('.btn-loader').classList.add('hidden');
                break;
                
            default:
                statusIndicator.classList.add('status-neutral');
                progressBarContainer.classList.add('hidden');
                downloadBtn.disabled = false;
                downloadBtn.querySelector('.btn-text').textContent = 'Generate Download Link';
                downloadBtn.querySelector('.btn-loader').classList.add('hidden');
        }

        statusTitle.textContent = title;
        statusMessage.textContent = message;
    }

    // Submit handler
    downloadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const urlValue = youtubeUrlInput.value.trim();
        const formatValue = formatSelect.value;
        const qualityValue = qualitySelect.value;

        // 1. Basic frontend validation
        if (!urlValue) {
            updateStatus('error', 'Error', 'Please enter a valid YouTube link.');
            return;
        }

        if (!isValidHttpUrl(urlValue)) {
            updateStatus('error', 'Invalid Link', 'Please provide a valid web address (starting with http:// or https://).');
            return;
        }

        // Check for basic youtube match
        if (!urlValue.includes('youtube.com') && !urlValue.includes('youtu.be')) {
            updateStatus('error', 'Unsupported Platform', 'Please input a valid YouTube URL. We currently specialize in YouTube downloads.');
            return;
        }

        // 2. Set processing state
        updateStatus('processing', 'Fetching Video Info', 'Accessing YouTube servers and fetching media details...');

        try {
            // 3. Perform Fetch Request
            const response = await fetch('/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    url: urlValue,
                    format: formatValue,
                    quality: (formatValue === 'mp4' || formatValue === 'playlist-mp4') ? qualityValue : undefined
                })
            });

            // 4. Handle non-successful responses
            if (!response.ok) {
                // Try parsing JSON error message
                let errorMessage = 'An error occurred while converting the video.';
                try {
                    const errorJson = await response.json();
                    if (errorJson && errorJson.error) {
                        errorMessage = errorJson.error;
                    }
                } catch(_) {}
                throw new Error(errorMessage);
            }

            // 5. Update state for downloading
            updateStatus('processing', 'Downloading File', 'Retrieving converted stream. Your download will start momentarily...');

            // 6. Read stream as a blob
            const fileBlob = await response.blob();
            
            // 7. Parse custom file name from Content-Disposition header
            let fileName = `youtube_media_${Date.now()}.${formatValue}`;
            const dispositionHeader = response.headers.get('content-disposition');
            
            if (dispositionHeader && dispositionHeader.includes('attachment')) {
                const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(dispositionHeader);
                if (matches && matches[1]) {
                    // Remove quotes from matches if present
                    fileName = matches[1].replace(/['"]/g, '');
                }
            }

            // 8. Create dynamic URL and trigger client-side download
            const blobUrl = window.URL.createObjectURL(fileBlob);
            const downloadAnchor = document.createElement('a');
            downloadAnchor.href = blobUrl;
            downloadAnchor.download = fileName;
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            
            // Clean up elements and URLs
            document.body.removeChild(downloadAnchor);
            window.URL.revokeObjectURL(blobUrl);

            // 9. Update state to success
            updateStatus('success', 'Download Complete!', `Successfully downloaded: ${fileName}`);
            
            // Clear URL input field for convenience
            youtubeUrlInput.value = '';

        } catch (error) {
            console.error('Download failure:', error);
            updateStatus('error', 'Operation Failed', error.message || 'Server encountered an unexpected error. Please verify the URL.');
        }
    });
});
