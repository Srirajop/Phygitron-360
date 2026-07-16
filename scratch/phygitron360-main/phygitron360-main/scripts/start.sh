#!/usr/bin/env bash
# =============================================================================
# Phygitron 360 — Start Script
# Starts backend (uvicorn) and frontend (vite) in parallel
# =============================================================================

set -e
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo -e "\n${CYAN}${BOLD}▶ Starting Phygitron 360...${NC}\n"

# Activate venv and start backend
(
    source "$ROOT/backend/venv/bin/activate"
    cd "$ROOT/backend"
    echo -e "${CYAN}  [BACKEND]${NC} Starting uvicorn on http://localhost:8000"
    uvicorn main:app --reload --port 8000
) &
BACKEND_PID=$!

# Start frontend
(
    cd "$ROOT/frontend"
    echo -e "${CYAN}  [FRONTEND]${NC} Starting Vite on http://localhost:5173"
    npm run dev
) &
FRONTEND_PID=$!

# Wait and handle Ctrl+C gracefully
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo -e '\n\033[0;31mStopped.\033[0m'" INT TERM
wait $BACKEND_PID $FRONTEND_PID
