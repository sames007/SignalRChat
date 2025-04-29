// Update status indicator for mic and camera
function updateStatusIndicator() {
    if (!app.localStream) return;

    const mic = app.localStream.getAudioTracks()[0].enabled
        ? "On"
        : "Muted";
    const cam = app.localStream.getVideoTracks()[0].enabled
        ? "On"
        : "Off";

    document.getElementById("statusIndicator").innerText = `Mic: ${mic} | Camera: ${cam}`;
}

// Toggle microphone on/off
function toggleMute() {
    app.localStream.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
    updateStatusIndicator();
}

// Toggle camera on/off
function toggleCamera() {
    app.localStream.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
    updateStatusIndicator();
}

// Start screen sharing
async function startScreenShare() {
    try {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const container = document.getElementById("container-" + app.peerIdAvailable);

        if (container) {
            const videoEl = container.querySelector("video");
            videoEl.srcObject = screen;

            // Return to webcam when screen sharing ends
            screen.getVideoTracks()[0].addEventListener("ended", () => {
                videoEl.srcObject = app.localStream;
            });
        }
    } catch (err) {
        console.error("Screen share error:", err);
    }
}

// Toggle video recording
function toggleRecording() {
    if (!app.recording) {
        // Start recording
        app.mediaRecorder = new MediaRecorder(app.localStream);
        app.mediaRecorder.ondataavailable = (e) =>
            e.data.size && app.recordedChunks.push(e.data);

        app.mediaRecorder.onstop = () => {
            const blob = new Blob(app.recordedChunks, { type: "video/webm" });
            window.open(URL.createObjectURL(blob));
            app.recordedChunks = [];
        };

        app.mediaRecorder.start();
        app.recording = true;
        document.getElementById("recordBtnLabel").innerText = "Stop";
    } else {
        // Stop recording
        app.mediaRecorder.stop();
        app.recording = false;
        document.getElementById("recordBtnLabel").innerText = "Record";
    }
}

// Toggle virtual background effect
function toggleVirtualBackground() {
    const c = document.getElementById("container-" + app.peerIdAvailable);
    if (c) c.querySelector("video").classList.toggle("virtual-bg");
}

// Show a raised hand indicator
function raiseHand() {
    const div = document.createElement("div");
    div.className = "hand-indicator";
    div.innerText = "Hand Raised";
    document.querySelector(".video-area").appendChild(div);
    setTimeout(() => div.remove(), 5000);
}