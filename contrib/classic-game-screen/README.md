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
theme: machine                 # machine (dark, default), red, classic (blue), pub, neon or contrast; also on the New game screen
player_colors: ["#3b82f6", "#f43f5e", "#22c55e", "#f59e0b"]   # one colour per player, in throwing order
sound: true                    # sound effects (also on the New game screen and the 🔊 button)
caller: true                   # the caller: scores, "You require", "Game shot"
voice_path: /local/darts/voice/   # optional: your own recordings, see Feedback, sound and the caller
caller_voice: Daniel           # optional: part of the name of a browser voice to use
camera_window: false           # optional: small live board camera on the game screen
replay_on: ["180", "game_shot"]   # optional: moments that get a thrower replay (180, game_shot, bull, t20, ton)
auto_next: 0                   # optional: Wild Mouse moves on this many seconds after the third dart (0: when darts are pulled)
ha_sync: false                 # optional: write the game to Home Assistant helpers and take controls from them
avatars:                       # optional: pictures by player name, shared by every screen
  Joey: /local/darts/joey.png
```

The board's local API must be reachable from the browser (it answers CORS with `*`). If Home Assistant is served over HTTPS, the browser blocks the plain-HTTP board and the card falls back to what the entities carry.

## Players and photos

Add as many players as there are: Wild Mouse takes up to 24, and with five or more the thrower's card is shown big and everybody else small. The integration's own games (X01, Cricket, party and training games) play up to four; with more in the list they start with the first four, and the New game screen says so. *Shuffle order* mixes up who throws first.

![Twelve players in Wild Mouse](images/party-12.png)

Every player has a picture on their score card, in the player list and on the result screen, in their colour:

1. **A photo taken at the screen**: 📷 next to a name opens the photo booth. It uses the webcam of the screen's PC, counts down and takes a square photo; *Choose a picture* takes one from a file instead. Photos are kept in that screen's browser.
2. **The `avatars` option**, for pictures every screen shares: `avatars: {Joey: /local/darts/joey.png}`.
3. **The picture of a Home Assistant person** with the same name, automatically.
4. Otherwise the player's initials.

**Webcam**: any USB webcam works (1080p with autofocus is plenty). Plug it into the PC that shows the screen, on a different USB controller from the Autodarts cameras so it cannot take their bandwidth; the booth only turns it on while it is open. Browsers give pages the webcam only over https or on localhost, so open Home Assistant as `http://localhost:8123` on the screen's PC: the launcher in `extras/` does this, and allows the webcam without a prompt.

## Home Assistant in control

The integration's own games already have their entities. With `ha_sync: true` and the helpers of [`extras/darts-screen-package.yaml`](extras/darts-screen-package.yaml) (a Home Assistant package), every game the screen plays, Wild Mouse included, is also written to Home Assistant, and Home Assistant can run the screen:

| Helper | |
| --- | --- |
| `input_text.darts_screen_status` | `idle`, `lobby`, `playing` or `finished` |
| `input_text.darts_screen_game`, `_player`, `_scores`, `_last_dart`, `_winner` | the game, who is throwing, "Joey 60 · Sam 20", the last dart (T20, BULL …), the winner |
| `input_text.darts_screen_players` | set it to "Joey, Sam, Alex" to fill the player list |
| `input_select.darts_screen_game` | picking a game starts it with those players |
| `input_button.darts_screen_new_game`, `_rematch`, `_next_player`, `_undo`, `_end_game` | the screen's buttons |

So an automation can flash the lights for the winner, a voice assistant can say who is throwing, and a phone dashboard can start the next game. Turn `ha_sync` on for one screen. The status pill also warns when one of the board's cameras reports a problem (the integration's camera problem sensors).

## Cameras and replays

Up to two webcams on the screen's PC, next to the Autodarts cameras (which stay untouched: the card only reads their picture):

- **Photo webcam**, on the monitor: player photos (see *Players and photos*).
- **Thrower webcam**, in front of the oche facing the player: **instant replay**. While a game is on the screen the card keeps the last seconds of this webcam in memory; after a 180 or a game shot (choose which moments: 180, game shot, bullseye, T20, ton plus) it shows **"Let's see that again"**: the last five seconds, then the last two and a half in **slow motion**. *Again* and *Slow motion* replay it, and the video button in the game bar replays the last throw at any time. Nothing is saved or sent anywhere.
- **Board camera window**: a small live picture from an Autodarts camera in a corner of the board area; tap it for all board cameras big, and tap one to show it in the window. It only streams while it is on the screen.

Set them up on the New game screen under *Screen → Cameras*: which webcam takes photos, which records the thrower (or off), which moments get a replay, and the board camera window. `camera_window: true` and `replay_on: ["180", "game_shot"]` set the defaults in the card options.

