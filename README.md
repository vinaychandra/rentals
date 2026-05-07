# Rentals — Rental & Payment Tracking

A lightweight web app for tracking rental properties and electricity billing, backed by Google Sheets as the data store. Built with SvelteKit, Tailwind CSS, and Google Sheets API v4.

## Features

- **Rental Properties**: Full CRUD for properties (name, address, rent, tenant info)
- **Rent Payments**: Track payments per property per month, with support for split payments (Cash, Cheque, UPI, Bank Transfer)
- **Electricity Clients**: Manage meter clients independently from rental tenants
- **Electricity Bills**: Enter total bill + individual meter readings; auto-calculates proportional shares
- **Payment Tracking**: Mark electricity shares as paid/partial/unpaid
- **Google Auth**: Sign in with Google OAuth; app access restricted via Google Cloud project whitelist
- **Responsive**: Works on mobile, tablet, and desktop

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | SvelteKit (static adapter) |
| Styling | Tailwind CSS v4 |
| Auth | Google Identity Services (OAuth 2.0) |
| Data | Google Sheets API v4 |
| Hosting | GitHub Pages |
| CI/CD | GitHub Actions |

## Google Sheet Structure

Create a single Google Sheet with these 6 tabs (exact names matter):

| Tab | Columns |
|-----|---------|
| `Properties` | ID, Name, Address, MonthlyRent, TenantName, TenantContact, Status, Notes |
| `RentalPayments` | ID, PropertyID, Month, Amount, Method, Date, Notes |
| `ElectricityClients` | ID, Name, Contact, MeterNumber, Status, Notes |
| `ElectricityBills` | ID, Month, TotalAmount, Date, Notes |
| `MeterReadings` | ID, BillID, ClientID, PreviousReading, CurrentReading, Units |
| `ElectricityPayments` | ID, BillID, ClientID, AmountDue, AmountPaid, Method, Date, Status |

**Important:** Add the header row (column names) to each tab manually. The app reads the first row as headers.

## Setup

### 1. Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or use an existing one)
3. Go to **APIs & Services > Library**, search for and enable **Google Sheets API**
4. Go to **APIs & Services > OAuth consent screen**:
   - Choose **External** user type
   - Fill in app name, support email
   - Add your email under **Test users** (this restricts who can sign in)
5. Go to **APIs & Services > Credentials**:
   - Click **Create Credentials > OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorized JavaScript origins: add `http://localhost:5173` and your GitHub Pages URL (e.g., `https://yourusername.github.io`)
   - Copy the **Client ID**

### 2. Google Sheet

1. Create a new Google Sheet at [sheets.google.com](https://sheets.google.com)
2. Create the 6 tabs listed above and add header rows
3. Copy the **Sheet ID** from the URL: `https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit`
4. Make sure the sheet is accessible to your Google account

### 3. Local Development

```sh
# Clone the repo
git clone <your-repo-url>
cd Rentals

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Google Client ID and Sheet ID

# Start dev server
npm run dev
```

### 4. Deployment (GitHub Pages)

1. Push the repo to GitHub
2. Go to **Settings > Pages** and set source to **GitHub Actions**
3. Go to **Settings > Secrets and variables > Actions** and add:
   - `VITE_GOOGLE_CLIENT_ID` — your OAuth Client ID
   - `VITE_SHEET_ID` — your Google Sheet ID
4. Push to `main` — the GitHub Actions workflow will build and deploy automatically
5. Go back to Google Cloud Console and add your GitHub Pages URL to the OAuth client's authorized origins

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
    auth.js           # Google OAuth sign-in/sign-out
    config.js         # Sheet ID, Client ID, payment methods, helpers
    sheets.js         # Google Sheets API CRUD operations
    stores.js         # Svelte stores for auth state & errors
  routes/
    +layout.svelte    # App shell with nav + auth guard
    +layout.js        # Static rendering config
    +page.svelte      # Dashboard
    rentals/
      +page.svelte    # Properties list (CRUD)
      [id]/
        +page.svelte  # Payment history per property
    electricity/
      +page.svelte    # Clients list (CRUD)
      bills/
        +page.svelte  # Bill history + payment tracking
        new/
          +page.svelte # New bill entry with meter readings
```

## Changelog

- **v0.1.0** — Initial implementation: SvelteKit scaffold, Tailwind CSS, Google Auth, Sheets API helpers, Rentals CRUD + payments, Electricity clients + bills + proportional billing + payment tracking, GitHub Actions deployment.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
