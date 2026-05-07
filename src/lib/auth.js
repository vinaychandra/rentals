import { GOOGLE_CLIENT_ID, SCOPES } from './config.js';

/** @type {google.accounts.oauth2.TokenClient | null} */
let tokenClient = null;

/** @type {string | null} */
let accessToken = null;

/** @type {((token: string) => void) | null} */
let onAuthCallback = null;

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
				return;
			}
			accessToken = response.access_token;
			if (onAuthCallback) {
				onAuthCallback(accessToken);
			}
		}
	});
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
			resolve(token);
		};
		tokenClient.requestAccessToken({ prompt: 'consent' });
	});
}

/**
 * Sign out by revoking the current token.
 */
export function signOut() {
	if (accessToken) {
		google.accounts.oauth2.revoke(accessToken, () => {
			accessToken = null;
		});
	}
	accessToken = null;
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
