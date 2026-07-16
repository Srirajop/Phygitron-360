#!/usr/bin/env bash
# =============================================================================
# Phygitron 360 — One-Shot Bootstrap Script
# =============================================================================
# Run this script once after cloning the repository:
#   chmod +x scripts/setup.sh && ./scripts/setup.sh
#
# Prerequisites (install manually before running):
#   - PostgreSQL 14+ running locally  (https://www.postgresql.org/download/)
#   - Node.js 18+ and npm             (https://nodejs.org/)
#   - Python 3.10+                    (https://www.python.org/)
# =============================================================================

set -e  # Exit immediately if any command fails

# ---------- Colours ----------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

print_step()  { echo -e "\n${CYAN}${BOLD}▶ $1${NC}"; }
print_ok()    { echo -e "  ${GREEN}✔  $1${NC}"; }
print_warn()  { echo -e "  ${YELLOW}⚠  $1${NC}"; }
print_error() { echo -e "  ${RED}✘  $1${NC}"; }

# ---------- Locate project root ----------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

echo -e "\n${BOLD}╔══════════════════════════════════════════╗"
echo -e "║   Phygitron 360 — Bootstrap Sequence     ║"
echo -e "╚══════════════════════════════════════════╝${NC}"
echo -e "  Project root: ${ROOT}\n"

# =============================================================================
# STEP 1 — Load / Create .env
# =============================================================================
print_step "1/7 — Environment Configuration"

ENV_FILE="$ROOT/backend/.env"

if [ ! -f "$ENV_FILE" ]; then
    cp "$ROOT/.env.example" "$ENV_FILE"
    print_warn ".env not found — copied from .env.example"
    print_warn "EDIT backend/.env with your credentials before continuing!"
    echo ""
    echo -e "  ${YELLOW}Required fields:${NC}"
    echo -e "    DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD"
    echo -e "    SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD"
    echo ""
    echo -e "  Fill in backend/.env then re-run this script."
    exit 1
else
    print_ok "Found backend/.env"
fi

# Source the .env — use python to safely parse it (avoids shell-breaking values with spaces)
eval "$(python3 - <<'PYEOF'
import os, re
with open("backend/.env") as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if re.match(r'^[A-Z_][A-Z0-9_]*$', key):
            print(f'export {key}={repr(val)}')
PYEOF
)"

# Validate mandatory env vars (DB_PASSWORD can be blank for local passwordless Postgres)
REQUIRED_VARS=(DB_HOST DB_PORT DB_NAME DB_USER SUPERADMIN_EMAIL SUPERADMIN_PASSWORD)
for VAR in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!VAR}" ]; then
        print_error "Missing required env var: $VAR (set it in backend/.env)"
        exit 1
    fi
done
print_ok "All required environment variables present"

# =============================================================================
# STEP 2 — Python virtual environment
# =============================================================================
print_step "2/7 — Python Virtual Environment"

VENV_DIR="$ROOT/backend/venv"

if [ -d "$VENV_DIR" ]; then
    print_warn "Removing existing venv..."
    rm -rf "$VENV_DIR"
fi

# Auto-detect Python 3.10+ (required for some dependencies)
PYTHON_BIN=""
for PY in "/opt/homebrew/bin/python3.14" "/opt/homebrew/bin/python3.13" "/opt/homebrew/bin/python3.12" "/opt/homebrew/bin/python3.11" "/opt/homebrew/bin/python3.10" "/usr/local/bin/python3.12" "/usr/local/bin/python3.11" "/usr/local/bin/python3.10" "python3.12" "python3.11" "python3.10"; do
    if command -v "$PY" &>/dev/null; then
        PY_VER=$("$PY" -c "import sys; print(sys.version_info.minor)" 2>/dev/null)
        PY_MAJ=$("$PY" -c "import sys; print(sys.version_info.major)" 2>/dev/null)
        if [ "$PY_MAJ" -eq 3 ] && [ "$PY_VER" -ge 10 ]; then
            PYTHON_BIN="$PY"
            break
        fi
    fi
done
if [ -z "$PYTHON_BIN" ]; then
    print_error "Python 3.10+ is required but not found. Install via: brew install python@3.12"
    exit 1
fi
print_ok "Using Python: $($PYTHON_BIN --version)"

"$PYTHON_BIN" -m venv "$VENV_DIR"
print_ok "Created fresh venv at backend/venv"

source "$VENV_DIR/bin/activate"

# Ensure pg_config is on PATH (needed for psycopg2-binary build from source)
PG_CONFIG_PATHS=(
    "/opt/homebrew/bin"
    "/opt/homebrew/Cellar/libpq/18.2/bin"
    "/opt/homebrew/Cellar/postgresql@18/18.3/bin"
    "/usr/local/bin"
    "/opt/anaconda3/bin"
    "/usr/pgsql-14/bin"
    "/usr/pgsql-15/bin"
    "/usr/pgsql-16/bin"
)
for PG_PATH in "${PG_CONFIG_PATHS[@]}"; do
    if [ -f "$PG_PATH/pg_config" ]; then
        export PATH="$PG_PATH:$PATH"
        print_ok "Found pg_config at $PG_PATH"
        break
    fi
done

pip install --upgrade pip -q
pip install -r "$ROOT/backend/requirements.txt" -q
print_ok "Python dependencies installed"

