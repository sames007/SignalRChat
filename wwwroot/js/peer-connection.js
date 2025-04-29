// Global peer object
let peer;

// Initialize PeerJS connection
function initializePeerConnection() {
    peer = new Peer();

    return new Promise((resolve) => {
        peer.on("open", (id) => {
            app.peerIdAvailable = id;
            console.log("Peer ID:", id);
            resolve(id);
        });
    });
}

// Set up event handlers for incoming peer calls
function setupPeerEventHandlers() {
    peer.on("call", (call) => {
        call.answer(app.localStream);
        call.on("stream", (s) =>
            addRemoteVideo(call.peer, s, "User " + call.peer.slice(0, 5))
        );
        call.on("close", () => removeVideoContainer(call.peer));
        call.on("error", (e) => console.error("Peer call error:", e));
    });
}

// Initiate a call to a newly connected peer
function callPeer(remoteId) {
    if (remoteId === app.peerIdAvailable) return;

    const c = peer.call(remoteId, app.localStream);

    c.on("stream", (s) =>
        addRemoteVideo(remoteId, s, "User " + remoteId.slice(0, 5))
    );
    c.on("close", () => removeVideoContainer(remoteId));
    c.on("error", (e) => console.error("Call error:", e));
}

// Add local video to the grid
function addLocalVideo(name) {
    if (app.localVideoAdded) return;
    app.localVideoAdded = true;

    const container = document.createElement("div");
    container.className = "video-container";
    container.id = "container-" + app.peerIdAvailable;

    const vid = document.createElement("video");
    vid.autoplay = true;
    vid.muted = true;
    vid.playsInline = true;
    vid.srcObject = app.localStream;

    const label = document.createElement("div");
    label.className = "video-label";
    label.innerText = name;

    container.append(vid, label);
    document.getElementById("videoGrid").appendChild(container);
    updateVideoGridLayout();
}

// Add remote video to the grid
function addRemoteVideo(id, stream, name) {
    if (document.getElementById("container-" + id)) return;

    const container = document.createElement("div");
    container.className = "video-container";
    container.id = "container-" + id;

    const vid = document.createElement("video");
    vid.autoplay = true;
    vid.playsInline = true;
    vid.srcObject = stream;

    const label = document.createElement("div");
    label.className = "video-label";
    label.innerText = name;

    container.append(vid, label);
    document.getElementById("videoGrid").appendChild(container);
    updateVideoGridLayout();
}

// Remove a video container when peer disconnects
function removeVideoContainer(id) {
    const c = document.getElementById("container-" + id);
    if (c) {
        c.remove();
        updateVideoGridLayout();
    }
}

// Update the video grid layout based on the number of participants
function updateVideoGridLayout() {
    const videoGrid = document.getElementById("videoGrid");
    const count = videoGrid.childElementCount;

    videoGrid.style.gridTemplateColumns =
        count <= 1
            ? "1fr"
            : count === 2
                ? "1fr 1fr"
                : count <= 4
                    ? "1fr 1fr"
                    : "repeat(auto-fit, minmax(300px,1fr))";
}

// Set up peer event handlers when the script loads
document.addEventListener('DOMContentLoaded', setupPeerEventHandlers);