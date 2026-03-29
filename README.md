# HUUK Booking Management System

A full-stack appointment and staff management system for barber shops, built with React and Node.js.

## Features

- **Customer Portal** – Book appointments, view history, make payments
- **Staff Dashboard** – Manage appointments, view schedules, track attendance
- **Manager Panel** – Staff management, sales reports, system administration
- **Real-time Updates** – Socket.IO for live notifications
- **Payment Integration** – Stripe and FPX payment processing
- **SMS & Email Notifications** – Twilio and Nodemailer
- **Multi-role Authentication** – Customer, Staff, and Manager roles

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 18, Material-UI 5, FullCalendar 6, Recharts, Socket.IO |
| Backend | Node.js, Express 5, MySQL 8, JWT, Socket.IO |
| Payments | Stripe, FPX |
| Notifications | Twilio (SMS), Nodemailer (Email) |
| Deployment | Docker, Nginx |

## Getting Started

### Prerequisites

- Node.js 18+
- MySQL 8.0+

### Quick Start (run both servers with one command)

```bash
# 1. Clone & enter the repo
git clone https://github.com/alyakadr/huuk-system.git
cd huuk-system

# 2. Install all dependencies (root, server, client)
npm run install:all

# 3. Configure the backend environment
cp env.example server/.env
#    Edit server/.env with your DB credentials and JWT_SECRET

# 4. Set up the MySQL database
mysql -u root -p -e "CREATE DATABASE huuk;"
mysql -u root -p huuk < server/migrations/create_slot_reservations.sql

# 5. Start both servers (backend :5000 + frontend :3000)
npm start
```

The React app opens at **http://localhost:3000** and talks to the API at **http://localhost:5000**.

> **Tip – live-reload backend:** replace `npm start` in step 5 with `npm run dev`  
> (uses `nodemon` for automatic server restarts on file changes).

### Manual Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/alyakadr/huuk-system.git
   cd huuk-system
   ```

2. **Install dependencies**

   ```bash
   # Root (installs concurrently)
   npm install

   # Backend
   cd server && npm install

   # Frontend
   cd ../client && npm install
   ```

3. **Configure environment variables**

   ```bash
   cp env.example server/.env
   # Edit server/.env with your database and service credentials
   ```

4. **Set up the database**

   ```bash
   # Create the database
   mysql -u root -p -e "CREATE DATABASE huuk;"

   # Run migrations
   mysql -u root -p huuk < server/migrations/create_slot_reservations.sql
   ```

5. **Start the development servers**

   ```bash
   # Terminal 1 – Backend (http://localhost:5000)
   cd server && npm start

   # Terminal 2 – Frontend (http://localhost:3000)
   cd client && npm start
   ```

## Project Structure

```
huuk-system/
├── client/                 # React frontend
│   ├── public/
│   └── src/
│       ├── api/            # API client
│       ├── components/     # Reusable UI components
│       ├── pages/          # Page-level components
│       ├── styles/         # CSS stylesheets
│       └── utils/          # Helper functions
├── server/                 # Express backend
│   ├── config/             # App configuration
│   ├── controllers/        # Route handlers
│   ├── database/           # DB connection pool
│   ├── middlewares/        # Auth and upload middleware
│   ├── migrations/         # SQL schema files
│   ├── models/             # Data models
│   ├── routes/             # Route definitions
│   ├── scripts/            # Utility and maintenance scripts
│   ├── services/           # Business logic
│   └── utils/              # Helpers (email, SMS, cron)
├── docker-compose.yml
├── Dockerfile
└── env.example
```

## Deployment

See [deployment-guide.md](deployment-guide.md) for full deployment instructions covering Railway, VPS, and Docker.

## Environment Variables

Copy `env.example` to `server/.env` and fill in the required values:

| Variable | Description |
|----------|-------------|
| `DB_HOST` | MySQL host |
| `DB_USER` | MySQL username |
| `DB_PASSWORD` | MySQL password |
| `DB_NAME` | Database name |
| `JWT_SECRET` | Secret key for JWT tokens |
| `STRIPE_SECRET_KEY` | Stripe API secret key |
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | Twilio phone number |
| `GMAIL_USER` | Gmail address for notifications |
| `GMAIL_PASS` | Gmail app password |
| `ALLOWED_ORIGINS` | Comma-separated allowed CORS origins |
