import { state, updateState } from './state.js';
import { API_BASE_URL } from './state.js';

/**
 * Decode JWT payload (base64 decode)
 */
function decodeJWT(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        const payload = parts[1];
        const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
        return JSON.parse(decoded);
    } catch (e) {
        console.error('Failed to decode JWT:', e);
        return null;
    }
}

/**
 * Initiate Google OAuth login flow
 */
export async function loginWithGoogle() {
    try {
        console.log('🔐 Initiating Google OAuth...');

        // Get OAuth URL from backend
        const response = await fetch(`${API_BASE_URL}/api/auth/google`);
        if (!response.ok) {
            throw new Error(`Failed to get OAuth URL: ${response.status}`);
        }

        const { url } = await response.json();
        console.log('✓ Got OAuth URL, opening in new tab...');

        // Open OAuth URL in new tab
        const tab = await chrome.tabs.create({ url });

        // Listen for the callback
        return new Promise((resolve, reject) => {
            let messageReceived = false;

            const timeoutId = setTimeout(() => {
                chrome.tabs.onUpdated.removeListener(listener);
                chrome.runtime.onMessage.removeListener(messageListener);
                if (!messageReceived) {
                    reject(new Error('OAuth timeout - please try again'));
                }
            }, 120000); // 2 minute timeout

            const messageListener = (message) => {
                if (messageReceived) return;
                if (message.type === 'FORGECV_AUTH_SUCCESS') {
                    messageReceived = true;
                    clearTimeout(timeoutId);
                    chrome.tabs.onUpdated.removeListener(listener);
                    chrome.runtime.onMessage.removeListener(messageListener);

                    console.log('✓ Auth tokens received via message');

                    // Close the auth tab
                    chrome.tabs.remove(tab.id).catch(() => { });

                    // Handle the tokens
                    handleAuthTokens(message.accessToken, message.refreshToken)
                        .then(resolve)
                        .catch(reject);
                }
            };

            const listener = async (tabId, changeInfo, updatedTab) => {
                if (tabId !== tab.id || messageReceived) return;

                if (changeInfo.status === 'complete' && updatedTab.url) {
                    // Fallback: Direct URL-based token extraction
                    const url = updatedTab.url;
                    if (url.includes('/api/auth/callback')) {
                        // Extract tokens from hash (#access_token=...&refresh_token=...)
                        const hash = new URL(url).hash;
                        if (hash) {
                            const params = new URLSearchParams(hash.substring(1));
                            const accessToken = params.get('access_token');
                            const refreshToken = params.get('refresh_token');

                            if (accessToken && refreshToken) {
                                messageReceived = true;
                                clearTimeout(timeoutId);
                                chrome.tabs.onUpdated.removeListener(listener);
                                chrome.runtime.onMessage.removeListener(messageListener);

                                console.log('✓ Auth tokens extracted from URL hash');
                                chrome.tabs.remove(tabId).catch(() => { });

                                handleAuthTokens(accessToken, refreshToken)
                                    .then(resolve)
                                    .catch(reject);
                            }
                        }
                    }
                }
            };

            chrome.runtime.onMessage.addListener(messageListener);
            chrome.tabs.onUpdated.addListener(listener);
        });

    } catch (error) {
        console.error('Login failed:', error);
        throw error;
    }
}

/**
 * Handle auth tokens after OAuth callback
 */
export async function handleAuthTokens(accessToken, refreshToken) {
    try {
        console.log('🔑 Processing auth tokens...');

        const payload = decodeJWT(accessToken);
        if (!payload) throw new Error('Invalid access token');

        const user = {
            id: payload.sub,
            email: payload.email,
            name: payload.user_metadata?.name || payload.email?.split('@')[0],
            avatar_url: payload.user_metadata?.avatar_url || null
        };

        await chrome.storage.local.set({
            access_token: accessToken,
            refresh_token: refreshToken,
            user_info: user
        });

        updateState({
            user,
            accessToken,
            refreshToken,
            isLoggedIn: true,
            authMode: 'free'
        });

        await fetchUsageStatus();
        return user;

    } catch (error) {
        console.error('Failed to handle auth tokens:', error);
        throw error;
    }
}

/**
 * Logout and clear auth data
 */
export async function logout() {
    try {
        console.log('👋 Logging out...');
        await chrome.storage.local.remove(['access_token', 'refresh_token', 'user_info']);

        updateState({
            user: null,
            accessToken: null,
            refreshToken: null,
            isLoggedIn: false,
            freeUsage: { used: 0, remaining: 15, limit: 15, resetsAt: null }
        });

        if (state.currentApiKey || state.currentGroqKey || state.currentOpenRouterKey) {
            updateState({ authMode: 'byok' });
        }
    } catch (error) {
        console.error('Logout failed:', error);
    }
}

