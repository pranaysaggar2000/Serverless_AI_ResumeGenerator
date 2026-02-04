// background.js

// Allow clicking the icon to open the side panel
chrome.action.onClicked.addListener((tab) => {
    // Open the side panel in the current window
    chrome.sidePanel.open({ windowId: tab.windowId });
});