What it takes: two USB webcams (a 1080p webcam at 30 fps is plenty; 60 fps ones make smoother slow motion). The replay is recorded by the browser's own video encoder, a few megabits a second, and only while a game is on. Plug the webcams into a different USB controller from the Autodarts cameras, so the board keeps all its bandwidth; if the board PC is short on USB or CPU, the screen can run on a second PC or mini PC with the webcams, pointing at the same Home Assistant and board. Browsers only allow webcams on https or localhost.

## Your brand and moment pictures

Make the screen yours with your own artwork, kept in `config/www/darts/` (not in this repository):

```yaml
brand: Joey Auto Darts
logo: /local/darts/logo.png          # lobby title and a corner of the board
hero: /local/darts/hero.jpg          # a wide banner over the games in the lobby
hero_position: center 30%            # which part of the banner picture to show
theme: red                           # a black and red look to go with it
moments:                             # a picture slammed in over the screen when it happens
  "180": /local/darts/180.jpg
  bull: /local/darts/bullseye.jpg
  t20: /local/darts/triple20.jpg     # t1 … t20 for one treble, treble for any
  bounce_out: /local/darts/bounce-out.jpg
  miss: /local/darts/out-of-board.jpg
  game_shot: /local/darts/game-shot.jpg
```

Every moment is optional; without a picture the built-in effect plays. The keys: `180`, `ton` (100+), `ton40` (140+), `bull`, `outer`, `double`, `treble`, `t1` … `t20`, `miss`, `bounce_out` (a dart the board flagged as a bouncer), `bust`, `three_in_a_bed`, `game_shot`. Square pictures work best for moments; web-optimised JPEGs of about 1024 px keep them quick on a TV. Pictures must be site paths (`/local/…`) or web addresses.

## Feedback, sound and the caller

Every dart flashes big over the board for a moment, styled by what it hit (single, double, treble, bull, miss), with its own sound. A 180 and a ton plus get a full-screen celebration, and so do three in a bed and a bust; a won game gets confetti and a fanfare. Scores run down to their new value instead of jumping.

| Treble | Bullseye | 180 |
| --- | --- | --- |
| ![](images/hit-treble.png) | ![](images/hit-bull.png) | ![](images/celebrate-180.png) |

The **caller** calls every X01 visit ("One hundred and forty"), tells the next thrower what they require when they are on a finish, and calls "Game on", "Bust", "Three in a bed", "Doubles closed" and "Game shot, and the match". It uses the browser's voice, or your own recordings: put MP3 files named as below in `config/www/darts/voice/` and set `voice_path: /local/darts/voice/`. A missing file is spoken instead, so recordings can be added a few at a time.

| File | Line |
| --- | --- |
| `game_on`, `180`, `game_shot`, `game_shot_leg`, `game_shot_match` | "Game on!", "One hundred and eighty!", "Game shot!" … |
| `bust`, `no_score`, `you_require` | "Bust!", "No score", "You require…" |
| `three_in_a_bed`, `doubles_closed`, `triples_closed` | Wild Mouse |
| `score_0` … `score_180` | every visit score, and the number after "You require" |
| `name_<name>`, for example `name_joey` | player names, lower case, spaces as `_` |

Most browsers play sound only after a first tap on the screen; the launcher in `extras/` starts Chrome with autoplay allowed, so it works at once. The 🔊 button in the game bar mutes effects and caller together.

## Correcting darts

When the calibration is off or a dart sits on a wire, the board can read a dart wrong. Tap the dart in the visit and a pad opens: choose Single, Double or Triple, then the number, or 25, Bull or Miss. The dart is corrected through the integration's `autodarts.correct_dart`, and the score, bust, checkout and cricket marks follow at once.

![The correction pad](images/correct-dart.png)

- **A dart the board missed:** with the integration's *Practice manual entry* switch on, the next empty slot shows **+ Add dart**, which enters it with `autodarts.throw_dart`.
- **After the takeout:** Undo reopens the last visit, then its darts can be corrected; Next player ends it again.
- **Wild Mouse** is scored by the card, so the card corrects it itself: the visit is replayed with the right bed, and marks, points and a won leg follow. **+ Add dart** always works there while the leg is open.

## Cricket boards

The chalkboard of every cricket game (Cricket, Cut-Throat, Tactics, Wild Mouse) helps the thrower like a dart machine does:

- **Score** in green next to the thrower's marks where they have closed a target and somebody is still open, and **Close** in amber where somebody else has closed it and could score on them.
- A **shield** on a row when a dart hits a target that everybody has closed, so it scored nothing.
- The points a dart scored float up from the player's card (**+20**).
- Wild Mouse can move to the next player by itself 3, 5 or 10 seconds after the third dart (*Next player after three darts* on the New game screen, or `auto_next: 5`), for boards whose takeout is not seen reliably. The thrower's tag counts down.

![Aim hints on the chalkboard](images/cricket-hints.png)

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
