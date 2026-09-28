#!/usr/bin/env bash
#
# Darts: bring up everything the darts screen needs and open it full screen.
#
#   1. Autodarts Desktop (the board detection)   ~/.local/bin/autodarts-desktop.AppImage
#   2. Home Assistant in Docker (games, scores)   ~/homeassistant/compose.yaml
#   3. The screen in its own Chrome window        ~/homeassistant/chrome-darts-profile
#
# The window opens at once on the loading screen (splash.html next to this script),
# which waits for the board and Home Assistant and then moves on to the game.
#
# Safe to run again at any time: whatever already runs is left alone. Runs at login
# from ~/.config/autostart/play-darts.desktop, and from the Desktop and dock icons.

set -uo pipefail

HOST="${DARTS_HOST:-$(hostname -I | awk '{print $1}')}"   # the address the screen opens Home Assistant on
HA_URL="http://127.0.0.1:8123/manifest.json"
APP="$HOME/.local/bin/autodarts-desktop.AppImage"
HA_DIR="$HOME/homeassistant"
PROFILE="$HA_DIR/chrome-darts-profile"
SPLASH="file://$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/splash.html?host=$HOST"
LOG_DIR="$HOME/.local/state/autodarts"
ICON="$HOME/.local/share/autodarts-desktop/appicon.png"

mkdir -p "$LOG_DIR"
exec >> "$LOG_DIR/play-darts.log" 2>&1
echo "==== $(date '+%F %T') play-darts"

notify() {
    notify-send -i "$ICON" -h string:x-canonical-private-synchronous:play-darts "Darts" "$1" 2>/dev/null
    echo "$1"
}

# docker, through the docker group even in a session that started before the user
# joined it.
docker_cmd() {
    if docker info >/dev/null 2>&1; then docker "$@"; else sg docker -c "docker $(printf '%q ' "$@")"; fi
}

# One darts window is enough: a second launch would only stack another on top.
for pid in $(pgrep -x chrome); do
    if tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null | grep -q -- "--user-data-dir=$PROFILE"; then
        notify "Darts is already open"
        exit 0
    fi
done

# 1. Board detection.
if ! ps -eo comm= | grep -qx autodarts-deskt; then
    if [[ -x "$APP" ]]; then
        setsid nohup "$APP" >> "$LOG_DIR/v2.log" 2>&1 < /dev/null &
    else
        notify "Autodarts app not found at $APP"
    fi
fi

# The window next (after the Autodarts app, so it opens on top), before Home Assistant is
# up: its loading screen does the waiting.
setsid nohup google-chrome --user-data-dir="$PROFILE" --no-first-run --no-default-browser-check \
    --app="$SPLASH" --start-fullscreen --autoplay-policy=no-user-gesture-required \
    --class=darts-screen >/dev/null 2>&1 < /dev/null &
echo "window opened"

# 2. Home Assistant. The launcher starts it rather than Docker at boot: a container
# stopped by hand stays stopped until the next launch.
if ! curl -sf -o /dev/null --max-time 2 "$HA_URL"; then
    (cd "$HA_DIR" && docker_cmd compose up -d) || notify "Could not start the scoreboard (Docker)"
fi

