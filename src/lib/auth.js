import { GOOGLE_CLIENT_ID, SCOPES } from './config.js';

const TOKEN_KEY = 'rentals_access_token';

/** @type {google.accounts.oauth2.TokenClient | null} */
let tokenClient = null;

/** @type {string | null} */
let accessToken = null;

/** @type {((token: string) => void) | null} */
let onAuthCallback = null;

/** @type {((err: Error) => void) | null} */
let onAuthError = null;

/**
 * Initialize the Google Identity Services token client.
 * Must be called after the GIS script has loaded.
 */
export function initAuth() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: (response) => {
            if (response.error) {
                console.error('Auth error:', response.error);
                if (onAuthError) onAuthError(new Error(response.error));
                return;
            }
            accessToken = response.access_token;
            localStorage.setItem(TOKEN_KEY, accessToken);
            if (onAuthCallback) {
                onAuthCallback(accessToken);
            }
        },
        error_callback: (err) => {
            // Fires when user closes the popup or an error occurs
            console.warn('Auth popup closed or error:', err);
            if (onAuthError) onAuthError(new Error(err?.message || 'Sign-in cancelled'));
        }
    });
}

/**
 * Try to restore a previous session by validating the stored token.
 * Returns true if the session was restored, false otherwise.
 * @returns {Promise<boolean>}
 */
export async function tryRestoreSession() {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) return false;

    // Validate the token with a lightweight Google API call
    try {
        const res = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${encodeURIComponent(stored)}`);
        if (!res.ok) {
            localStorage.removeItem(TOKEN_KEY);
            return false;
        }
        accessToken = stored;
        return true;
    } catch {
        localStorage.removeItem(TOKEN_KEY);
        return false;
    }
}

/**
 * Prompt the user to sign in via Google OAuth.
 * Returns a promise that resolves with the access token.
 * @returns {Promise<string>}
 */
export function signIn() {
    return new Promise((resolve, reject) => {
        if (!tokenClient) {
            reject(new Error('Auth not initialized. Call initAuth() first.'));
            return;
        }
        onAuthCallback = (token) => {
            onAuthError = null;
            resolve(token);
        };
        onAuthError = (err) => {
            onAuthCallback = null;
            reject(err);
        };
        tokenClient.requestAccessToken({ prompt: '' });
    });
}

/**
 * Sign out by revoking the current token.
 */
export function signOut() {
    if (accessToken) {
        google.accounts.oauth2.revoke(accessToken, () => { });
    }
    accessToken = null;
    localStorage.removeItem(TOKEN_KEY);
}

/**
 * Get the current access token, or null if not signed in.
 * @returns {string | null}
 */
export function getToken() {
    return accessToken;
}

/**
 * Check if user is currently signed in.
 * @returns {boolean}
 */
export function isSignedIn() {
    return accessToken !== null;
}
