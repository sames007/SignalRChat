// Toggle the side panel (chat/whiteboard)
function toggleDropdownPanel() {
    document.getElementById("dropdownPanel").classList.toggle("open");
}

// Switch between chat and whiteboard panels
function showPanel(panel) {
    ["chat", "whiteboard"].forEach((p) => {
        document.getElementById(p + "Panel").classList.remove("active");
        document.getElementById(p + "Tab").classList.remove("active");
    });

    document.getElementById(panel + "Panel").classList.add("active");
    document.getElementById(panel + "Tab").classList.add("active");

    // Initialize whiteboard if it's the first time showing it
    if (panel === "whiteboard" && !wtInitialized) initializeWhiteboard();
}

// Set up panel resize functionality
function setupPanelResize() {
    const resizeHandle = document.getElementById("panelResizeHandle");
    const dropdownPanel = document.getElementById("dropdownPanel");
    let isResizing = false, startX, startW;

    resizeHandle.addEventListener("mousedown", (e) => {
        isResizing = true;
        startX = e.clientX;
        startW = dropdownPanel.offsetWidth;
        document.body.style.cursor = "ew-resize";
        e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
        if (!isResizing) return;
        const dx = startX - e.clientX;
        dropdownPanel.style.width = Math.max(startW + dx, 300) + "px";
    });

    document.addEventListener("mouseup", () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = "default";
        }
    });
}

// Initialize UI controls when the DOM is loaded
document.addEventListener('DOMContentLoaded', setupPanelResize);