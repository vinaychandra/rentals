# Rentals — Rental & Payment Tracking

A lightweight web app for tracking rental properties and electricity billing, backed by Google Sheets as the data store. Built with SvelteKit, Tailwind CSS, and Google Sheets API v4.

## Features

### Rentals
- **Properties CRUD**: Add, edit, delete rental properties (name, address, monthly rent, tenant info, status)
- **Rent Payments**: Track payments per property per month, with split payment support (e.g., ₹5K cheque + ₹5K cash)
- **Payment methods**: Cash, Cheque, UPI, Bank Transfer (configurable in `src/lib/config.js`)
- **Smart defaults**: Payment form defaults to previous month (Feb rent paid in March) and current year
- **At-a-glance summary**: Properties list shows current month balance and last payment date

### Electricity
- **Main Meters**: CRUD for main electricity meters (name, meter number, location)
- **Submeters**: Each submeter belongs to a main meter. Track client name, contact, submeter number
- **Bill Entry**: Select a main meter → only that meter's submeters are shown. Enter total bill + individual submeter readings
- **Proportional Split**: Auto-calculates each submeter's share: `(units_i / total_units) × bill_amount`
- **Payment Tracking**: Mark each submeter's share as Paid/Partial/Unpaid with amount, method, and date

### General
- **Google Auth**: Sign in with Google OAuth; access restricted via Google Cloud project whitelist
- **Auto-setup**: Spreadsheet and all sheet tabs are created automatically on first sign-in
- **Session persistence**: Auth token stored in localStorage — no re-login on refresh/reopen
- **Multi-user**: Each Google account gets their own "Rentals Tracker" spreadsheet
- **Responsive**: Mobile-first layout with stacked buttons on small screens, inline on desktop

## Tech Stack

| Layer     | Technology                           |
| --------- | ------------------------------------ |
| Framework | SvelteKit 5 (static adapter)         |
| Styling   | Tailwind CSS v4                      |
| Auth      | Google Identity Services (OAuth 2.0) |
| Data      | Google Sheets API v4 + Drive API     |
| Hosting   | GitHub Pages                         |
| CI/CD     | GitHub Actions                       |

## Google Sheet Structure

The app auto-creates a spreadsheet called **"Rentals Tracker"** in the signed-in user's Google Drive. It contains 7 tabs:

| Tab                   | Columns                                                                  |
| --------------------- | ------------------------------------------------------------------------ |
| `Properties`          | ID, Name, Address, MonthlyRent, TenantName, TenantContact, Status, Notes |
| `RentalPayments`      | ID, PropertyID, Month, Amount, Method, Date, Notes                       |
| `ElectricityMeters`   | ID, Name, MeterNumber, Location, Status, Notes                           |
| `ElectricityClients`  | ID, Name, MeterID, Contact, MeterNumber, Status, Notes                   |
| `ElectricityBills`    | ID, MeterID, Month, TotalAmount, Date, Notes                             |
| `MeterReadings`       | ID, BillID, ClientID, PreviousReading, CurrentReading, Units             |
| `ElectricityPayments` | ID, BillID, ClientID, AmountDue, AmountPaid, Method, Date, Status        |

**Note:** You do NOT need to create the spreadsheet or tabs manually. The app creates everything automatically on first sign-in, including header rows. On subsequent sign-ins, it verifies and fixes headers if the schema has changed.

## Setup

### 1. Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or use an existing one)
3. Go to **APIs & Services > Library** and enable:
   - **Google Sheets API**
   - **Google Drive API**
4. Go to **APIs & Services > OAuth consent screen**:
   - Choose **External** user type
   - Fill in app name, support email
   - Add scopes: `spreadsheets`, `drive.file`
   - Add your email under **Test users** (this restricts who can sign in)
   - Note: In "Testing" mode, tokens expire every 7 days and users must re-login
5. Go to **APIs & Services > Credentials**:
   - Click **Create Credentials > OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorized JavaScript origins: add `http://localhost:5173` and your GitHub Pages URL (e.g., `https://yourusername.github.io`)
   - Copy the **Client ID**

### 2. Local Development

```sh
# Clone the repo
git clone <your-repo-url>
cd Rentals

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env — only VITE_GOOGLE_CLIENT_ID is needed

# Start dev server
npm run dev
```

The `.env` file only needs one value:
```
VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
```

### 3. Deployment (GitHub Pages)

