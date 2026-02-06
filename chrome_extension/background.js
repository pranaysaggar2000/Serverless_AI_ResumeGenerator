// background.js

// Allow clicking the icon to open the side panel
chrome.action.onClicked.addListener((tab) => {
    // Open the side panel in the current window
    chrome.sidePanel.open({ windowId: tab.windowId });
});

// Update badge for Job Descriptions
const JOB_SITES = ['linkedin.com/jobs', 'indeed.com', 'greenhouse.io', 'lever.co', 'myworkdayjobs.com', 'glassdoor.com', 'ashby.hq'];

function updateBadge(tabId, url) {
    if (!url) return;
    const isJobPage = JOB_SITES.some(site => url.includes(site));
    if (isJobPage) {
        chrome.action.setBadgeText({ text: 'JD', tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#10b981', tabId });
    } else {
        chrome.action.setBadgeText({ text: '', tabId });
    }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.active) {
        updateBadge(tabId, tab.url);
    }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        updateBadge(activeInfo.tabId, tab.url);
    } catch (e) {
        // Tab might be closed or inaccessible
    }
});
