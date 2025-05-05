// --- js/signalr-connection.js ---
// Sets up and manages the SignalR connection for real-time chat/video collaboration.

// Build the SignalR connection
const connection = new signalR.HubConnectionBuilder()
    // Specify the hub URL and include credentials (cookies/auth headers)
    .withUrl(
        "https://collaboard-djb7e8caezeqbnef.centralus-01.azurewebsites.net/chatHub",
        { withCredentials: true }
    )
    // Automatically attempt to reconnect if the connection drops
    .withAutomaticReconnect()
    // Enable informational logging for debugging
    .configureLogging(signalR.LogLevel.Information)
    .build();

// -----------------------------------------------------------------------------
// 1. Handle list of existing peers when first joining the room.
//    The server sends an array of peer objects: { PeerId, Username }.
//    We call each peer to establish a WebRTC connection.
connection.on("ExistingPeers", peers => {
    peers.forEach(({ PeerId, Username }) => {
        callPeer(PeerId, Username);
    });
});

// -----------------------------------------------------------------------------
// 2. Handle a new user joining the room.
//    Server sends the new peer's ID and username.
//    Log the event and initiate a call to the new user.
connection.on("UserConnected", (peerId, username) => {
    console.log("New user in room:", peerId, username);
    callPeer(peerId, username);
});

// -----------------------------------------------------------------------------
// 3. Handle a user disconnecting.
//    Server sends the ID of the peer who left.
//    Remove that peer's video element/container from the UI.
connection.on("UserDisconnected", id => {
    removeVideoContainer(id);
});

// -----------------------------------------------------------------------------
// 4. Handle incoming chat messages.
//    Server broadcasts messages as (senderName, messageText).
//    Append the message to the chat UI.
connection.on("broadcastMessage", (name, msg) => {
    appendChatMessage(name, msg);
});

// -----------------------------------------------------------------------------
// Start the SignalR connection.
// Log success or catch and log any errors.
connection.start()
    .then(() => console.log("Connected to SignalR hub."))
    .catch(err => console.error("SignalR error:", err));
