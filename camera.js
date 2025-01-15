// Get DOM elements
let normalVideo = document.getElementById('normalVideo');
let canvas = document.getElementById('delayedCanvas');
let ctx = canvas.getContext('2d');
let delaySlider = document.getElementById('delaySlider');
let delayValue = document.getElementById('delayValue');

// Array to store video frames for delay
let frameBuffer = [];
let DELAY_FRAMES = 30; // default delay

// Handle window resizing
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
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
        normalVideo.srcObject = stream;
        normalVideo.play();

        // Set up initial canvas size
        resizeCanvas();

        // Start processing frames
        processFrames();
    } catch (err) {
        console.error('Error accessing camera:', err);
    }
}

function processFrames() {
    // Capture current frame
    ctx.drawImage(normalVideo, 0, 0, canvas.width, canvas.height);
    
    // Get image data to manipulate pixels
    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Store frame in buffer
    frameBuffer.push(imageData);

    // Keep buffer size limited to delay frames
    if (frameBuffer.length > DELAY_FRAMES) {
        // Get delayed frame
        let delayedFrame = frameBuffer.shift();
        let delayedData = delayedFrame.data;

        // Invert colors only (no opacity change)
        for (let i = 0; i < delayedData.length; i += 4) {
            delayedData[i] = 255 - delayedData[i];         // Invert red
            delayedData[i + 1] = 255 - delayedData[i + 1]; // Invert green
            delayedData[i + 2] = 255 - delayedData[i + 2]; // Invert blue
        }

        // Draw delayed frame
        ctx.putImageData(delayedFrame, 0, 0);
    }

    // Continue processing frames
    requestAnimationFrame(processFrames);
}

// Handle window resize
window.addEventListener('resize', resizeCanvas);

// Initialize when page loads
window.addEventListener('load', initializeCamera);
