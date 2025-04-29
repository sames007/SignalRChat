// Add a message to the chat display
function appendChatMessage(name, message) {
    const p = document.createElement("p");
    p.innerText = `${name}: ${message}`;

    const box = document.getElementById("chatBox");
    box.appendChild(p);
    box.scrollTop = box.scrollHeight;
}

// Send a chat message
function sendChat() {
    const txt = document.getElementById("chatInput");

    if (txt.value.trim()) {
        broadcastChatMessage(txt.value)
            .then(() => {
                appendChatMessage(app.username, txt.value);
                txt.value = "";
            });
    }
}

// Set up chat input event listener
function setupChatEventListeners() {
    document.getElementById("chatInput").addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            sendChat();
            e.preventDefault();
        }
    });
}

// Initialize chat functionality when the DOM is loaded
document.addEventListener('DOMContentLoaded', setupChatEventListeners);