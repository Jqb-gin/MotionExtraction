// Get DOM elements
let normalCanvas = document.getElementById('normalVideo');
let delayedCanvas = document.getElementById('delayedCanvas');
let normalCtx = normalCanvas.getContext('2d');
let delayedCtx = delayedCanvas.getContext('2d');
let delaySlider = document.getElementById('delaySlider');
let delayValue = document.getElementById('delayValue');
let zoomSlider = document.getElementById('zoomSlider');
let zoomValue = document.getElementById('zoomValue');
let switchCameraBtn = document.getElementById('switchCamera');

// State variables
let frameBuffer = [];
let DELAY_FRAMES = 30;
let currentFacingMode = 'environment';
let zoomLevel = 1;
let videoElement = null;

// Handle window resizing
function resizeCanvases() {
    normalCanvas.width = window.innerWidth;
    normalCanvas.height = window.innerHeight;
    delayedCanvas.width = window.innerWidth;
    delayedCanvas.height = window.innerHeight;
}

// Convert linear slider value (1-100) to logarithmic frames (1-600)
function sliderToFrames(value) {
    // Convert to log scale: 1 to ~600 frames
    const frames = Math.round(Math.exp(Math.log(600) * value / 100));
    return Math.max(1, Math.min(600, frames));
}

// Convert frames back to slider value
function framesToSlider(frames) {
    return Math.round((Math.log(frames) / Math.log(600)) * 100);
}

// Format the display value
function formatDelay(frames) {
    if (frames < 30) {
        return `${frames} frames`;
    } else {
        const seconds = (frames / 30).toFixed(1);
        return `${seconds}s`;
    }
}

// Update delay when slider changes
delaySlider.addEventListener('input', function() {
    DELAY_FRAMES = sliderToFrames(parseInt(this.value));
    delayValue.textContent = formatDelay(DELAY_FRAMES);
    
    // Adjust buffer size if needed
    while (frameBuffer.length > DELAY_FRAMES) {
        frameBuffer.shift();
    }
});

// Convert zoom slider value (1-100) to zoom level (0.1-3)
function sliderToZoom(value) {
    if (value <= 10) {
        // First 10% of slider maps to 0.1-1 (zoom out)
        return 0.1 + (value - 1) * 0.9 / 9;
    } else {
        // Remaining 90% maps to 1-3 (zoom in)
        return 1 + (value - 10) * 2 / 90;
    }
}

// Convert zoom level back to slider value
function zoomToSlider(zoom) {
    if (zoom <= 1) {
        // Map 0.1-1 to 1-10
        return 1 + (zoom - 0.1) * 9 / 0.9;
    } else {
        // Map 1-3 to 10-100
        return 10 + (zoom - 1) * 90 / 2;
    }
}

// Format zoom display value
function formatZoom(zoom) {
    if (zoom < 1) {
        // Show one decimal place for zoom out
        return `${(zoom * 100).toFixed(1)}%`;
    }
    // Show no decimals for zoom in
    return `${(zoom * 100).toFixed(0)}%`;
}

// Update zoom when slider changes
zoomSlider.addEventListener('input', function() {
    zoomLevel = sliderToZoom(parseInt(this.value));
    zoomValue.textContent = formatZoom(zoomLevel);
});

// Switch camera function
async function switchCamera() {
    currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
    if (videoElement && videoElement.srcObject) {
        const tracks = videoElement.srcObject.getTracks();
        tracks.forEach(track => track.stop());
    }
    await initializeCamera();
}

// Add click handler for switch camera button
if (switchCameraBtn) {
    switchCameraBtn.addEventListener('click', switchCamera);
    // Only show the button if multiple cameras are available
    navigator.mediaDevices.enumerateDevices()
        .then(devices => {
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            switchCameraBtn.style.display = videoDevices.length > 1 ? 'block' : 'none';
        });
}

async function initializeCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: currentFacingMode,
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            } 
        });
        
        // Create/update video element for capturing
        if (!videoElement) {
            videoElement = document.createElement('video');
        }
        videoElement.srcObject = stream;
        videoElement.play();

        // Set up initial canvas sizes
        resizeCanvases();

        // Start processing frames using the video element
        videoElement.onloadedmetadata = () => {
            processFrames();
        };
    } catch (err) {
        console.error('Error accessing camera:', err);
    }
}

function processFrames() {
    if (!videoElement) return;

    // Calculate dimensions for centered zoom
    const vWidth = videoElement.videoWidth;
    const vHeight = videoElement.videoHeight;
    const cWidth = normalCanvas.width;
    const cHeight = normalCanvas.height;

    // Calculate aspect ratios
    const videoRatio = vWidth / vHeight;
    const canvasRatio = cWidth / cHeight;

    // Calculate drawing dimensions
    let drawWidth, drawHeight, offsetX = 0, offsetY = 0;
    if (videoRatio > canvasRatio) {
        // Video is wider than canvas
        drawHeight = cHeight;
        drawWidth = drawHeight * videoRatio;
        offsetX = -(drawWidth - cWidth) / 2;
    } else {
        // Video is taller than canvas
        drawWidth = cWidth;
        drawHeight = drawWidth / videoRatio;
        offsetY = -(drawHeight - cHeight) / 2;
    }

    // Apply zoom
    const zoomedWidth = drawWidth * zoomLevel;
    const zoomedHeight = drawHeight * zoomLevel;
    const zoomOffsetX = (drawWidth - zoomedWidth) / 2 + offsetX;
    const zoomOffsetY = (drawHeight - zoomedHeight) / 2 + offsetY;

    // Clear canvases
    normalCtx.clearRect(0, 0, cWidth, cHeight);
    delayedCtx.clearRect(0, 0, cWidth, cHeight);

    // Draw current frame to normal canvas
    normalCtx.drawImage(videoElement, zoomOffsetX, zoomOffsetY, zoomedWidth, zoomedHeight);
    
    // Get image data to store in buffer
    let currentFrame = normalCtx.getImageData(0, 0, cWidth, cHeight);
    frameBuffer.push(currentFrame);

    // Keep buffer size limited
    if (frameBuffer.length > DELAY_FRAMES) {
        frameBuffer.shift();
    }

    // Draw the most recent frame to normal canvas
    if (frameBuffer.length > 0) {
        let currentFrame = frameBuffer[frameBuffer.length - 1];
        normalCtx.putImageData(currentFrame, 0, 0);
    }

    // Draw delayed frame with inverted colors
    if (frameBuffer.length > 0) {
        let delayedFrame = frameBuffer[0];
        let delayedData = new Uint8ClampedArray(delayedFrame.data);

        // Invert colors
        for (let i = 0; i < delayedData.length; i += 4) {
            delayedData[i] = 255 - delayedData[i];
            delayedData[i + 1] = 255 - delayedData[i + 1];
            delayedData[i + 2] = 255 - delayedData[i + 2];
        }

        delayedCtx.putImageData(new ImageData(delayedData, delayedFrame.width, delayedFrame.height), 0, 0);
    }

    requestAnimationFrame(processFrames);
}

// Handle window resize
window.addEventListener('resize', resizeCanvases);

// Initialize when page loads
window.addEventListener('load', initializeCamera);
