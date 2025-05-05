// === ui-controls.js ===
// Handles the slide‑out panel behavior and tab switching logic.

// Get references to the dropdown panel and resize handle elements
const dropdownPanel = document.getElementById("dropdownPanel");
const resizeHandle = document.getElementById("panelResizeHandle");

// Variables for tracking panel resizing
let isResizing = false, startX, startW;

/**
 * Toggles the visibility of the dropdown panel by
 * adding/removing the 'open' CSS class.
 */
function toggleDropdownPanel() {
    dropdownPanel.classList.toggle("open");
}

/**
 * Switches between the 'chat' and 'whiteboard' panels.
 * Highlights the selected tab and shows the corresponding panel.
 * Initializes whiteboard on first open.
 * 
 * @param {string} panel - The panel to activate ('chat' or 'whiteboard')
 */
function showPanel(panel) {
    ["chat", "whiteboard"].forEach(p => {
        document.getElementById(p + "Panel").classList.remove("active");
        document.getElementById(p + "Tab").classList.remove("active");
    });
    document.getElementById(panel + "Panel").classList.add("active");
    document.getElementById(panel + "Tab").classList.add("active");

    // Lazy-load whiteboard setup if needed
    if (panel === "whiteboard" && !wtInitialized) initializeWhiteboard();
}

// === Resizable Panel Logic ===

/**
 * Begins the resizing interaction when the user presses the mouse
 * down on the resize handle.
 */
resizeHandle.addEventListener("mousedown", e => {
    isResizing = true;
    startX = e.clientX; // Store initial mouse X position
    startW = dropdownPanel.offsetWidth; // Store initial panel width
    document.body.style.cursor = "ew-resize"; // Change cursor to resize mode
    e.preventDefault(); // Prevent text selection
});

/**
 * Adjusts the panel width dynamically as the user moves the mouse.
 */
document.addEventListener("mousemove", e => {
    if (!isResizing) return;
    const dx = startX - e.clientX; // Calculate movement delta
    dropdownPanel.style.width = Math.max(startW + dx, 300) + "px"; // Set new width (min 300px)
});

/**
 * Ends the resizing interaction when the mouse is released.
 */
document.addEventListener("mouseup", () => {
    if (isResizing) {
        isResizing = false;
        document.body.style.cursor = "default"; // Restore default cursor
    }
});
