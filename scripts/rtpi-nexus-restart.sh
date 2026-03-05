#!/bin/bash
# RTPI Nexus Restart Script
# Restarts all RTPI services (backend, frontend, rkllama)
# Runs at startup and daily at 3:30 AM CST

# Note: Not using 'set -e' to allow script to continue even if some processes fail to stop

# Logging
LOG_DIR="/home/cmndcntrl/code/rtpi/logs"
LOG_FILE="${LOG_DIR}/nexus-restart-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$LOG_DIR"

# Redirect all output to log file
exec > >(tee -a "$LOG_FILE") 2>&1

echo "=============================================="
echo "RTPI Nexus Restart"
echo "Date: $(date)"
echo "=============================================="
echo ""

# Working directory
RTPI_DIR="/home/cmndcntrl/code/rtpi"
cd "$RTPI_DIR"

# Function to check if process is running
check_process() {
    ps aux | grep -v grep | grep "$1" > /dev/null 2>&1
}

# Function to wait for process to stop with force kill fallback
wait_for_stop() {
    local pattern="$1"
    local max_wait=30
    local waited=0
    
    # Wait for graceful stop (SIGTERM)
    while check_process "$pattern" && [ $waited -lt $max_wait ]; do
        sleep 1
        waited=$((waited + 1))
    done
    
    # If still running, force kill (SIGKILL)
    if check_process "$pattern"; then
        echo "⚠️  Process still running after ${max_wait}s, forcing kill..."
        pkill -9 -f "$pattern" 2>/dev/null || true
        sleep 2
        
        if check_process "$pattern"; then
            echo "❌ Failed to stop process even with force kill"
            return 1
        fi
        echo "✓ Process forcefully stopped"
    fi
    return 0
}

echo "🛑 Stopping RTPI services..."
echo ""

# 1. Stop frontend (Vite)
echo "Stopping Vite frontend..."
if check_process "node.*vite"; then
    pkill -f "node.*vite" || true
    wait_for_stop "node.*vite"
    echo "✓ Vite stopped"
else
    echo "✓ Vite not running"
fi
echo ""

# 2. Stop backend (tsx/server)
echo "Stopping backend server..."
if check_process "tsx watch server/index.ts"; then
    pkill -f "tsx watch server/index.ts" || true
    wait_for_stop "tsx watch server/index.ts"
    echo "✓ Backend stopped"
else
    echo "✓ Backend not running"
fi

# Also stop any node processes running server/index.ts directly
if check_process "node.*server/index.ts"; then
    pkill -f "node.*server/index.ts" || true
    wait_for_stop "node.*server/index.ts"
    echo "✓ Backend node processes stopped"
fi
echo ""

# 3. Restart RKLLama service (if running)
echo "Restarting RKLLama service..."
if systemctl is-active --quiet rkllama.service 2>/dev/null; then
    sudo systemctl restart rkllama.service
    echo "✓ RKLLama restarted via systemd"
elif check_process "rkllama_server"; then
    # If running but not via systemd, restart manually
    pkill -f rkllama_server || true
    wait_for_stop "rkllama_server"
    nohup /home/cmndcntrl/.local/bin/rkllama_server --port 11434 --models "$RTPI_DIR/rkllama/models" --processor rk3588 > "$LOG_DIR/rkllama.log" 2>&1 &
    echo "✓ RKLLama restarted manually"
else
    echo "✓ RKLLama not running (skipping)"
fi
echo ""

# Wait a moment for services to fully stop
sleep 3

echo "🚀 Starting RTPI services..."
echo ""

# 4. Start backend server
echo "Starting backend server..."
cd "$RTPI_DIR"
nohup npm run dev > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo "✓ Backend started (PID: $BACKEND_PID)"
echo ""

# Wait for backend to initialize
sleep 5

# 5. Start frontend
echo "Starting frontend..."
cd "$RTPI_DIR"
nohup npm run dev:client > "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "✓ Frontend started (PID: $FRONTEND_PID)"
echo ""

# Wait for services to stabilize
sleep 5

echo "=============================================="
echo "✅ RTPI Nexus restart complete!"
echo ""
echo "📊 Running processes:"
ps aux | grep -E "(tsx watch|node.*vite|rkllama_server)" | grep -v grep | awk '{printf "   PID %-7s %s\n", $2, $11" "$12" "$13}' || echo "   No RTPI processes found"
echo ""

echo "📁 Logs:"
echo "   Main: $LOG_FILE"
echo "   Backend: $LOG_DIR/backend.log"
echo "   Frontend: $LOG_DIR/frontend.log"
echo "   RKLLama: $LOG_DIR/rkllama.log"
echo ""

# Cleanup old restart logs (keep last 30 days)
echo "🗑️  Cleaning old restart logs (>30 days)..."
find "$LOG_DIR" -name "nexus-restart-*.log" -mtime +30 -delete 2>/dev/null || echo "Old logs cleaned"
echo ""

echo "=============================================="
echo "🌐 Access RTPI at: http://localhost:5000"
echo "=============================================="
