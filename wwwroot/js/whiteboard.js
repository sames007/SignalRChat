// === whiteboard.js ===
// This script handles the initialization of the embedded Whiteboard.Team widget.

// Flag to ensure the whiteboard is only initialized once
let wtInitialized = false;

/**
 * Initializes and renders the Whiteboard.Team widget inside the designated container.
 * This function creates a new instance of the whiteboard using a specific clientId and boardCode.
 * It embeds the whiteboard into the DOM element with the ID "wt-container".
 */
function initializeWhiteboard() {
    new api.WhiteboardTeam("#wt-container", {
        clientId: "826eece0e58a661b21e57fdde1c4b032", // Unique client identifier for Whiteboard.Team API
        boardCode: "22b58b6b-147c-48d4-8c84-6209d3816837" // Unique board identifier (session-specific)
    });

    // Mark as initialized to prevent redundant initializations
    wtInitialized = true;
}
