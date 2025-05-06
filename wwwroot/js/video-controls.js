// === video‑controls.js ===
// Manages local/remote video, recording, screen sharing, and UI updates.

const videoGrid = document.getElementById("videoGrid");
let isRecording = false;
let mediaRecorder = null;
let recordedChunks = [];
let localVideoAdded = false;
let isScreenSharing = false;
let originalStream = null;
const mediaConnections = [];  // store every PeerJS MediaConnection

/**
 * Updates the mic/cam status indicator.
 */
function updateStatusIndicator() {
    if (!window.localStream) return;
    const mic = window.localStream.getAudioTracks()[0]?.enabled ? "On" : "Muted";
    const cam = window.localStream.getVideoTracks()[0]?.enabled ? "On" : "Off";
    document.getElementById("statusIndicator").innerText = `Mic: ${mic} | Camera: ${cam}`;
}

/**
 * Adds the local video (only once).
 */
function addLocalVideo(name) {
    if (localVideoAdded || !window.localStream) return;
    localVideoAdded = true;

    const container = document.createElement("div");
    container.className = "video-container";
    container.id = `container-${peerIdAvailable}`;

    const video = document.createElement("video");
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.srcObject = window.localStream;

    const label = document.createElement("div");
    label.className = "video-label";
    label.innerText = name;

    container.append(video, label);
    videoGrid.appendChild(container);
    updateVideoGridLayout();
}

/**
 * Adds a remote peer’s video (no built‑in controls).
 */
function addRemoteVideo(id, stream, name) {
    if (document.getElementById(`container-${id}`)) return;

    const container = document.createElement("div");
    container.className = "video-container";
    container.id = `container-${id}`;

    const video = document.createElement("video");
    video.autoplay = true;
    video.playsInline = true;
    video.srcObject = stream;

    video.addEventListener("loadedmetadata", () =>
        video.play().catch(console.error)
    );

    const label = document.createElement("div");
    label.className = "video-label";
    label.innerText = name;

    container.append(video, label);
    videoGrid.appendChild(container);
    updateVideoGridLayout();

    // separate audio element to bypass autoplay restrictions
    const audio = new Audio();
    audio.srcObject = stream;
    audio.autoplay = true;
    audio.play().catch(console.error);
}

/**
 * Removes a peer’s video container.
 */
function removeVideoContainer(id) {
    const c = document.getElementById(`container-${id}`);
    if (c) {
        c.remove();
        updateVideoGridLayout();
    }
}

/**
 * Mute/unmute mic.
 */
function toggleMute() {
    const t = window.localStream?.getAudioTracks()[0];
    if (t) {
        t.enabled = !t.enabled;
        updateStatusIndicator();
    }
}

/**
 * Toggles camera on/off and notifies peers.
 */
function toggleCamera() {
    const videoTrack = window.localStream?.getVideoTracks()[0];
    if (!videoTrack) return;

    // 1) Toggle our own camera
    videoTrack.enabled = !videoTrack.enabled;
    updateStatusIndicator();

    // 2) Tell everyone else to toggle our tile
    connection.invoke("ToggleCamera", roomName, peerIdAvailable)
        .catch(console.error);
}

/**
 * Tell server to toggle virtual background blur.
 */
function toggleVirtualBackground() {
    connection.invoke("ToggleVirtualBackground", roomName, peerIdAvailable)
        .catch(console.error);
}

/**
 * Raise hand in UI & notify peers.
 */
function raiseHand() {
    if (!connection || !peerIdAvailable) return;
    connection.invoke("RaiseHand", roomName, peerIdAvailable)
        .then(() => {
            const tile = document.getElementById(`container-${peerIdAvailable}`);
            if (tile) {
                tile.classList.add("hand-raised");
                setTimeout(() => tile.classList.remove("hand-raised"), 5000);
            }
        })
        .catch(console.error);
}

/**
 * Central toggle: calls start or stop under the hood.
 */
async function toggleScreenShare() {
    if (!isScreenSharing) {
        await startScreenShare();
        isScreenSharing = true;
        document.getElementById("screenShareBtnLabel").innerText = "Stop Sharing";
    } else {
        await stopScreenShare();
        isScreenSharing = false;
        document.getElementById("screenShareBtnLabel").innerText = "Share Screen";
    }
}

