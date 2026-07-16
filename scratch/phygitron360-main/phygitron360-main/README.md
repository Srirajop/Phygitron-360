# Phygitron 360 — HRMS Platform

Enterprise-grade Human Resource Management System with multi-tenant architecture, AI-powered analytics, and a modern React/FastAPI stack.

---

## Prerequisites

Before running, ensure you have these installed on your machine:

| Tool | Version | Install |
|------|---------|---------|
| **PostgreSQL** | 14+ | https://www.postgresql.org/download/ |
| **Python** | 3.10+ | https://www.python.org/ |
| **Node.js** | 18+ | https://nodejs.org/ |

---

## 🚀 Quick Start (First-Time Setup)

### 1. Clone the repository
```bash
git clone https://github.com/your-org/phygitron360.git
cd phygitron360
```

### 2. Configure your environment
```bash
cp .env.example backend/.env
```
Open `backend/.env` and fill in:
- `DB_USER` / `DB_PASSWORD` — your local PostgreSQL credentials
- `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` — the L1 admin account to seed

### 3. Run the bootstrap script
```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

This will automatically:
- ✅ Create a Python virtual environment and install all dependencies
- ✅ Install all Node.js frontend packages
- ✅ Drop and recreate a clean PostgreSQL database
- ✅ Initialise all database schemas and tables
- ✅ Seed the L1 Superadmin account

### 4. Start the application
```bash
chmod +x scripts/start.sh
./scripts/start.sh
```

Or start each service manually:

```bash
# Terminal 1 — Backend API (http://localhost:8000)
source backend/venv/bin/activate
cd backend && uvicorn main:app --reload --port 8000

# Terminal 2 — Frontend (http://localhost:5173)
cd frontend && npm run dev
```

---

## 🔄 Reset & Re-run

To wipe everything and start fresh (e.g., after pulling major changes):
```bash
./scripts/setup.sh
```
The script is fully idempotent — it safely removes existing `venv`, `node_modules`, and the database before rebuilding.

---

## 🏗 Architecture

```
phygitron360/
├── backend/              # FastAPI (Python) API server
│   ├── core/             # Database, auth, config
│   ├── modules/          # Feature modules (deploy, source, forge, verify)
│   └── main.py           # App entry point
├── frontend/             # React + Vite SPA
│   └── src/modules/      # Feature-aligned module structure
├── scripts/
│   ├── setup.sh          # One-shot bootstrap (run this first!)
│   └── start.sh          # Start both services
└── .env.example          # Copy → backend/.env and fill in values
```

---

## 🔑 Default Accounts

After setup, log in at http://localhost:5173 with:

| Role | Email | Password |
|------|-------|----------|
| **L1 Superadmin** | As set in `SUPERADMIN_EMAIL` | As set in `SUPERADMIN_PASSWORD` |

Use the Superadmin dashboard to provision tenant workspaces and create `org_admin` accounts.

---

## 📧 Email Setup (Optional)

By default, email sending is in **mock mode** — credentials are printed to the backend logs instead of being sent. To enable real emails, set the `SMTP_*` variables in `backend/.env`.