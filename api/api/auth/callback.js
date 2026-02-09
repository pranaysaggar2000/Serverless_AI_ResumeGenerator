const { supabaseAdmin } = require('../../lib/supabase');
const { withCors } = require('../../lib/cors');

/**
 * Escapes HTML characters to prevent XSS
 */
function escapeHtml(unsafe) {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * OAuth callback handler
 * GET /api/auth/callback
 */
module.exports = withCors(async (req, res) => {
  res.setHeader('Content-Type', 'text/html');

  try {
    const { code, error: oauthError } = req.query;

    // 1. Handle OAuth Error
    if (oauthError) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Login Failed - ForgeCV</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
            }
            .container {
              text-align: center;
              padding: 2rem;
              background: rgba(255, 255, 255, 0.1);
              border-radius: 12px;
              backdrop-filter: blur(10px);
            }
            h1 { margin: 0 0 1rem 0; }
            p { margin: 0.5rem 0; opacity: 0.9; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>❌ Login Failed</h1>
            <p>Authentication error: ${escapeHtml(oauthError)}</p>
            <p>You can close this tab.</p>
          </div>
        </body>
        </html>
      `);
    }

    // 2. Handle Token Landing Page (Success state after redirect)
    // If no code and no error, we assume it's the landing page where the extension picks up tokens from the hash
    if (!code) {
      return res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Login Successful - ForgeCV</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
            }
            .container {
              text-align: center;
              padding: 2.5rem;
              background: rgba(255, 255, 255, 0.1);
              border-radius: 16px;
              backdrop-filter: blur(12px);
              box-shadow: 0 8px 32px rgba(0,0,0,0.1);
              max-width: 400px;
            }
            h1 { margin: 0 0 0.5rem 0; font-size: 1.8rem; }
            p { margin: 0.5rem 0; opacity: 0.9; }
            .spinner {
              border: 3px solid rgba(255, 255, 255, 0.2);
              border-top: 3px solid #fff;
              border-radius: 50%;
              width: 32px;
              height: 32px;
              animation: spin 0.8s linear infinite;
              margin: 1.5rem auto;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✅ Login Successful!</h1>
            <div class="spinner"></div>
            <p>Returning to ForgeCV...</p>
            <p style="font-size: 0.85rem; margin-top: 2rem; opacity: 0.7;">This tab will close automatically.</p>
          </div>
          <script>
            // Auth success - extension reads tokens from hash in URL automatically
            setTimeout(() => {
              window.close();
            }, 3000);
          </script>
        </body>
        </html>
      `);
    }

    // 3. Handle Code Exchange
    const { data, error } = await supabaseAdmin.auth.exchangeCodeForSession(code);

    if (error || !data.session) {
      console.error('Session exchange error:', error);
      return res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Session Error - ForgeCV</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #e53e3e 0%, #9b2c2c 100%);
              color: white;
            }
            .container {
              text-align: center;
              padding: 2rem;
              background: rgba(255, 255, 255, 0.1);
              border-radius: 12px;
              backdrop-filter: blur(10px);
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>❌ Session Error</h1>
            <p>Failed to create session. Please try again.</p>
            <p>You can close this tab.</p>
          </div>
        </body>
        </html>
      `);
    }

    // 4. Success - Redirect to self with tokens in hash
    const { access_token, refresh_token } = data.session;

    // Construct the redirect URL with tokens in the hash (fragment)
    // The extension's auth.js listener will pick these up from the URL
    const redirectUrl = `/api/auth/callback#access_token=${access_token}&refresh_token=${refresh_token}`;

    res.setHeader('Location', redirectUrl);
    return res.status(302).end();

  } catch (error) {
    console.error('Callback error:', error);
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error - ForgeCV</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #e53e3e 0%, #9b2c2c 100%);
            color: white;
          }
          .container {
            text-align: center;
            padding: 2rem;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            backdrop-filter: blur(10px);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>❌ Unexpected Error</h1>
          <p>Something went wrong. Please try again.</p>
          <p>You can close this tab.</p>
        </div>
      </body>
      </html>
    `);
  }
});
