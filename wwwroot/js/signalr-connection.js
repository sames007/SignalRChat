// Global SignalR connection object
let connection;

// Initialize SignalR connection
function initializeSignalRConnection() {
    connection = new signalR.HubConnectionBuilder()
        .withUrl("/chatHub")
        .withAutomaticReconnect()
        .build();

    // Set up event handlers for SignalR messages
    setupSignalREventHandlers();

    // Start the connection
    return connection
        .start()
        .then(() => console.log("Connected to SignalR hub."))
        .catch((err) => console.error(err));
}

// Set up SignalR event handlers
function setupSignalREventHandlers() {
    // Handle list of existing peers in the room
    connection.on("ExistingPeers", (ids) => ids.forEach(callPeer));

    // Handle new user connecting
    connection.on("UserConnected", (id) => callPeer(id));

    // Handle user disconnecting
    connection.on("UserDisconnected", (id) => removeVideoContainer(id));

    // Handle chat messages
    connection.on("broadcastMessage", appendChatMessage);
}

// Send a chat message to all participants via SignalR
function broadcastChatMessage(message) {
    if (message.trim()) {
        return connection
            .invoke("BroadcastMessage", app.roomName, app.username, message)
            .catch((err) => console.error("Error broadcasting message:", err));
    }
    return Promise.resolve();
}