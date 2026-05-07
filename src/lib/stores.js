import { writable } from 'svelte/store';

/** Whether the user is signed in */
export const authenticated = writable(false);

/** Loading state for async operations */
export const loading = writable(false);

/** Global error message */
export const errorMessage = writable('');

/**
 * Show a temporary error message.
 * @param {string} msg
 * @param {number} [duration=5000]
 */
export function showError(msg, duration = 5000) {
	errorMessage.set(msg);
	setTimeout(() => errorMessage.set(''), duration);
}
