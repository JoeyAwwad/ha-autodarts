# From Autodarts 1.x to 2.x, plus Home Assistant and the game screen

A runbook for a person or a coding agent. It moves a Linux board PC from Autodarts 1.x (the `.deb` Desktop app and Board Manager on port 3180) to Autodarts 2.x, then adds Home Assistant, this integration, the classic game screen and a one-click launcher. Written from a real upgrade on Ubuntu 24.04 with three Autodarts DIY cams; every step has a check.

Placeholders: `BOARD_IP` is the board PC's LAN address, `BOARD_ID` the board's id (from its config).

## 0. Look before changing anything

```bash
dpkg -l | grep -i autodarts                          # 1.x Desktop is a .deb (autodarts-desktop 1.x)
ls ~/.config/"Autodarts Desktop"/autodarts/          # 1.x Desktop: config.toml + bin/autodarts
ls ~/.config/autodarts/ 2>/dev/null                  # 1.x headless board config
ss -ltnp | grep -E ':318[01]'                         # is a board serving?
ls -l /dev/v4l/by-id/ /dev/video*                     # cameras
```

Known 1.x trouble, useful if the old setup is broken while you work:

- **The 1.x Desktop window never opens and the board never starts.** Its Electron start-up awaits a sign-in call without error handling; when that call fails, the chain stops before the window and before the detection binary. The process stays alive with no renderer. The workaround is to run the detection binary directly.
- **The detection binary reads `$XDG_CONFIG_HOME/autodarts/config.toml` and has no `--config` flag.** Started without the Desktop's environment it creates an empty `~/.config/autodarts/config.toml` and comes up unclaimed ("Claim your board"). Start it as the Desktop does:

  ```bash
  XDG_CONFIG_HOME="$HOME/.config/Autodarts Desktop" "$HOME/.config/Autodarts Desktop/autodarts/bin/autodarts"
  ```

  and delete a stray `~/.config/autodarts/` it may have made.

## 1. Back up

```bash
B=~/autodarts-v1-backup-$(date +%F); mkdir -p "$B"
cp -a ~/.config/"Autodarts Desktop"/autodarts "$B/"      # config.toml (board id, api key) + old binary
sha256sum ~/.config/"Autodarts Desktop"/autodarts/config.toml "$B/autodarts/config.toml"
```

Note the camera order in the old config (`[cam] cams = ['/dev/video0', '/dev/video2', '/dev/video4']`). Calibration is stored per camera slot in the cloud, so the new setup must keep this order.

## 2. Install Autodarts 2.x

Stop the old board first so it frees the cameras and port 3180:

```bash
kill $(ss -ltnp | grep -oP ':3180 .*pid=\K[0-9]+' | head -1)
curl -fsSL https://autodarts.sh -o /tmp/ad-install.sh     # read it before running it
bash /tmp/ad-install.sh --desktop --dry-run
bash /tmp/ad-install.sh --desktop
```

What the installer does (read from the script):

- Installs `~/.local/bin/autodarts-desktop.AppImage` and a menu entry; it updates itself afterwards.
- Removes the 1.x `.deb` with sudo. Without a terminal for the password it prints `sudo dpkg -r autodarts-desktop` for you to run.
- **Deletes `~/.config/Autodarts Desktop/autodarts/bin`**, so any launcher that ran the 1.x binary stops working.
- Keeps the configs; 2.x imports the board's sign-in on first run.

Check: `~/.local/bin/autodarts-desktop.AppImage` starts, and its log shows `Upstream: imported board BOARD_ID` and `Connected to the Autodarts server`.

## 3. Fix what 2.x does not import

**Cameras.** 2.x imports the sign-in but not the camera list: `~/.config/autodarts-desktop/config.toml` has `devices = [ '', '', '' ]` and the log says `Not starting: no camera is streaming`. Read the cameras from the local API while the app runs:

```bash
curl -s http://127.0.0.1:3180/api/devices
```

Each camera has a path like `native=/dev/video0&vid=0bda&pid=5844&serial=...&location=1-2`. Several identical cams share one serial; the USB `location` tells them apart. Quit the app, put the paths into `devices` **in the old slot order**, start it again. Check: `Session started: 3 cams` and `event: Started status=Throw`.

**Port 3180 on the first start.** A connection from a browser tab of the old Board Manager can hold the port in TIME_WAIT (`failed to bind 0.0.0.0:3180`). Restart the app once the port is free (`ss -tan | grep :3180`).

**Internet at start.** 2.x does not start detection before it reaches the Autodarts server (`Not starting: not connected to autodarts.com yet`). After that the local API works on the LAN.

## 4. The 2.x local API (what the game screen uses)

No sign-in, CORS `*`, on port 3180:

| Endpoint | Use |
| --- | --- |
| `GET /api/state` | `{status, event, numThrows, throws:[{segment:{name,number,bed,multiplier}, coords:{x,y}, bouncer}]}` |
| `ws /api/events` | the same state, pushed as `{"type":"state","data":{...}}` the moment a dart lands |
| `ws /api/events/system` | state plus `board`, `motion` and ~25 `timings` frames a second |
| `POST /api/reset` | clears the visit; frees a stuck takeout |
| `GET /api/system` | status, calibration with a `homography` per camera |
| `GET /api/streams/cams/N` | MJPEG camera stream |

