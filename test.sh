#!/bin/bash
set -e

# This script builds the Flux Monitor app, installs it to /Applications,
# and launches it for testing.

APP_NAME="Flux Monitor"
PROJECT_DIR="$(pwd)"
BUILD_DIR="${PROJECT_DIR}/launcher/build"
APP_DIR="${BUILD_DIR}/Release/${APP_NAME}.app"
DEST_DIR="/Applications/${APP_NAME}.app"
CONFIG_FILE="${HOME}/Library/Application Support/com.ct106.flux-monitor/config.json"

is_flux_backend_pid() {
    local pid="$1"
    local command
    local cwd

    command=$(ps -p "$pid" -o command= 2>/dev/null || true)
    cwd=$(lsof -nP -a -p "$pid" -d cwd -F n 2>/dev/null | sed -n 's/^n//p' | head -n 1)
    [[ "$command" == *"/${APP_NAME}.app/Contents/Resources/server.js"* ]] ||
        [[ "$cwd" == *"/${APP_NAME}.app/Contents/Resources" ]]
}

terminate_pid() {
    local pid="$1"
    local label="$2"

    if [ -z "$pid" ] || [ "$pid" -le 100 ] 2>/dev/null; then
        return
    fi

    kill "$pid" 2>/dev/null || true
    sleep 0.5
    if kill -0 "$pid" 2>/dev/null; then
        echo "⚠️ ${label} PID ${pid} is still alive, force killing..."
        kill -9 "$pid" 2>/dev/null || true
    fi
}

wait_for_exit() {
    local pattern="$1"
    local label="$2"
    local timeout="${3:-10}"

    for ((i = 0; i < timeout; i++)); do
        if ! pgrep -f "$pattern" >/dev/null 2>&1; then
            return 0
        fi
        sleep 1
    done

    echo "⚠️ ${label} did not exit after ${timeout}s, force killing..."
    while IFS= read -r pid; do
        [ -n "$pid" ] || continue
        terminate_pid "$pid" "$label"
    done < <(pgrep -f "$pattern" || true)
}

stop_existing_app() {
    echo "🛑 2. Stopping any existing process of ${APP_NAME}..."

    # Ask the app to quit first so it can terminate its bundled node process.
    if pgrep -x "${APP_NAME}" >/dev/null 2>&1; then
        osascript -e "tell application \"${APP_NAME}\" to quit" >/dev/null 2>&1 || true
        wait_for_exit "/${APP_NAME}\\.app/Contents/MacOS/${APP_NAME}$" "${APP_NAME}"
    fi

    # Fall back to process-name based termination if Launch Services did not quit it.
    if pgrep -x "${APP_NAME}" >/dev/null 2>&1; then
        pkill -x "${APP_NAME}" || true
        for i in {1..5}; do
            if ! pgrep -x "${APP_NAME}" >/dev/null 2>&1; then
                break
            fi
            sleep 1
        done
        pkill -9 -x "${APP_NAME}" || true
    fi

    # Also explicitly kill any orphan backend processes that might still be running.
    # We search for any 'node' process that is running our specific 'server.js' from the app bundle.
    echo "🧹 Cleaning up orphan backend processes..."
    while IFS= read -r PID; do
        [ -n "$PID" ] || continue
        terminate_pid "$PID" "Bundled backend"
    done < <(pgrep -f "node.*/${APP_NAME}\\.app/Contents/Resources/server.js" || true)
    wait_for_exit "node.*/${APP_NAME}\\.app/Contents/Resources/server.js" "Bundled backend"

    # Also try to kill the process by reading the actual configured port from the config.json
    if [ -f "$CONFIG_FILE" ]; then
        PORT=$(grep -Eo '"port"\s*:\s*[0-9]+' "$CONFIG_FILE" | awk -F':' '{print $2}' | tr -d ' ,')
        if [ -n "$PORT" ] && [ "$PORT" -gt 0 ] 2>/dev/null; then
            echo "🚿 Clearing connections on port ${PORT} as specified in config..."
            PIDS=$(lsof -nP -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)
            for PID in $PIDS; do
                if is_flux_backend_pid "$PID"; then
                    terminate_pid "$PID" "Port ${PORT} backend"
                else
                    COMMAND=$(ps -p "$PID" -o command= 2>/dev/null || true)
                    echo "⚠️ Skipping PID ${PID} on port ${PORT}; it is not the Flux Monitor backend: ${COMMAND}"
                fi
            done
        fi
    fi
}

# Check for flags
SKIP_BUILD=false
if [[ "$*" == *"--fast"* ]] || [[ "$*" == *"-f"* ]]; then
    SKIP_BUILD=true
fi

if [ "$SKIP_BUILD" = false ]; then
    echo "📦 1. Building the app using bundle.sh (no signing)..."
    chmod +x ./launcher/bundle.sh
    ./launcher/bundle.sh --no-sign
else
    echo "⏩ Skipping build step (--fast)..."
fi

stop_existing_app

echo "🚚 3. Copying ${APP_NAME}.app to /Applications..."
if [ -d "${APP_DIR}" ]; then
    rm -rf "${DEST_DIR}"
    cp -R "${APP_DIR}" "${DEST_DIR}"
    echo "✅ Copy complete."
else
    echo "❌ Error: Could not find built app at ${APP_DIR}"
    exit 1
fi

echo "🛡️ 4. Removing existing permissions (quarantine/etc.)..."
# Removing all extended attributes to ensure it runs without "damaged" warnings
xattr -rc "${DEST_DIR}"
# Ensure executable permissions
chmod -R 755 "${DEST_DIR}"

echo "🚀 5. Launching the app..."
# Launch the exact app bundle we just copied, even if another copy exists in /Applications.
open -n "${DEST_DIR}"

echo "✨ Test cycle complete!"
