#!/usr/bin/env bash
#
# Start a local Home Assistant to try the classic game screen without a board:
# the integration with a simulated Autodarts board, the game screen dashboard and a
# dart simulator. Needs Docker. Your own pictures: DARTS_ASSETS=/path/to/folder.
#
#   bash contrib/classic-game-screen/demo/demo.sh          start (again, from scratch)
#   bash contrib/classic-game-screen/demo/demo.sh reload   show a changed card (keeps everything else)
#   bash contrib/classic-game-screen/demo/demo.sh stop     stop and remove it

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
# Keep container paths such as /demo unchanged when running from Git Bash on Windows.
export MSYS_NO_PATHCONV=1
COMPOSE=(docker compose --project-name darts_screen_demo --file compose.yaml)

# The dashboard loads the card as ?v=<number>; browsers keep it until the number changes.
if [[ "${1:-}" == "reload" ]]; then
	"${COMPOSE[@]}" stop homeassistant >/dev/null
	"${COMPOSE[@]}" run --rm --no-deps --entrypoint sh homeassistant -c 		"sed -i -E 's/autodarts-classic-card.js?v=[0-9]+/autodarts-classic-card.js?v=$(date +%s)/' /config/.storage/lovelace_resources"
	"${COMPOSE[@]}" up --detach --wait homeassistant >/dev/null
	echo "Card reloaded: refresh the game screen."
	exit 0
fi
"${COMPOSE[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
[[ "${1:-}" == "stop" ]] && { echo "Demo stopped."; exit 0; }

"${COMPOSE[@]}" up --detach --wait --wait-timeout 300
if ! "${COMPOSE[@]}" exec -T homeassistant python3 /demo/setup.py; then
	"${COMPOSE[@]}" logs --no-color --tail 200 || true
	exit 1
fi

cat <<INFO

Game screen:     http://localhost:${DEMO_PORT:-18125}/darts-classic/game
Dart simulator:  http://localhost:${DEMO_SIMULATOR_PORT:-18126}
Home Assistant:  http://localhost:${DEMO_PORT:-18125}   (logs in by itself on this PC)
Stop it:         bash $(pwd)/demo.sh stop
INFO
