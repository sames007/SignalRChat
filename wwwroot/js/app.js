// === js/app.js ===
// Consolidated SignalR + PeerJS initialization for collaboard.

// ---- 1) Read room name from URL ----
const urlParams = new URLSearchParams(window.location.search);
const roomName = urlParams.get("room") || "TestRoom";          // Room code :contentReference[oaicite:9]{index=9}
document.getElementById("roomNameDisplay").innerText = roomName;

// ---- 2) State variables ----
let username = "Guest";               // User’s display name
let connection, peer;                 // SignalR & PeerJS connections
let peerIdAvailable = null;           // Our PeerJS ID once assigned
const peerUsernameMap = {};           // Maps PeerJS IDs → usernames

// ---- 3) Prompt for username & then init connections ----
setupUsernameHandlers();

function setupUsernameHandlers() {
    const input = document.getElementById("usernameInput");
    const btn = document.getElementById("usernameSubmit");

    input.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            e.preventDefault();
            btn.click();
        }
    });

    btn.addEventListener("click", () => {
        const val = input.value.trim();
        if (val) username = val;
        document.getElementById("usernameModal").style.display = "none";
        initialize();  // Start all networking
    });
}

// ---- 4) Main init: build SignalR & PeerJS, wire handlers ----
function initialize() {
    // 4.1) Build the single SignalR connection :contentReference[oaicite:10]{index=10}
    connection = new signalR.HubConnectionBuilder()
        .withUrl("https://collaboard-djb7e8caezeqbnef.centralus-01.azurewebsites.net/chatHub", {
            withCredentials: true
        })
        .withAutomaticReconnect()                                              // reconnect logic :contentReference[oaicite:11]{index=11}
        .configureLogging(signalR.LogLevel.Information)                         // debug logging :contentReference[oaicite:12]{index=12}
        .build();

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

    // 4.3) Start SignalR, then set up PeerJS
    connection.start()
        .then(() => {
            console.log("Connected to SignalR hub.");

            // 4.4) Create PeerJS once hub is live :contentReference[oaicite:17]{index=17}
            peer = new Peer();
            peer.on("open", id => {
                peerIdAvailable = id;
                peerUsernameMap[id] = username;

                // Tell server we've joined, then get our media :contentReference[oaicite:18]{index=18}
                connection.invoke("JoinRoom", roomName, id, username)
                    .then(() => navigator.mediaDevices.getUserMedia({ video: true, audio: true }))
                    .then(stream => {
                        window.localStream = stream;
                        addLocalVideo(username);
                        updateStatusIndicator();
                    })
                    .catch(err => console.error("JoinRoom/getUserMedia error:", err));
            });

            // 4.5) Handle incoming PeerJS calls
            peer.on("call", call => {
                call.answer(window.localStream);  // answer with our media :contentReference[oaicite:19]{index=19}

                call.on("stream", remoteStream => {
                    // Use metadata if set, otherwise lookup from map :contentReference[oaicite:20]{index=20}
                    const callerName = call.metadata?.username
                        || peerUsernameMap[call.peer]
                        || call.peer.slice(0, 5);
                    peerUsernameMap[call.peer] = callerName;
                    addRemoteVideo(call.peer, remoteStream, callerName);
                });

                call.on("error", e => console.error("Call error:", e));
                call.on("close", () => removeVideoContainer(call.peer));
            });
        })
        .catch(err => console.error("SignalR start error:", err));
}

// ---- 5) Helper to initiate outgoing PeerJS calls ----
function callPeer(peerId, name) {
    if (!window.localStream || !peerId) return;
    const outgoing = peer.call(peerId, window.localStream, { metadata: { username } });  // include our name :contentReference[oaicite:21]{index=21}
    outgoing.on("stream", stream => addRemoteVideo(peerId, stream, name));
    outgoing.on("error", err => console.error("Outgoing call error:", err));
    outgoing.on("close", () => removeVideoContainer(peerId));
}
