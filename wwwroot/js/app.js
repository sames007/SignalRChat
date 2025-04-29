// Main application variables and state
const app = {
    // Room information
    roomName: '',

    // User information
    username: 'Guest',
    usernameSet: false,

    // Media and connections
    localStream: null,
    localVideoAdded: false,
    peerIdAvailable: null,

    // Recording state
    mediaRecorder: null,
    recordedChunks: [],
    recording: false
};

// Initialize the application
function initializeApp() {
    // 1. Get the room name from URL params
    const urlParams = new URLSearchParams(window.location.search);
    app.roomName = urlParams.get("room") || "TestRoom";
    document.getElementById("roomNameDisplay").innerText = app.roomName;

    // 2. Set up username input event listeners
    setupUsernameHandlers();

    // 3. Initialize all connections and media
    initializeConnections();
}

// Set up username input event listeners
function setupUsernameHandlers() {
    const usernameInput = document.getElementById("usernameInput");

    // Allow Enter key to submit username
    usernameInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            document.getElementById("usernameSubmit").click();
        }
    });

    // Handle username submission
    document.getElementById("usernameSubmit").addEventListener("click", () => {
        const val = usernameInput.value.trim();
        if (val) app.username = val;
        app.usernameSet = true;
        document.getElementById("usernameModal").style.display = "none";

        // If PeerJS ID is already available, join room immediately
        if (app.peerIdAvailable && !app.localVideoAdded) {
            addLocalVideo(app.username);
            connection
                .invoke("JoinRoom", app.roomName, app.peerIdAvailable)
                .catch((err) => console.error(err));
        }
    });
}

// Main initialization function to set up all connections
function initializeConnections() {
    // 1. Get media stream
    const mediaPromise = navigator.mediaDevices
        .getUserMedia({ video: { width: 1280, height: 720 }, audio: true })
        .then((stream) => {
            app.localStream = stream;
            updateStatusIndicator();
        });

    // 2. Initialize PeerJS
    const peerPromise = initializePeerConnection();

    // 3. Initialize SignalR
    const signalRPromise = initializeSignalRConnection();

    // 4. Once all promises resolve, join the room
    Promise.all([mediaPromise, peerPromise, signalRPromise])
        .then(([, id]) => {
            if (app.usernameSet && !app.localVideoAdded) {
                addLocalVideo(app.username);
                return connection.invoke("JoinRoom", app.roomName, id);
            }
        })
        .catch((err) => console.error("Startup error:", err));
}

// Start the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);