# =============================================================================
# STEP 3 — Node.js dependencies
# =============================================================================
print_step "3/7 — Node.js Dependencies"

FRONTEND_DIR="$ROOT/frontend"

if [ -d "$FRONTEND_DIR/node_modules" ]; then
    print_warn "Removing existing node_modules..."
    rm -rf "$FRONTEND_DIR/node_modules"
fi

cd "$FRONTEND_DIR"
npm install --silent
print_ok "Node.js dependencies installed"
cd "$ROOT"

# =============================================================================
# STEP 4 — Drop & recreate PostgreSQL database
# =============================================================================
print_step "4/7 — PostgreSQL Database Reset"

# Auto-detect psql binary
PSQL_BIN=""
for PSQL_PATH in "/opt/homebrew/bin/psql" "/opt/homebrew/Cellar/postgresql@18/*/bin/psql" "/usr/local/bin/psql" "psql"; do
    if command -v "$PSQL_PATH" &>/dev/null; then
        PSQL_BIN="$PSQL_PATH"
        break
    fi
done
# Fallback: search common locations
if [ -z "$PSQL_BIN" ]; then
    PSQL_BIN=$(find /opt/homebrew/Cellar/postgresql*/*/bin -name "psql" 2>/dev/null | head -1)
fi
if [ -z "$PSQL_BIN" ]; then
    print_error "psql not found. Add PostgreSQL to PATH or install via: brew install postgresql@18"
    exit 1
fi
print_ok "Using psql: $PSQL_BIN"
export PGPASSWORD="$DB_PASSWORD"

# Drop existing database (ignore error if it doesn't exist)
"$PSQL_BIN" -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
    -c "DROP DATABASE IF EXISTS \"$DB_NAME\";" 2>/dev/null || true

# Create fresh database
"$PSQL_BIN" -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
    -c "CREATE DATABASE \"$DB_NAME\";" \
    || { print_error "Failed to create database '$DB_NAME'. Is PostgreSQL running? Check DB_USER/DB_PASSWORD in backend/.env"; exit 1; }

print_ok "Database '$DB_NAME' created fresh"


# =============================================================================
# STEP 5 — Initialise database schema + tables
# =============================================================================
print_step "5/7 — Initialising Database Schema & Tables"

cd "$ROOT"
"$VENV_DIR/bin/python" - <<'PYEOF'
import sys, os
sys.path.insert(0, os.getcwd())
from backend.core.database import create_tables
create_tables(schema_name='public')
print("  Public schema tables created successfully.")
PYEOF

print_ok "Database schema initialised"

# =============================================================================
# STEP 6 — Seed L1 Superadmin
# =============================================================================
print_step "6/7 — Seeding L1 Superadmin Account"

"$VENV_DIR/bin/python" - <<PYEOF
import sys, os
sys.path.insert(0, os.getcwd())

from dotenv import load_dotenv
load_dotenv("backend/.env")

from backend.core.database import get_db_connection
from passlib.hash import pbkdf2_sha256

email    = os.environ.get("SUPERADMIN_EMAIL", "").strip()
password = os.environ.get("SUPERADMIN_PASSWORD", "").strip()

if not email or not password:
    print("  ERROR: SUPERADMIN_EMAIL or SUPERADMIN_PASSWORD not set in .env")
    sys.exit(1)

pw_hash = pbkdf2_sha256.hash(password)

conn = get_db_connection()
try:
    with conn.cursor() as cur:
        cur.execute("SET search_path TO public")
        cur.execute("SELECT id FROM users WHERE username = %s", (email,))
        if cur.fetchone():
            print(f"  Superadmin '{email}' already exists — skipped.")
        else:
            cur.execute(
                """INSERT INTO users (username, password_hash, role, roles, is_active)
                   VALUES (%s, %s, 'super_admin', ARRAY['super_admin'], 1)""",
                (email, pw_hash)
            )
            conn.commit()
            print(f"  Superadmin '{email}' created successfully.")
finally:
    conn.close()
PYEOF

print_ok "L1 Superadmin seeded"

# =============================================================================
# STEP 6.5 — Synchronise Permission Matrix
# =============================================================================
print_step "6.5/7 — Synchronising PBAC Matrix"
"$VENV_DIR/bin/python" "$ROOT/scripts/seed_permissions.py"
print_ok "Permission matrix synchronized across all schemas"

# =============================================================================
# STEP 7 — Done! Print startup instructions
# =============================================================================
print_step "7/7 — Setup Complete"

echo ""
echo -e "${GREEN}${BOLD}  ╔══════════════════════════════════════════╗"
echo -e "  ║         Setup Successful! 🚀             ║"
echo -e "  ╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}To start the application:${NC}"
echo ""
echo -e "  ${CYAN}# Terminal 1 — Backend${NC}"
echo -e "  source backend/venv/bin/activate"
echo -e "  cd backend && uvicorn main:app --reload --port 8000"
echo ""
echo -e "  ${CYAN}# Terminal 2 — Frontend${NC}"
echo -e "  cd frontend && npm run dev"
echo ""
echo -e "  ${CYAN}# Or use a single start script:${NC}"
echo -e "  ./scripts/start.sh"
echo ""
echo -e "  ${BOLD}Superadmin login:${NC}"
echo -e "  Email:    ${SUPERADMIN_EMAIL}"
echo -e "  Password: (as set in backend/.env)"
echo ""