1. Create a GitHub repo named **`rentals`** (lowercase, must match `base` path in `svelte.config.js`)
2. Push the repo:
   ```sh
   jj bookmark set master -r @-
   jj git remote add origin https://github.com/yourusername/rentals.git
   jj git push
   ```
3. Go to **Settings > Pages** and set source to **GitHub Actions**
4. Go to **Settings > Secrets and variables > Actions** and add:
   - `VITE_GOOGLE_CLIENT_ID` — your OAuth Client ID
5. Push to `master` — the GitHub Actions workflow will build and deploy automatically
6. Go back to Google Cloud Console and add your GitHub Pages URL (`https://yourusername.github.io`) to the OAuth client's authorized JavaScript origins
7. Your site is live at `https://yourusername.github.io/rentals/`

## Development

```sh
npm run dev          # Start dev server at http://localhost:5173
npm run build        # Production build to build/
npm run preview      # Preview production build locally
npm run check        # Svelte type checking
```

## Project Structure

```
src/
  lib/
    auth.js           # Google OAuth sign-in/sign-out + session persistence (localStorage)
    config.js         # Client ID, spreadsheet name, payment methods, INR formatter, ID generator
    sheets.js         # Google Sheets/Drive API: CRUD, auto-create spreadsheet, ensure tabs + headers
    stores.js         # Svelte stores for auth state & error messages
  routes/
    +layout.svelte    # App shell: nav bar, auth guard, mobile menu
    +layout.js        # Static rendering config (prerender + no SSR)
    +page.svelte      # Dashboard with links to Rentals and Electricity
    rentals/
      +page.svelte    # Properties list with CRUD, current month balance, last payment
      [id]/
        +page.svelte  # Payment history for a property, grouped by month
    electricity/
      +page.svelte    # Main Meters CRUD + Submeters CRUD (two sections)
      bills/
        +page.svelte  # Bill history with per-client payment tracking
        new/
          +page.svelte # New bill: select meter, enter readings, auto-split
```

## How It Works

### Data Flow
1. User signs in with Google → OAuth token obtained
2. App searches Google Drive for a spreadsheet named "Rentals Tracker"
3. If not found, creates one automatically
4. `ensureSheetSetup()` creates any missing tabs and verifies/fixes header rows
5. All CRUD operations use Google Sheets API v4 (read, append, update, delete rows)

### Electricity Bill Calculation
```
Units_i = CurrentReading_i - PreviousReading_i
Share_i = (Units_i / ΣUnits) × TotalBill
```
Previous readings are auto-filled from the last bill entry. First-ever reading requires manual input.

### Authentication
- OAuth token stored in `localStorage` for session persistence across page loads
- On app load, token is validated against Google's tokeninfo endpoint
- If invalid/expired, user sees the sign-in button
- If valid, app restores the session silently (no popup)
- Signing out revokes the token and clears localStorage

### Security
- OAuth Client ID is in the browser JS (unavoidable for static sites), but scoped via authorized origins
- Google Cloud project in "Testing" mode = only whitelisted emails can sign in
- `drive.file` scope: app can only see spreadsheets it created, not all Drive files
- No API keys or secrets in the frontend — everything uses OAuth tokens

## Configuration

### Payment Methods
Edit `PAYMENT_METHODS` in `src/lib/config.js`:
```js
export const PAYMENT_METHODS = ['Cash', 'Cheque', 'UPI', 'Bank Transfer'];
```

### Spreadsheet Name
Edit `SPREADSHEET_NAME` in `src/lib/config.js`:
```js
export const SPREADSHEET_NAME = 'Rentals Tracker';
```

### Base Path
The GitHub Pages base path is set in `svelte.config.js`. Change `/rentals` if your repo has a different name:
```js
paths: {
  base: process.env.NODE_ENV === 'production' ? '/rentals' : ''
}
```

## Changelog

- **v0.3.0** — Auto-create spreadsheet per user (removed hardcoded Sheet ID), Google Drive API integration, multi-user support, mobile layout fixes for property cards.
- **v0.2.0** — Electricity meters: main meter/submeter model, per-meter billing, month/year dropdowns. Auth session persistence with localStorage. Sheet setup auto-verifies and fixes headers on schema changes.
- **v0.1.0** — Initial implementation: SvelteKit scaffold, Tailwind CSS, Google Auth, Sheets API helpers, Rentals CRUD + payments, Electricity clients + bills + proportional billing + payment tracking, GitHub Actions deployment.
