// === video-controls.js ===
// Manages the local and remote video grid, recording, screen sharing, and UI status indicators.

const videoGrid = document.getElementById("videoGrid");  // Container for all video tiles
let isRecording = false;                                  // Recording state flag
let mediaRecorder = null;                                 // MediaRecorder instance for recording
let recordedChunks = [];                                  // Collected recording data chunks

/**
 * Updates the on-screen mic/camera status indicator based on the local stream.
 */
function updateStatusIndicator() {
    if (!localStream) return;
    const mic = localStream.getAudioTracks()[0].enabled ? "On" : "Muted";
    const cam = localStream.getVideoTracks()[0].enabled ? "On" : "Off";
    document.getElementById("statusIndicator").innerText =
        `Mic: ${mic} | Camera: ${cam}`;
}

/**
 * Adds the local user's video to the grid (only once).
 * @param {string} name - Display name to show under the video.
 */
function addLocalVideo(name) {
    if (localVideoAdded) return;
    localVideoAdded = true;

    const container = document.createElement("div");
    container.className = "video-container";
    container.id = "container-" + peerIdAvailable;

    const video = document.createElement("video");
    video.autoplay = true;
    video.muted = true;       // Mute self to avoid echo
    video.playsInline = true;
    video.srcObject = localStream;

    const label = document.createElement("div");
    label.className = "video-label";
    label.innerText = name;

    container.append(video, label);
    videoGrid.appendChild(container);
    updateVideoGridLayout();
}

/**
 * Toggles the mute state of the local audio track.
 */
function toggleMute() {
    if (!window.localStream) return;
    const audioTracks = window.localStream.getAudioTracks();
    if (!audioTracks.length) return;

    audioTracks[0].enabled = !audioTracks[0].enabled;
    updateStatusIndicator();
}

/**
 * Toggles the enabled state of the local video track.
 */
function toggleCamera() {
    const stream = window.localStream;
    if (!stream) return;
    const videoTracks = stream.getVideoTracks();
    if (!videoTracks.length) return;

    videoTracks[0].enabled = !videoTracks[0].enabled;
    updateStatusIndicator();
}

/**
 * Requests the server to toggle virtual background for this peer.
 */
function toggleVirtualBackground() {
    connection.invoke("ToggleVirtualBackground", roomName, peerIdAvailable)
        .catch(console.error);
}

/**
 * Raises the user's hand: visually marks their tile and notifies peers.
 */
function raiseHand() {
    console.log("raiseHand() called");
    if (!connection || !peerIdAvailable) {
        console.warn("No connection or peerId yet");
        return;
    }

    connection.invoke("RaiseHand", roomName, peerIdAvailable)
        .then(() => {
            // Highlight own tile immediately
            const myTile = document.getElementById(`container-${peerIdAvailable}`);
            if (myTile) {
                myTile.classList.add('hand-raised');
                // Remove highlight after 5 seconds
                setTimeout(() => myTile.classList.remove('hand-raised'), 5000);
            }
        })
        .catch(err => console.error("raiseHand invoke failed:", err));
}

/**
 * Starts a screen share by replacing video tracks on all peer connections
 * and notifying others.
 */
async function startScreenShare() {
    if (!window.localStream || !peer) return;

    try {
        // 1) Capture display media (screen)
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];

        // 2) When user stops screen share in browser UI, call stopScreenShare()
        screenTrack.onended = () => stopScreenShare();

        // 3) Replace each PeerJS connection's video sender with the screen track
        Object.values(peer.connections).forEach(connArr =>
            connArr.forEach(conn => {
                if (conn.peerConnection) {
                    const sender = conn.peerConnection.getSenders()
                        .find(s => s.track && s.track.kind === "video");
                    if (sender) sender.replaceTrack(screenTrack);
                }
            })
        );

        // 4) Combine screen track with mic track for localStream
        const micTrack = window.localStream.getAudioTracks()[0];
        const mixed = new MediaStream([screenTrack, micTrack]);
        window.localStream = mixed;

        // 5) Update the local video element to show the screen
        document.querySelector(`#container-${peerIdAvailable} video`)
            .srcObject = mixed;

        // 6) Notify peers that screen sharing has started
        connection.invoke("StartScreenShare", roomName, peerIdAvailable)
            .catch(console.error);
    } catch (err) {
        console.error("Screen share failed:", err);
    }
}

