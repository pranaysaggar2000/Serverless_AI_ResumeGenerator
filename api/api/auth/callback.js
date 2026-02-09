const { supabaseAdmin } = require('../../lib/supabase');
const { withCors } = require('../../lib/cors');

/**
 * OAuth callback handler
 * GET /api/auth/callback
 */
module.exports = withCors(async (req, res) => {
  try {
    // Extract code from query parameters
    const { code, error: oauthError } = req.query;

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
            <p>Authentication error: ${oauthError}</p>
            <p>You can close this tab.</p>
          </div>
        </body>
        </html>
      `);
    }

    if (!code) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Invalid Request - ForgeCV</title>
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
            <h1>⚠️ Invalid Request</h1>
            <p>Missing authorization code.</p>
            <p>You can close this tab.</p>
          </div>
        </body>
        </html>
      `);
    }

    // Exchange code for session
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
            <h1>❌ Session Error</h1>
            <p>Failed to create session. Please try again.</p>
            <p>You can close this tab.</p>
          </div>
        </body>
        </html>
      `);
    }

    // Success! Return HTML that posts tokens back to extension
    const { access_token, refresh_token } = data.session;

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
            padding: 2rem;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            backdrop-filter: blur(10px);
          }
          h1 { margin: 0 0 1rem 0; }
          p { margin: 0.5rem 0; opacity: 0.9; }
          .spinner {
            border: 3px solid rgba(255, 255, 255, 0.3);
            border-top: 3px solid white;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 1rem auto;
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
          <p>Redirecting back to ForgeCV...</p>
          <p style="font-size: 0.9rem; margin-top: 1.5rem;">You can close this tab if it doesn't close automatically.</p>
        </div>
        <script>
          // Send tokens to extension via postMessage
          if (window.opener) {
            window.opener.postMessage({
              type: 'FORGECV_AUTH_SUCCESS',
              accessToken: '${access_token}',
              refreshToken: '${refresh_token}'
            }, '*');
          }

          // Also try Chrome extension messaging if available
          if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({
              type: 'FORGECV_AUTH_SUCCESS',
              accessToken: '${access_token}',
              refreshToken: '${refresh_token}'
            });
          }

          // Auto-close after 2 seconds
          setTimeout(() => {
            window.close();
          }, 2000);
        </script>
      </body>
      </html>
    `);

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
          <h1>❌ Unexpected Error</h1>
          <p>Something went wrong. Please try again.</p>
          <p>You can close this tab.</p>
        </div>
      </body>
      </html>
    `);
  }
});