/**
 * Refresh session using refresh token
 */
export async function refreshSession() {
    try {
        console.log('🔄 Refreshing session...');
        if (!state.refreshToken) throw new Error('No refresh token available');

        // Note: For real Supabase, you'd use their endpoint.
        // For our proxy, we might have a refresh endpoint or call Supabase directly if we have the URL.
        // Assuming we have a backend helper or calling Supabase Auth API directly.
        // Using a generic placeholder for now as per previous implementation.

        const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: state.refreshToken })
        });

        if (!response.ok) throw new Error(`Token refresh failed: ${response.status}`);

        const data = await response.json();

        await chrome.storage.local.set({
            access_token: data.access_token,
            refresh_token: data.refresh_token
        });

        updateState({
            accessToken: data.access_token,
            refreshToken: data.refresh_token
        });

        return data.access_token;
    } catch (error) {
        console.error('Session refresh failed:', error);
        await logout();
        throw error;
    }
}

let tokenRefreshPromise = null;

/**
 * Get a valid access token (refresh if needed)
 */
export async function getValidToken() {
    if (!state.accessToken) throw new Error('Not logged in');

    if (tokenRefreshPromise) return tokenRefreshPromise;

    const payload = decodeJWT(state.accessToken);
    const isExpired = !payload || !payload.exp || (payload.exp < (Math.floor(Date.now() / 1000) + 30));

    if (isExpired) {
        tokenRefreshPromise = refreshSession().finally(() => {
            tokenRefreshPromise = null;
        });
        return tokenRefreshPromise;
    }

    return state.accessToken;
}

/**
 * Fetch current usage status from server
 */
export async function fetchUsageStatus() {
    try {
        const token = await getValidToken();
        const response = await fetch(`${API_BASE_URL}/api/usage/status`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error(`Failed to fetch usage: ${response.status}`);

        const data = await response.json();
        updateState({
            freeUsage: {
                used: data.used,
                remaining: data.remaining,
                limit: data.limit,
                resetsAt: data.resetsAt
            }
        });
        return data;
    } catch (error) {
        console.error('Failed to fetch usage status:', error);
        throw error;
    }
}

/**
 * Call server-side AI (free tier)
 */
export async function callServerAI(prompt, taskType = 'default', expectJson = false, actionId = null, retryCount = 0) {
    try {
        const token = await getValidToken();

        const response = await fetch(`${API_BASE_URL}/api/ai/generate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prompt, taskType, expectJson, actionId })
        });

        if (response.status === 401) {
            if (retryCount >= 1) throw new Error('AUTH_EXPIRED');
            tokenRefreshPromise = refreshSession().finally(() => { tokenRefreshPromise = null; });
            await tokenRefreshPromise;
            return await callServerAI(prompt, taskType, expectJson, actionId, retryCount + 1);
        }

        if (response.status === 429) {
            updateState({ freeUsage: { ...state.freeUsage, remaining: 0 } });
            const { updateUsageDisplay } = await import('./ui.js');
            updateUsageDisplay();
            throw new Error('LIMIT_REACHED');
        }

        if (!response.ok) {
            if (response.status >= 500) throw new Error('SERVER_ERROR');
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }

        const data = await response.json();

        if (data.usage) {
            updateState({
                freeUsage: {
                    ...state.freeUsage,
                    remaining: data.usage.remaining,
                    limit: data.usage.limit,
                    used: data.usage.limit - data.usage.remaining
                }
            });
            const { updateUsageDisplay } = await import('./ui.js');
            updateUsageDisplay();
        }

        return data.result;

    } catch (error) {
        if (['LIMIT_REACHED', 'SERVER_ERROR', 'AUTH_EXPIRED'].includes(error.message)) throw error;
        throw error;
    }
}

/**
 * Load auth state on extension init
 */
export async function loadAuthState() {
    try {
        const data = await chrome.storage.local.get(['access_token', 'refresh_token', 'user_info']);
        if (data.access_token && data.refresh_token && data.user_info) {
            updateState({
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                user: data.user_info,
                isLoggedIn: true,
                authMode: 'free'
            });
            try {
                await fetchUsageStatus();
            } catch (error) {
                await logout();
            }
        }
    } catch (error) {
        console.error('Failed to load auth state:', error);
    }
}
