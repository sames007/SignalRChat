// Track if whiteboard has been initialized
let wtInitialized = false;

// Initialize the whiteboard
function initializeWhiteboard() {
    new api.WhiteboardTeam("#wt-container", {
        clientId: "826eece0e58a661b21e57fdde1c4b032",
        boardCode: "22b58b6b-147c-48d4-8c84-6209d3816837"
    });

    wtInitialized = true;
}