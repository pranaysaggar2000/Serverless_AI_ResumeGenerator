(function () {
    function loadPopup() {
        var m = document.createElement('script');
        m.type = 'module';
        m.src = 'popup.js';
        document.body.appendChild(m);
    }

    if (typeof chrome === 'undefined' || !chrome.storage) {
        console.log("Dev Mode: Loading mock_chrome.js");
        var s = document.createElement('script');
        s.src = 'mock_chrome.js';
        s.onload = loadPopup;
        s.onerror = function () {
            console.error("Failed to load mock_chrome.js");
            // Fallback just in case
            loadPopup();
        };
        document.head.appendChild(s);
    } else {
        loadPopup();
    }
})();
