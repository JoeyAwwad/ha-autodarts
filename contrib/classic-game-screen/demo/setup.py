"""Prepare the game screen demo: a user, the simulated board, the card and its dashboard.

Runs inside the Home Assistant container and reuses the API helpers of the repository's
end-to-end tests (tests/e2e/scenario.py).
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, "/e2e")

import aiohttp  # noqa: E402
from board_mock import GENERATION, PORT  # noqa: E402
from scenario import Scenario  # noqa: E402

CARD = Path("/config/www/autodarts-classic-card.js")
ASSETS = Path("/config/www/darts")
DASHBOARD = "darts-classic"
# Pictures the dashboard uses when they are in the assets folder.
MOMENTS = {
    "180": "180.jpg",
    "bull": "bullseye.jpg",
    "t20": "triple20.jpg",
    "bounce_out": "bounce-out.jpg",
    "miss": "out-of-board.jpg",
    "game_shot": "game-shot.jpg",
}


def asset(name: str) -> str | None:
    return f"/local/darts/{name}" if (ASSETS / name).is_file() else None


def card(prefix: str) -> dict:
    config = {
        "type": "custom:autodarts-classic-card",
        "prefix": prefix,
        "board_url": os.environ.get("DEMO_BOARD_URL", "http://127.0.0.1:13180"),
        "brand": os.environ.get("DEMO_BRAND", "Darts"),
        "ha_sync": True,
        "camera_window": False,
    }
    if logo := asset("logo.png"):
        config["logo"] = logo
        config["theme"] = "red"
    if hero := asset("hero.jpg"):
        config["hero"] = hero
        config["hero_position"] = "center 30%"
    moments = {key: url for key, name in MOMENTS.items() if (url := asset(name))}
    if moments:
        config["moments"] = moments
    if player := asset("player.jpg"):
        config["avatars"] = {"Player 1": player}
    return config


async def main() -> None:
    async with aiohttp.ClientSession(
        timeout=aiohttp.ClientTimeout(total=60)
    ) as session:
        demo = Scenario(session)
        await demo.onboard()
        await demo.connect()
        if GENERATION >= 2:
            result = await demo.discovered_setup()
        else:
            result = await demo.local_flow("board-mock", PORT)
        entry_id = result["result"]["entry_id"]
        await demo.registries(entry_id)
        await demo.service("button", "press", "start")
        await demo.expect_states({"detection": "on"})
        # The board's entity id prefix, for the card's prefix option.
        prefix = demo.entity("detection").split(".", 1)[1].removesuffix("_detection")

        version = int(CARD.stat().st_mtime)
        await demo.ws(
            "lovelace/resources/create",
            res_type="module",
            url=f"/local/autodarts-classic-card.js?v={version}",
        )
        await demo.ws(
            "lovelace/dashboards/create",
            url_path=DASHBOARD,
            title="Darts",
            icon="mdi:bullseye-arrow",
            show_in_sidebar=True,
            require_admin=False,
            mode="storage",
        )
        await demo.ws(
            "lovelace/config/save",
            url_path=DASHBOARD,
            config={
                "views": [
                    {
                        "title": "Game",
                        "path": "game",
                        "type": "panel",
                        "cards": [card(prefix)],
                    }
                ]
            },
        )
        await demo.socket.close()
        print(f"Game screen ready for board prefix {prefix}")


if __name__ == "__main__":
    asyncio.run(main())
