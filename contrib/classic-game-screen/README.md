# Classic game screen

A full-screen game screen for a TV or monitor at the board, in the style of play.autodarts.io. It is a single Lovelace card that sits on top of this integration: it reads the integration's entities, calls its services and talks to the board's local API for dart positions. Nothing in the integration changes.

| New game | X01 | Wild Mouse |
| --- | --- | --- |
| ![New game](images/lobby.png) | ![X01](images/x01.png) | ![Wild Mouse](images/wild-mouse.png) |

## What it does

- Covers Home Assistant's header and sidebar, so players only see the game.
- **New game** screen with every game as a tile with its own icon and colour (X01, Cricket, party and training games), recent players as one-tap chips, bot levels, legs, double in/out and Golf holes.
- **How to play**: an **(i)** on every game tile, and next to the game name while playing, opens that game's rules: who can play, the goal, how it scores and how it is won.

  ![A rules sheet](images/rules-sheet.png)
- **Dart-machine look**: a dark theme made for a TV at the board (or classic blue, pub green, neon, high contrast). Every player keeps a colour on their card, chalkboard column and dart markers; the newest dart is white.
- **Game screen**: big scores readable from several metres, whose turn it is with the darts left (●●○), the three darts of the visit, checkout suggestion, bust, Undo and Next player. Cricket games use a chalkboard with marks in the players' colours. Training games show the next target and progress.
- **Result screen**: the winner, then every player ranked with legs, average or marks per round and their score, with Rematch and New game.

  ![The result screen](images/result.png)
- **Correct a dart** the board read wrong: tap it (every dart has a ✎) and pick the right bed. See [Correcting darts](#correcting-darts).
- **Drawn dartboard** with a marker where each dart landed (from the board's `/api/events` coordinates). The camera picture is one tap away (warped straight-on with the calibration homography from `/api/system`).
- **Wild Mouse (Minnesota) Cricket**, which the integration does not have. The card scores it itself from the board's darts.
- Resets the board when it hangs in "Takeout in progress" with no darts on it (seen with Autodarts 2.0.2), and wakes it from standby. With several screens on one board, keep the reset on one of them and set `stuck_takeout_reset: 0` on the others.

## Install

1. Copy `autodarts-classic-card.js` to `config/www/` of Home Assistant.
2. Settings → Dashboards → ⋮ → Resources → Add: `/local/autodarts-classic-card.js?v=1`, type *JavaScript module*. Raise `v` after every change so browsers reload it.
3. Add a dashboard with one view in **panel** mode and this card:

```yaml
type: custom:autodarts-classic-card
# all optional:
prefix: autodarts_board        # entity id prefix of the board
board_url: http://192.168.1.50:3180   # otherwise read from the integration's device
view: virtual                  # virtual (drawn board) or live (camera)
camera: 0                      # first camera for the live view
brand: Darts                   # name on the screens
photo: /local/my-photo.jpg     # optional picture on the New game and Game shot screens
overlay: true                  # cover Home Assistant's header and sidebar
stuck_takeout_reset: 5         # seconds before a stuck takeout is reset; 0 turns it off
theme: machine                 # machine (dark, default), classic (blue), pub, neon or contrast; also on the New game screen
player_colors: ["#3b82f6", "#f43f5e", "#22c55e", "#f59e0b"]   # one colour per player, in throwing order
```

The board's local API must be reachable from the browser (it answers CORS with `*`). If Home Assistant is served over HTTPS, the browser blocks the plain-HTTP board and the card falls back to what the entities carry.

## Correcting darts

When the calibration is off or a dart sits on a wire, the board can read a dart wrong. Tap the dart in the visit and a pad opens: choose Single, Double or Triple, then the number, or 25, Bull or Miss. The dart is corrected through the integration's `autodarts.correct_dart`, and the score, bust, checkout and cricket marks follow at once.

![The correction pad](images/correct-dart.png)

- **A dart the board missed:** with the integration's *Practice manual entry* switch on, the next empty slot shows **+ Add dart**, which enters it with `autodarts.throw_dart`.
- **After the takeout:** Undo reopens the last visit, then its darts can be corrected; Next player ends it again.
- **Wild Mouse** is scored by the card, so the card corrects it itself: the visit is replayed with the right bed, and marks, points and a won leg follow. **+ Add dart** always works there while the leg is open.

## Wild Mouse rules

Cricket on 20–15 and bull, plus **Doubles** and **Triples** to close, and optionally **Three in a bed**.

- A dart counts toward one target only. A double or triple on a cricket number you still have open marks that number (T20 = 3 marks on 20). Otherwise it is one mark on Doubles or Triples.
- A closed target scores while an opponent still has it open: numbers as in Cricket, Doubles and Triples the full value of the dart, Three in a bed the visit's total.
- Win: everything closed and not behind on points. Legs are supported.
- The visit ends when the darts are pulled (the board's throws drop to zero) or with Next player. Undo takes back the last visit. A tap on a dart corrects it.

The game state lives in the browser's `localStorage`, so it belongs to one screen.

## Tests

```bash
npm ci   # once: the browser tests use happy-dom from the repository's dev dependencies
node --test "contrib/classic-game-screen/*.test.mjs"
```

## Setting a board up from scratch

[UPGRADE-TO-V2.md](UPGRADE-TO-V2.md) walks through moving a board from Autodarts 1.x to 2.x and setting up Home Assistant, this integration, the game screen and a one-click launcher, including the problems met on the way. `extras/` has the launcher and loading screen.
