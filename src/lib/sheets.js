import { SHEETS_API_BASE, SHEET_ID, SHEET_NAMES } from './config.js';
import { getToken } from './auth.js';

/** Header rows for each sheet tab */
const TAB_HEADERS = {
	[SHEET_NAMES.PROPERTIES]: ['ID', 'Name', 'Address', 'MonthlyRent', 'TenantName', 'TenantContact', 'Status', 'Notes'],
	[SHEET_NAMES.RENTAL_PAYMENTS]: ['ID', 'PropertyID', 'Month', 'Amount', 'Method', 'Date', 'Notes'],
	[SHEET_NAMES.ELECTRICITY_CLIENTS]: ['ID', 'Name', 'Contact', 'MeterNumber', 'Status', 'Notes'],
	[SHEET_NAMES.ELECTRICITY_BILLS]: ['ID', 'Month', 'TotalAmount', 'Date', 'Notes'],
	[SHEET_NAMES.METER_READINGS]: ['ID', 'BillID', 'ClientID', 'PreviousReading', 'CurrentReading', 'Units'],
	[SHEET_NAMES.ELECTRICITY_PAYMENTS]: ['ID', 'BillID', 'ClientID', 'AmountDue', 'AmountPaid', 'Method', 'Date', 'Status']
};

/**
 * Get authorization headers for API requests.
 * @returns {Record<string, string>}
 */
function authHeaders() {
	const token = getToken();
	if (!token) throw new Error('Not authenticated');
	return {
		Authorization: `Bearer ${token}`,
		'Content-Type': 'application/json'
	};
}

/**
 * Read all rows from a sheet tab.
 * @param {string} sheetName - The tab name to read from
 * @returns {Promise<string[][]>} Array of rows (each row is array of cell values)
 */
export async function readSheet(sheetName) {
	const url = `${SHEETS_API_BASE}/${SHEET_ID}/values/${encodeURIComponent(sheetName)}`;
	const res = await fetch(url, { headers: authHeaders() });
	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(`Failed to read ${sheetName}: ${err.error?.message || res.statusText}`);
	}
	const data = await res.json();
	return data.values || [];
}

/**
 * Append rows to the end of a sheet tab.
 * @param {string} sheetName - The tab name to append to
 * @param {string[][]} rows - Array of rows to append
 * @returns {Promise<void>}
 */
export async function appendRows(sheetName, rows) {
	const url = `${SHEETS_API_BASE}/${SHEET_ID}/values/${encodeURIComponent(sheetName)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
	const res = await fetch(url, {
		method: 'POST',
		headers: authHeaders(),
		body: JSON.stringify({ values: rows })
	});
	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(`Failed to append to ${sheetName}: ${err.error?.message || res.statusText}`);
	}
}

/**
 * Update a specific range in a sheet.
 * @param {string} range - A1 notation range (e.g., "Properties!A2:H2")
 * @param {string[][]} values - New values for the range
 * @returns {Promise<void>}
 */
export async function updateRange(range, values) {
	const url = `${SHEETS_API_BASE}/${SHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
	const res = await fetch(url, {
		method: 'PUT',
		headers: authHeaders(),
		body: JSON.stringify({ values })
	});
	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(`Failed to update ${range}: ${err.error?.message || res.statusText}`);
	}
}

/**
 * Delete a row from a sheet by shifting rows up.
 * Requires the sheet's numeric ID (gid), not the name.
 * @param {number} sheetGid - The numeric sheet ID (gid)
 * @param {number} rowIndex - 0-based row index to delete
 * @returns {Promise<void>}
 */
export async function deleteRow(sheetGid, rowIndex) {
	const url = `${SHEETS_API_BASE}/${SHEET_ID}:batchUpdate`;
	const res = await fetch(url, {
		method: 'POST',
		headers: authHeaders(),
		body: JSON.stringify({
			requests: [
				{
					deleteDimension: {
						range: {
							sheetId: sheetGid,
							dimension: 'ROWS',
							startIndex: rowIndex,
							endIndex: rowIndex + 1
						}
					}
				}
			]
		})
	});
	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(`Failed to delete row: ${err.error?.message || res.statusText}`);
	}
}

