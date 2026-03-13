#!/bin/bash
# BurpSuite Dormant Mode Entrypoint
# 
# Monitors /opt/burp-setup for JAR, license, and activation flag.
# Remains dormant until all three are present, then starts BurpSuite Pro + MCP server.

set -e

BURP_SETUP_DIR="/opt/burp-setup"
JAR_PATH="$BURP_SETUP_DIR/burpsuite_pro.jar"
LICENSE_PATH="$BURP_SETUP_DIR/burpsuite.license"
ACTIVATION_FLAG="$BURP_SETUP_DIR/.activate"
BURP_HOME="/root/.BurpSuite"
MCP_PORT="${BURP_MCP_PORT:-9876}"

echo "[BurpAgent] Starting in dormant mode monitoring..."
echo "[BurpAgent] Setup directory: $BURP_SETUP_DIR"
echo "[BurpAgent] MCP port: $MCP_PORT"

# Create directories
mkdir -p "$BURP_SETUP_DIR"
mkdir -p "$BURP_HOME"
mkdir -p "/opt/burp"

# Function to check if activation requirements are met
check_activation_ready() {
    [[ -f "$JAR_PATH" ]] && [[ -f "$LICENSE_PATH" ]] && [[ -f "$ACTIVATION_FLAG" ]]
}

# Function to start BurpSuite + MCP Server
start_burp() {
    echo "[BurpAgent] Activation requirements met! Starting BurpSuite Pro..."
    
    # Copy files to expected locations
    if [[ -f "$JAR_PATH" ]]; then
        echo "[BurpAgent] Copying JAR to /opt/burp/burpsuite.jar"
        cp "$JAR_PATH" /opt/burp/burpsuite.jar
    fi
    
    if [[ -f "$LICENSE_PATH" ]]; then
        echo "[BurpAgent] Installing license to $BURP_HOME/burpsuite.license"
        cp "$LICENSE_PATH" "$BURP_HOME/burpsuite.license"
    fi
    
    # Start BurpSuite in headless mode with REST API enabled
    echo "[BurpAgent] Starting BurpSuite in headless mode..."
    java -jar -Xmx4g /opt/burp/burpsuite.jar \
        --project-file="$BURP_HOME/projects/rtpi-project.burp" \
        --config-file=/opt/burp/burp-config.json \
        --disable-auto-update \
        2>&1 | tee -a /var/log/burp.log &
    
    BURP_PID=$!
    echo "[BurpAgent] BurpSuite started with PID: $BURP_PID"
    
    # Wait for Burp to be ready (check REST API)
    echo "[BurpAgent] Waiting for BurpSuite REST API..."
    for i in {1..60}; do
        if curl -s -o /dev/null -w "%{http_code}" http://localhost:1337/burp/versions 2>/dev/null | grep -q "200"; then
            echo "[BurpAgent] BurpSuite REST API is ready"
            break
        fi
        echo "[BurpAgent] Waiting for Burp... ($i/60)"
        sleep 2
    done
    
    # Start MCP Server (if available)
    if [[ -f "/opt/burp/mcp-server.py" ]]; then
        echo "[BurpAgent] Starting MCP Server on port $MCP_PORT..."
        python3 /opt/burp/mcp-server.py --port "$MCP_PORT" --burp-url http://localhost:1337 \
            2>&1 | tee -a /var/log/burp-mcp.log &
        MCP_PID=$!
        echo "[BurpAgent] MCP Server started with PID: $MCP_PID"
    else
        echo "[BurpAgent] MCP Server not found, skipping"
    fi
    
    # Health check endpoint (simple HTTP server for Docker healthcheck)
    echo "[BurpAgent] Starting health check server on port 9999..."
    while true; do
        echo -e "HTTP/1.1 200 OK\nContent-Length: 2\n\nOK" | nc -l -p 9999 > /dev/null 2>&1
    done &
    
    # Monitor processes
    wait $BURP_PID
}

# Function to stop BurpSuite
stop_burp() {
    echo "[BurpAgent] Deactivation requested, stopping BurpSuite..."
    pkill -f "burpsuite.jar" || true
    pkill -f "mcp-server.py" || true
    pkill -f "nc -l -p 9999" || true
    echo "[BurpAgent] BurpSuite stopped, returning to dormant mode"
}

# Trap signals for graceful shutdown
trap 'echo "[BurpAgent] Received shutdown signal"; stop_burp; exit 0' SIGTERM SIGINT

# Main monitoring loop
BURP_RUNNING=false

while true; do
    if check_activation_ready; then
        if [[ "$BURP_RUNNING" == "false" ]]; then
            start_burp
            BURP_RUNNING=true
        fi
    else
        if [[ "$BURP_RUNNING" == "true" ]]; then
            stop_burp
            BURP_RUNNING=false
        fi
        
        # Dormant state: just wait and check periodically
        echo "[BurpAgent] Dormant mode - waiting for activation files..."
        sleep 10
    fi
    
    # Brief sleep in active mode
    sleep 5
done
