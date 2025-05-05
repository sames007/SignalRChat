// === js/chat.js ===
// Manages the chat UI and sending/receiving messages via SignalR.

// Cache DOM elements once the script loads (index.html includes this at end of <body>)
const chatBox = document.getElementById("chatBox");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.querySelector(".chat-input button");

// Expose these functions globally so SignalR handlers and inline events can access them
window.appendChatMessage = appendChatMessage;
window.sendChat = sendChat;

/**
 * Appends a chat message to the chat box and scrolls to the latest message.
 *
 * @param {string} name - The sender's username.
 * @param {string} msg  - The message content.
 */
function appendChatMessage(name, msg) {
    // Create a paragraph element and set its text
    const p = document.createElement("p");
    p.innerText = `${name}: ${msg}`;

    // Add the message to the chat box and auto-scroll to bottom
    chatBox.appendChild(p);
    chatBox.scrollTop = chatBox.scrollHeight;
}

/**
 * Sends the current input value to the SignalR hub, then clears the input field.
 */
function sendChat() {
    const text = chatInput.value.trim();
    if (!text) return; // Don't send empty messages

    console.log("sendChat(): sending →", text);
    // Invoke the 'BroadcastMessage' method on the hub with room and user info
    connection.invoke("BroadcastMessage", roomName, username, text)
        .then(() => {
            // Clear the input — the hub will broadcast back and append via broadcastMessage handler
            chatInput.value = "";
        })
        .catch(err => {
            console.error("sendChat error:", err);
            // TODO: Optionally display error feedback to the user
        });
}

// -----------------------------------------------------------------------------
// 1) Send message when the Send button is clicked
if (sendBtn) {
    sendBtn.addEventListener("click", e => {
        e.preventDefault(); // Prevent form submission or page reload
        sendChat();
    });
} else {
    console.error("chat.js: could not find Send button");
}

// -----------------------------------------------------------------------------
// 2) Send message when the Enter key is pressed in the input field
if (chatInput) {
    chatInput.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            e.preventDefault(); // Prevent newline insertion
            sendChat();
        }
    });
} else {
    console.error("chat.js: could not find chat input");
}

// -----------------------------------------------------------------------------
// 3) Listen for incoming messages from the server (including your own)
//    and append them to the chat box.
connection.on("broadcastMessage", (name, msg) => {
    appendChatMessage(name, msg);
});

// Debug: confirm that elements and handlers are set up correctly
console.log("chat.js loaded:", { chatBox, chatInput, sendBtn });
