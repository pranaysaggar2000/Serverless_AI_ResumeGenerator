const { withCors } = require('../lib/cors');

/**
 * Root API handler - provides a nice landing page for the API
 * or handles landing from OAuth redirects.
 */
module.exports = withCors(async (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    // If we have tokens in the path (though they are usually in fragment)
    // or just landing on the root of the API.

    return res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>ForgeCV API</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                    background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    margin: 0;
                    text-align: center;
                }
                .card {
                    background: rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(12px);
                    padding: 40px;
                    border-radius: 24px;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                    max-width: 400px;
                    width: 90%;
                }
                h1 { margin: 0 0 16px; font-weight: 800; }
                p { opacity: 0.9; margin: 0 0 24px; line-height: 1.6; }
                .status-badge {
                    display: inline-block;
                    background: rgba(255, 255, 255, 0.2);
                    padding: 6px 16px;
                    border-radius: 20px;
                    font-size: 14px;
                    font-weight: 600;
                    margin-bottom: 24px;
                }
                .btn {
                    display: inline-block;
                    background: white;
                    color: #6366f1;
                    padding: 12px 24px;
                    border-radius: 12px;
                    text-decoration: none;
                    font-weight: 700;
                    transition: transform 0.2s;
                }
                .btn:hover { transform: translateY(-2px); }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="status-badge">✅ API Online</div>
                <h1>ForgeCV</h1>
                <p>You've reached the backend for ForgeCV. If you were logging in, your session is being processed by the browser extension.</p>
                <a href="#" class="btn" onclick="window.close()">Close this Tab</a>
            </div>
            <script>
                // If tokens are in hash, notify extension (redundant but safe)
                const hash = window.location.hash;
                if (hash && hash.includes('access_token')) {
                    const params = new URLSearchParams(hash.substring(1));
                    const accessToken = params.get('access_token');
                    const refreshToken = params.get('refresh_token');
                    
                    if (accessToken && window.opener) {
                        window.opener.postMessage({
                            type: 'FORGECV_AUTH_SUCCESS',
                            accessToken,
                            refreshToken
                        }, '*');
                        
                        // Close after notifying
                        setTimeout(() => window.close(), 1500);
                    }
                }
            </script>
        </body>
        </html>
    `);
});
