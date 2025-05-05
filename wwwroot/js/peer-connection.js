// --- js/peer-connection.js ---
// Manages initiating and handling peer-to-peer calls using WebRTC (via PeerJS).

/**
 * Initiates a call to a remote peer and sets up event handlers for their stream.
 *
 * @param {string} remoteId   - The PeerJS ID of the remote peer to call.
 * @param {string} remoteName - The username of the remote peer (for UI labels).
 */
function callPeer(remoteId, remoteName) {
    // Don't call yourself if your own peer ID is passed in
    if (remoteId === peerIdAvailable) return;

    // ---------------------------------------------------------------------------
    // 1) Keep track of the remote peer's username for UI purposes
    peerUsernameMap[remoteId] = remoteName;

    // ---------------------------------------------------------------------------
    // 2) Place the call, sending your local media stream and your username as metadata
    const c = peer.call(remoteId, localStream, {
        metadata: { username: username }
    });

    // ---------------------------------------------------------------------------
    // 3) When the remote stream is received:
    //    - Add a video element for this user
    //    - Label it with the remoteName to identify the speaker
    c.on("stream", stream => {
        addRemoteVideo(remoteId, stream, remoteName);
    });

    // Remove the video element when the call ends
    c.on("close", () => removeVideoContainer(remoteId));

    // Log any errors during the call lifecycle
    c.on("error", e => console.error("Call error:", e));
}
