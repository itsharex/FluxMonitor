#!/bin/bash
set -e

# This script builds the Flux Monitor app, installs it to /Applications, 
# and launches it for testing.

APP_NAME="Flux Monitor"
PROJECT_DIR="$(pwd)"
BUILD_DIR="${PROJECT_DIR}/launcher/build"
APP_DIR="${BUILD_DIR}/Release/${APP_NAME}.app"
DEST_DIR="${HOME}/Applications/${APP_NAME}.app"
CONFIG_FILE="${HOME}/Library/Application Support/com.ct106.flux-monitor/config.json"

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
    pkill -9 -f "$pattern" || true
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
    pkill -f "node.*/Contents/Resources/server.js" || true
    wait_for_exit "node.*/Contents/Resources/server.js" "Bundled backend"

    # Also try to kill the process by reading the actual configured port from the config.json
    if [ -f "$CONFIG_FILE" ]; then
        PORT=$(grep -o '"port": *[0-9]*' "$CONFIG_FILE" | awk -F': ' '{print $2}' | tr -d ' ,')
        if [ -n "$PORT" ]; then
            echo "🚿 Clearing connections on port ${PORT} as specified in config..."
            PIDS=$(lsof -ti :"$PORT" 2>/dev/null || true)
            if [ -n "$PIDS" ]; then
                kill $PIDS 2>/dev/null || true
                sleep 1
                kill -9 $PIDS 2>/dev/null || true
            fi
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

echo "🚚 3. Copying ${APP_NAME}.app to ${HOME}/Applications..."
mkdir -p "${HOME}/Applications"
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
# Launch the app from the terminal
open "${DEST_DIR}"

echo "✨ Test cycle complete!"
