// Configuration for Google Sheets API and OAuth
// To set up:
// 1. Create a Google Cloud project at https://console.cloud.google.com
// 2. Enable "Google Sheets API" in APIs & Services > Library
// 3. Configure OAuth consent screen (External type, add your email as test user)
// 4. Create OAuth 2.0 Client ID (Web application) in APIs & Services > Credentials
// 5. Add authorized JavaScript origins: http://localhost:5173 and your GitHub Pages URL
// 6. Create a Google Sheet and copy its ID from the URL
// 7. Copy .env.example to .env and fill in the values

/** Google OAuth Client ID */
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

/** Google Sheet ID (from the sheet URL) */
export const SHEET_ID = import.meta.env.VITE_SHEET_ID || '';

/** Google Sheets API base URL */
export const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

/** OAuth scopes needed */
export const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

/** Payment methods (edit this list to change available options) */
export const PAYMENT_METHODS = ['Cash', 'Cheque', 'UPI', 'Bank Transfer'];

/** Sheet tab names */
export const SHEET_NAMES = {
    PROPERTIES: 'Properties',
    RENTAL_PAYMENTS: 'RentalPayments',
    ELECTRICITY_METERS: 'ElectricityMeters',
    ELECTRICITY_CLIENTS: 'ElectricityClients',
    ELECTRICITY_BILLS: 'ElectricityBills',
    METER_READINGS: 'MeterReadings',
    ELECTRICITY_PAYMENTS: 'ElectricityPayments'
};

/** Format a number as INR currency */
export function formatINR(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

/** Generate a simple unique ID */
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}
