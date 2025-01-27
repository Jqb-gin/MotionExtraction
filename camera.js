// Get DOM elements
let normalCanvas = document.getElementById('normalVideo');
let delayedCanvas = document.getElementById('delayedCanvas');
let normalCtx = normalCanvas.getContext('2d');
let delayedCtx = delayedCanvas.getContext('2d');
let delaySlider = document.getElementById('delaySlider');
let delayValue = document.getElementById('delayValue');

// Array to store video frames for delay
let frameBuffer = [];
let DELAY_FRAMES = 30; // default delay

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

async function initializeCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'environment',
                width: { ideal: window.innerWidth },
                height: { ideal: window.innerHeight }
            } 
        });
        
        // Create a video element for capturing
        const videoElement = document.createElement('video');
        videoElement.srcObject = stream;
        videoElement.play();

        // Set up initial canvas sizes
        resizeCanvases();

        // Start processing frames using the video element
        videoElement.onloadedmetadata = () => {
            processFrames(videoElement);
        };
    } catch (err) {
        console.error('Error accessing camera:', err);
    }
}

function processFrames(videoElement) {
    // Draw current frame to normal canvas first
    normalCtx.drawImage(videoElement, 0, 0, normalCanvas.width, normalCanvas.height);
    
    // Get image data to store in buffer
    let currentFrame = normalCtx.getImageData(0, 0, normalCanvas.width, normalCanvas.height);
    
    // Store frame in buffer
    frameBuffer.push(currentFrame);

    // Keep buffer size limited to delay frames
    if (frameBuffer.length > DELAY_FRAMES) {
        // Remove oldest frame
        frameBuffer.shift();
    }

    // Draw the most recent frame (from end of buffer) to normal canvas
    if (frameBuffer.length > 0) {
        let currentFrame = frameBuffer[frameBuffer.length - 1];
        normalCtx.putImageData(currentFrame, 0, 0);
    }

    // Draw delayed frame (from start of buffer) with inverted colors
    if (frameBuffer.length > 0) {
        let delayedFrame = frameBuffer[0];
        let delayedData = new Uint8ClampedArray(delayedFrame.data);

        // Invert colors
        for (let i = 0; i < delayedData.length; i += 4) {
            delayedData[i] = 255 - delayedData[i];         // Invert red
            delayedData[i + 1] = 255 - delayedData[i + 1]; // Invert green
            delayedData[i + 2] = 255 - delayedData[i + 2]; // Invert blue
        }

        // Draw delayed frame
        delayedCtx.putImageData(new ImageData(delayedData, delayedFrame.width, delayedFrame.height), 0, 0);
    }

    // Continue processing frames
    requestAnimationFrame(() => processFrames(videoElement));
}

// Handle window resize
window.addEventListener('resize', resizeCanvases);

// Initialize when page loads
window.addEventListener('load', initializeCamera);