`coords` are fractions of the double ring's outer edge with y pointing up. The homography maps camera pixels onto a 1000 × 1000 board plane with the bull at (500, 500) and the double ring's outer edge at radius 360. Key new darts on `numThrows` and the `throws` list, not on the `event` text: the first frame of a new dart can still carry the previous event name.

Two things to know when building on it:

- **Stuck takeout (2.0.2).** Sometimes, right after a normal takeout, the board goes back to "Takeout in progress" with 0 darts and stays there; darts thrown then are not counted. `POST /api/reset` frees it. The game screen does this after 5 seconds (card option `stuck_takeout_reset`; 0 turns it off).
- **Standby.** Detection stops after 15 idle minutes (`Standby: 15 minutes without activity`). The integration's detection switch starts it again.

## 5. Home Assistant in Docker

```bash
sudo apt-get install -y docker.io docker-compose-v2
sudo usermod -aG docker "$USER"        # new shells: or use: sg docker -c '...'
mkdir -p ~/homeassistant/config
```

`~/homeassistant/compose.yaml`:

```yaml
services:
  homeassistant:
    container_name: homeassistant
    image: ghcr.io/home-assistant/home-assistant:stable
    network_mode: host          # zeroconf discovery of the board needs it
    restart: unless-stopped
    environment:
      TZ: Etc/UTC               # your time zone
    volumes:
      - ./config:/config
      - /etc/localtime:/etc/localtime:ro
```

Leave out `/run/dbus` unless you want Bluetooth; mounting it without extra capabilities only fills the log with Bluetooth errors. Files Home Assistant writes in `config/` belong to root; edit them through the container (`docker exec -i homeassistant sh -c 'cat >> /config/configuration.yaml'`).

Onboarding can be done in the browser or through `/api/onboarding/*`.

## 6. The integration and the game screen

1. Unpack the release's `autodarts.zip` into `config/custom_components/autodarts/` (or install through HACS) and restart.
2. Settings → Devices: the board is offered by zeroconf (`_autodarts-board._tcp`); confirm it.
3. Install the game screen as in [README.md](README.md).

Integration behaviour worth knowing when testing with services:

- `autodarts.throw_dart` works only with **Practice manual entry** switched on.
- After three darts, `autodarts.next_player` (or a real takeout) ends the visit; a fourth dart is refused.
- `autodarts.undo_visit` reopens the last *completed* visit for correction; it is refused while darts are on the board.
- A leg is booked when the turn passes after the winning dart.
- Ending a game: `select.select_option` on the practice game select with `off`.
- Training games keep their state on the *practice target* sensor (`drill`, `progress`, `targets`, `hits`, `hit_rate`); the other games on *practice remaining score*.

## 7. No login on the board PC (optional)

A non-admin user for the screen, and `trusted_networks` for the board PC only:

```yaml
homeassistant:
  auth_providers:
    - type: trusted_networks
      trusted_networks:
        - 127.0.0.1/32
        - BOARD_IP/32
      trusted_users:
        127.0.0.1/32: DARTS_USER_ID
        BOARD_IP/32: DARTS_USER_ID
      allow_bypass_login: true
    - type: homeassistant
```

Check from another address that a trusted-network login is refused, for example from a bridged container: `docker run --rm curlimages/curl ... /auth/login_flow` → `"reason":"not_allowed"`. A request from the board PC to one of its own other addresses still counts as the board PC.

## 8. One-click start

`extras/play-darts.sh` starts the Autodarts app, then the screen window, then Home Assistant (`docker compose up -d`) if it is down; `extras/splash.html` is the loading screen it opens, which waits for the board and Home Assistant and then moves on. The loading screen opens `http://HOST:8123/darts-classic/game`, so create the dashboard with the URL `darts-classic` and a panel view with the path `game` (or change `GAME` in `splash.html`). Set `DARTS_HOST` if the first address of `hostname -I` is not the one to use. Put a `.desktop` entry for the script on the desktop, in `~/.local/share/applications/` (to pin it) and in `~/.config/autostart/` (to start at login).

## 9. Final check

- [ ] `curl -s http://127.0.0.1:3180/api/state` shows `"status":"Throw"`
- [ ] Throw three darts: they appear in Home Assistant within a second; the takeout passes the turn
- [ ] The game screen starts and ends a game; Undo and Next player work
- [ ] Stop Home Assistant and the Autodarts app, click the launcher: everything comes back

## For coding agents

- **Never `pkill -f <pattern>` from your own shell.** The pattern is in your shell's command line, so it kills the shell. Match `/proc/PID/cmdline` and kill by PID.
- `sudo` has no terminal: use `sudo -S` with a password the user gave, or `pkexec` (desktop pop-up), or ask the user to run the command.
- Read `curl | bash` installers before running them; this one deletes the 1.x binary.
- Wait for long-running work with your tool's background or notification mechanism, not with fixed `sleep` calls.
- Headless Chrome with `--remote-debugging-port` gives screenshots of the real UI; seed Home Assistant's `hassTokens` in `localStorage` to sign it in. Origins differ between `127.0.0.1` and the LAN address.
- Home Assistant REST calls return 500 for a `ServiceValidationError`; read the message in the container log.
- Ask for a real dart when timing matters: the board only reports darts thrown while you listen.
