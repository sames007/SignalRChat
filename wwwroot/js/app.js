// === js/app.js ===
// Entry point for the collaboration app: handles room setup, SignalR & PeerJS connections, and UI initialization.

// 1) Read the room code from the URL query string, defaulting to "TestRoom" if none provided
const urlParams = new URLSearchParams(window.location.search);
const roomName = urlParams.get("room") || "TestRoom";

// 2) Application state variables
let username = "Guest";           // Current user's display name
let localVideoAdded = false;      // Tracks if our own video tile is already in the UI
let peerIdAvailable;              // This client's PeerJS ID once assigned
let peer, connection;             // References for PeerJS and SignalR connections

// 2.5) Map of PeerJS IDs to usernames for labeling video tiles and chat messages
const peerUsernameMap = {};

// 3) Display the active room name in the page header
document.getElementById("roomNameDisplay").innerText = roomName;

// 4) Set up the username input modal and handlers
setupUsernameHandlers();

/**
 * Configures the username prompt:
 *  - Submits on Enter key
 *  - Hides the modal and initializes connections on button click
 */
function setupUsernameHandlers() {
    const input = document.getElementById("usernameInput");
    const btn = document.getElementById("usernameSubmit");

    // Submit when user presses Enter in the input field
    input.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            e.preventDefault();
            btn.click();
        }
    });

    // When the button is clicked, capture the username and start connections
    btn.addEventListener("click", () => {
        const val = input.value.trim();
        if (val) username = val;                          // Update username if non-empty
        document.getElementById("usernameModal").style.display = "none";  // Hide modal
        initializeConnections();                          // Begin SignalR & PeerJS setup
    });
}

/**
 * Initializes the SignalR and PeerJS connections and wires up all real-time event handlers.
 */
function initializeConnections() {
    // Build the SignalR connection to our chatHub endpoint
    connection = new signalR.HubConnectionBuilder()
        .withUrl(`${window.location.origin}/chatHub`, { withCredentials: true })
        .withAutomaticReconnect()
        .configureLogging(signalR.LogLevel.Information)
        .build();

    // ----- SIGNALR EVENT HANDLERS -----

    // 5a) When joining, receive list of existing peers: store their names and call each
    connection.on("ExistingPeers", peers =>
        peers.forEach(({ PeerId, Username }) => {
            peerUsernameMap[PeerId] = Username;
            callPeer(PeerId, Username);
        })
    );

    // 5b) Handle a new user joining the room: store name and call them
    connection.on("UserConnected", (peerId, name) => {
        peerUsernameMap[peerId] = name;
        callPeer(peerId, name);
    });

    // 5c) Handle a user leaving: remove from map and delete their video tile
    connection.on("UserDisconnected", id => {
        delete peerUsernameMap[id];
        removeVideoContainer(id);
    });

    // 5d) Chat messages: append incoming messages to the chat UI
    connection.on("broadcastMessage", (name, msg) =>
        appendChatMessage(name, msg)
    );

    // 5e) Screen sharing started/stopped: toggle a CSS class on that peer's tile
    connection.on("ScreenShareStarted", peerId =>
        document.getElementById(`container-${peerId}`)
            .classList.add("sharing-screen")
    );
    connection.on("ScreenShareStopped", peerId => {
        const tile = document.getElementById(`container-${peerId}`);
        if (tile) tile.classList.remove("sharing-screen");
    });

    // 5f) Recording indicator toggled: flash or toggle the red recording dot
    connection.on("RecordingToggled", peerId => {
        const dot = document.querySelector(`#container-${peerId} .rec-indicator`);
        if (dot) dot.classList.toggle("active");
    });

    // 5g) Virtual background toggled: add/remove 'virtual-bg' class on the video element
    connection.on("VirtualBackgroundToggled", peerId => {
        const video = document.querySelector(`#container-${peerId} video`);
        if (video) video.classList.toggle("virtual-bg");
    });

    // 5h) Hand raise notifications: briefly highlight the peer's tile
    connection.on("UserRaisedHand", peerId => {
        const tile = document.getElementById(`container-${peerId}`);
        if (!tile) return;
        tile.classList.add("hand-raised");
        setTimeout(() => tile.classList.remove("hand-raised"), 5000);
    });

    // ----- START CONNECTIONS -----

    // Start the SignalR connection first
    connection.start()
        .then(() => {
            console.log("Connected to SignalR hub.");

            // Create a new PeerJS instance (auto-generates our PeerID)
            peer = new Peer();

            // 7) When PeerJS assigns us an ID, join the room and get media
            peer.on("open", id => {
                peerIdAvailable = id;

                // Tell server we're in the room, then request webcam/mic access
                connection.invoke("JoinRoom", roomName, id, username)
                    .then(() => navigator.mediaDevices.getUserMedia({ video: true, audio: true }))
                    .then(stream => {
                        // Store our local stream globally for other modules to use
                        window.localStream = stream;
                        peerUsernameMap[id] = username;    // Map our own ID to our username

                        // Add our video tile and update UI indicators
                        addLocalVideo(username);
                        updateStatusIndicator();
                    })
                    .catch(err => console.error("Error during JoinRoom or getUserMedia:", err));
            });

            // 9) Handle incoming calls from other peers
            peer.on("call", call => {
                // Answer with our local media stream
                call.answer(window.localStream);

                // When we receive their stream, label and display it
                call.on("stream", remoteStream => {
                    // Determine caller's name from metadata or fallback to map or short ID
                    const callerName = call.metadata?.username
                        || peerUsernameMap[call.peer]
                        || ("User " + call.peer.slice(0, 5));

                    peerUsernameMap[call.peer] = callerName;
                    addRemoteVideo(call.peer, remoteStream, callerName);
                });

                // Clean up on error or call close
                call.on("error", e => console.error("Incoming call error:", e));
                call.on("close", () => removeVideoContainer(call.peer));
            });
        })
        .catch(err => console.error("SignalR start error:", err));
}
