# Income & Expenditure Tracker

An easy-to-use, secure, and modern Node.js Express application for tracking, reporting, and managing income and expenditure. Built with EJS templating and SQLite for a lightweight, portable solution.

## Features
- User authentication (login/logout, session-based)
- Add, view, edit, and delete income and expenditure records
- Select source for each entry (customizable)
- Beautiful, responsive dashboard with summary cards
- Printable and filterable reports (by date range)
- Data validation (no negative amounts)
- Secure credentials and secrets via `.env` file
- Professional UI with logo and branding

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or later recommended)

### Setup
1. Clone or download this repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the project root (see `.env.example`):
   ```env
   SESSION_SECRET=your_secret_key
   AUTH_USERNAME=your_username
   AUTH_PASSWORD=your_password
   ```
4. Start the app:
   ```bash
   node app.js
   ```
5. Open your browser at [http://localhost:3000](http://localhost:3000)

## Usage

- **Login** with your credentials (set in `.env`).
- Use the dashboard to add, view, edit, or delete income and expenditure entries.
- Generate and print reports for any date range from the "Report" link in the navbar.

## Authentication
- Credentials are managed via the `.env` file for security.
- Sessions are used to keep users logged in.

## Reporting
- Go to the "Report" page to select a date range and generate a printable report including all records and summary.

## Customization
- Replace `public/logo.png` with your organization’s logo for custom branding.
- Edit `.env` to change login credentials and session secret.

## License
MIT