/**
 * Start screen share, swap tracks on each connection.
 */
async function startScreenShare() {
    try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        const micTrack = window.localStream.getAudioTracks()[0];
        originalStream = window.localStream;

        // auto‑toggle back if user uses browser UI to stop
        screenTrack.onended = () => toggleScreenShare();

        mediaConnections.forEach(conn => {
            const sender = conn.peerConnection.getSenders()
                .find(s => s.track?.kind === "video");
            if (sender) sender.replaceTrack(screenTrack);
        });

        window.localStream = new MediaStream([screenTrack, micTrack]);
        document.querySelector(`#container-${peerIdAvailable} video`)
            .srcObject = window.localStream;

        connection.invoke("StartScreenShare", roomName, peerIdAvailable)
            .catch(console.error);

    } catch (err) {
        console.error("Screen share failed:", err);
    }
}

/**
 * Stop screen share and restore camera.
 */
async function stopScreenShare() {
    try {
        if (!originalStream) return;
        const cameraTrack = originalStream.getVideoTracks()[0];
        const micTrack = originalStream.getAudioTracks()[0];

        mediaConnections.forEach(conn => {
            const sender = conn.peerConnection.getSenders()
                .find(s => s.track?.kind === "video");
            if (sender) sender.replaceTrack(cameraTrack);
        });

        window.localStream = new MediaStream([cameraTrack, micTrack]);
        document.querySelector(`#container-${peerIdAvailable} video`)
            .srcObject = window.localStream;

        connection.invoke("StopScreenShare", roomName, peerIdAvailable)
            .catch(console.error);

        originalStream = null;

    } catch (err) {
        console.error("Stop screen share failed:", err);
    }
}

/**
 * Record/unrecord and download.
 */
function toggleRecording() {
    if (!window.localStream) return;
    if (!isRecording) {
        recordedChunks = [];
        mediaRecorder = new MediaRecorder(window.localStream);
        mediaRecorder.ondataavailable = e => { if (e.data.size) recordedChunks.push(e.data); };
        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: "video/webm" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `recording-${Date.now()}.webm`;
            document.body.append(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        };
        mediaRecorder.start();
        isRecording = true;
        document.getElementById("recordBtnLabel").innerText = "Stop";
    } else {
        mediaRecorder.stop();
        isRecording = false;
        document.getElementById("recordBtnLabel").innerText = "Record";
    }
    connection.invoke("ToggleRecording", roomName, peerIdAvailable)
        .catch(console.error);
}

/**
 * Lay out the video grid.
 */
function updateVideoGridLayout() {
    const count = videoGrid.childElementCount;
    const cols = count <= 1 ? 1 : count <= 4 ? 2 : Math.ceil(Math.sqrt(count));
    videoGrid.style.display = "grid";
    videoGrid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    videoGrid.style.gridAutoRows = "1fr";
    videoGrid.style.gap = "10px";
}

/**
 * Get camera+mic and show local preview.
 */
function initLocalStream(yourName) {
    const constraints = {
        audio: true,
        video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15, max: 30 } }
    };
    navigator.mediaDevices.getUserMedia(constraints)
        .then(stream => {
            window.localStream = stream;
            addLocalVideo(yourName);
            updateStatusIndicator();
            const track = stream.getVideoTracks()[0];
            track.applyConstraints({ frameRate: { ideal: 15 } }).catch(console.warn);
        })
        .catch(err => console.error("getUserMedia failed:", err));
}

/**
 * Outgoing call helper.
 */
function callPeer(peerId, name) {
    if (!window.localStream || !peerId) return;
    const conn = peer.call(peerId, window.localStream, { metadata: { username } });
    mediaConnections.push(conn);
    conn.on("stream", s => addRemoteVideo(peerId, s, name));
    conn.on("close", () => removeVideoContainer(peerId));
    conn.on("error", e => console.error("Call error:", e));
}

// Incoming calls must also be tracked
peer.on("call", conn => {
    conn.answer(window.localStream);
    mediaConnections.push(conn);
    conn.on("stream", s => {
        const caller = conn.metadata?.username || peerUsernameMap[conn.peer] || conn.peer.slice(0, 5);
        addRemoteVideo(conn.peer, s, caller);
    });
    conn.on("close", () => removeVideoContainer(conn.peer));
});