/**
 * Stops screen sharing and restores the camera video track on all connections.
 */
async function stopScreenShare() {
    if (!window.localStream || !peer) return;

    try {
        // 1) Get a fresh camera-only track
        const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const cameraTrack = camStream.getVideoTracks()[0];

        // 2) Replace screen track with camera track on all peer connections
        Object.values(peer.connections).forEach(connArr =>
            connArr.forEach(conn => {
                if (conn.peerConnection) {
                    const sender = conn.peerConnection.getSenders()
                        .find(s => s.track && s.track.kind === "video");
                    if (sender) sender.replaceTrack(cameraTrack);
                }
            })
        );

        // 3) Replace localStream tracks: remove old, add new
        const oldTracks = window.localStream.getVideoTracks();
        oldTracks.forEach(t => window.localStream.removeTrack(t));
        window.localStream.addTrack(cameraTrack);

        // 4) Update the local video element
        document.querySelector(`#container-${peerIdAvailable} video`)
            .srcObject = window.localStream;

        // 5) Notify peers that screen sharing has stopped
        connection.invoke("StopScreenShare", roomName, peerIdAvailable)
            .catch(console.error);
    } catch (err) {
        console.error("Stop share failed:", err);
    }
}

/**
 * Starts or stops recording of the localStream.
 * When stopped, creates and downloads a .webm recording file.
 */
function toggleRecording() {
    if (!window.localStream) return;

    if (!isRecording) {
        // --- Start recording ---
        recordedChunks = [];
        mediaRecorder = new MediaRecorder(window.localStream);
        mediaRecorder.ondataavailable = e => {
            if (e.data.size) recordedChunks.push(e.data);
        };
        mediaRecorder.onstop = () => {
            // Create blob, temporary link, and trigger download
            const blob = new Blob(recordedChunks, { type: "video/webm" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.style.display = "none";
            a.href = url;
            a.download = `recording-${Date.now()}.webm`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        };

        mediaRecorder.start();
        isRecording = true;
        document.getElementById("recordBtnLabel").innerText = "Stop";

        // Notify peers about recording state change
        connection.invoke("ToggleRecording", roomName, peerIdAvailable)
            .catch(err => console.error("toggleRecording invoke failed:", err));

    } else {
        // --- Stop recording ---
        mediaRecorder.stop();
        isRecording = false;
        document.getElementById("recordBtnLabel").innerText = "Record";

        // Notify peers about recording state change
        connection.invoke("ToggleRecording", roomName, peerIdAvailable)
            .catch(err => console.error("toggleRecording invoke failed:", err));
    }
}

/**
 * Adds a remote peer's video stream to the grid.
 * @param {string} id     - PeerJS ID of the remote user.
 * @param {MediaStream} stream - Remote user's media stream.
 * @param {string} name   - Display name under the video.
 */
function addRemoteVideo(id, stream, name) {
    if (document.getElementById("container-" + id)) return;

    const container = document.createElement("div");
    container.className = "video-container";
    container.id = "container-" + id;

    const video = document.createElement("video");
    video.autoplay = true;
    video.playsInline = true;
    video.srcObject = stream;

    const label = document.createElement("div");
    label.className = "video-label";
    label.innerText = name;

    container.append(video, label);
    videoGrid.appendChild(container);
    updateVideoGridLayout();
}

/**
 * Removes a peer's video container from the grid on disconnect.
 * @param {string} id - PeerJS ID of the user to remove.
 */
function removeVideoContainer(id) {
    const c = document.getElementById("container-" + id);
    if (c) {
        c.remove();
        updateVideoGridLayout();
    }
}

/**
 * Adjusts the CSS grid layout based on the number of video tiles:
 *  - 1 tile: full width
 *  - 2–4 tiles: 2 columns
 *  - 5+ tiles: columns = ceil(sqrt(count))
 */
function updateVideoGridLayout() {
    const count = videoGrid.childElementCount;
    const cols = count <= 1
        ? 1
        : count <= 4
            ? 2
            : Math.ceil(Math.sqrt(count));

    videoGrid.style.display = "grid";
    videoGrid.style.gridTemplateColumns = `repeat(${cols},1fr)`;
    videoGrid.style.gridAutoRows = "1fr";
    videoGrid.style.gap = "10px";
}