/**
 * Get all sheet tabs with their names and gids.
 * @returns {Promise<Array<{name: string, gid: number}>>}
 */
export async function getSheetTabs() {
	const url = `${SHEETS_API_BASE}/${SHEET_ID}?fields=sheets.properties`;
	const res = await fetch(url, { headers: authHeaders() });
	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(`Failed to get sheet info: ${err.error?.message || res.statusText}`);
	}
	const data = await res.json();
	return (data.sheets || []).map((/** @type {any} */ s) => ({
		name: s.properties.title,
		gid: s.properties.sheetId
	}));
}

/**
 * Find the gid for a sheet tab by name.
 * @param {string} sheetName
 * @returns {Promise<number>}
 */
export async function getSheetGid(sheetName) {
	const tabs = await getSheetTabs();
	const tab = tabs.find((t) => t.name === sheetName);
	if (!tab) throw new Error(`Sheet tab "${sheetName}" not found`);
	return tab.gid;
}

/**
 * Read a sheet and parse rows into objects using the header row.
 * @param {string} sheetName
 * @returns {Promise<{headers: string[], rows: Record<string, string>[], rawRows: string[][]}>}
 */
export async function readSheetAsObjects(sheetName) {
	const allRows = await readSheet(sheetName);
	if (allRows.length === 0) return { headers: [], rows: [], rawRows: [] };

	const headers = allRows[0];
	const rawRows = allRows.slice(1);
	const rows = rawRows.map((row) => {
		/** @type {Record<string, string>} */
		const obj = {};
		headers.forEach((h, i) => {
			obj[h] = row[i] || '';
		});
		return obj;
	});

	return { headers, rows, rawRows };
}

/**
 * Find the row index (1-based, for A1 notation) of a row by ID column.
 * @param {string} sheetName
 * @param {string} id - The ID to find
 * @param {number} [idColIndex=0] - Column index of the ID column (default 0)
 * @returns {Promise<number>} 1-based row number (for A1 notation), or -1 if not found
 */
export async function findRowById(sheetName, id, idColIndex = 0) {
	const allRows = await readSheet(sheetName);
	for (let i = 1; i < allRows.length; i++) {
		if (allRows[i][idColIndex] === id) {
			return i + 1; // 1-based for A1 notation
		}
	}
	return -1;
}

/**
 * Ensure all required sheet tabs exist with correct headers.
 * Creates missing tabs and writes header rows. Idempotent — safe to call on every sign-in.
 * @returns {Promise<void>}
 */
export async function ensureSheetSetup() {
	const existingTabs = await getSheetTabs();
	const existingNames = new Set(existingTabs.map((t) => t.name));

	// Find tabs that need to be created
	const missingTabs = Object.keys(TAB_HEADERS).filter((name) => !existingNames.has(name));
	if (missingTabs.length === 0) return;

	// Batch-create all missing tabs
	const url = `${SHEETS_API_BASE}/${SHEET_ID}:batchUpdate`;
	const res = await fetch(url, {
		method: 'POST',
		headers: authHeaders(),
		body: JSON.stringify({
			requests: missingTabs.map((title) => ({
				addSheet: { properties: { title } }
			}))
		})
	});
	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(`Failed to create sheet tabs: ${err.error?.message || res.statusText}`);
	}

	// Write header rows to all newly created tabs
	const headerUrl = `${SHEETS_API_BASE}/${SHEET_ID}/values:batchUpdate`;
	const headerRes = await fetch(headerUrl, {
		method: 'POST',
		headers: authHeaders(),
		body: JSON.stringify({
			valueInputOption: 'RAW',
			data: missingTabs.map((name) => ({
				range: `${name}!A1`,
				values: [TAB_HEADERS[name]]
			}))
		})
	});
	if (!headerRes.ok) {
		const err = await headerRes.json().catch(() => ({}));
		throw new Error(`Failed to write headers: ${err.error?.message || headerRes.statusText}`);
	}
}
