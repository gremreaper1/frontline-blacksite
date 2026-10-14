# FRONTLINE BLACKSITE — 3D Browser FPS + Multiplayer

A lightweight, original low-poly 3D shooter built with Three.js and a Node.js WebSocket server. Includes Quick Play for up to 20 players, private 1v1 matchmaking, respawning training bots, headshot damage, a two-gun class editor, level unlocks, Black Coin challenges and rewards, enterable buildings, loot chests, and a large open-world map. Progression is saved in the browser.

## Run it on your computer

1. Install Node.js 18 or newer: https://nodejs.org/
2. Extract this folder.
3. Open a terminal in the project folder and run:
   ```bash
   npm install
   npm start
   ```
4. Visit **http://localhost:3000**. For online multiplayer testing on one network, other people can visit `http://YOUR-COMPUTER-LAN-IP:3000` if your firewall allows it.
5. One person chooses a room code and map, then clicks **Join Online Room**. Everyone else visits the same address, types the exact same room code, and joins. The map that created the room selects the arena for that room.

Use **Play Training** to practice offline against bots without starting a server connection.

Choose a map and click **Find 1v1 Match** to join the matchmaking queue. The server pairs you with the next available player in a private two-player room. Press **Esc** and choose **Leave Match** to cancel while searching.

Click **Quick Play · 20 Players** to join a shared online free-for-all room. Quick Play fills rooms up to 20 players; it is separate from private 1v1 matchmaking.

## Host it publicly

The online server must be hosted for people outside your home/network to join. One simple path:

1. Upload the project folder to a GitHub repository.
2. Create a Node web service on a host that supports WebSockets (the included `render.yaml` is a starting point for Render).
3. Deploy with `npm install` as the build command and `npm start` as the start command.
4. Open the service's HTTPS URL, share it with friends, and have everyone use the same room code. Secure WebSocket (`wss://`) is selected automatically for HTTPS hosting.

The Three.js browser module loads from jsDelivr, so users need internet access even when running the local server.

## Google Cloud Run

Cloud Run can host this Node.js server and its WebSocket multiplayer. Create a Google Cloud project, enable billing, install the Google Cloud CLI, then authenticate and select the project:

```powershell
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

From the project folder, deploy the source:

```powershell
gcloud run deploy frontline-blacksite --source . --region us-central1 --allow-unauthenticated --max-instances 1 --timeout 3600
```

Use the HTTPS URL printed after deployment to play and share the game. The single-instance limit keeps in-memory rooms together; Cloud Run requires billing to be enabled. This publishes the browser game, not a Google Play Store app.

## Controls

### PC
- **W A S D** move, **mouse** look freely left/right/up/down
- **Left-click** fire, **right-click** use the weapon optic, **Shift** sprint, **Left Ctrl** slide, **Space** jump
- **R** reload, **E** open a nearby supply chest, **1–2** select a loadout weapon, **Q** cycle weapon, **Esc** pause
- **Quick Play · 20 Players** joins a shared FFA match; **Find 1v1 Match** uses the private duel queue
- **Class Creation** selects two different weapons and saves their attachments and camo finishes. A Tactical optic is required for the scope overlay.
- **Weapon unlocks:** SMG at level 2, shotgun at 3, DMR at 5, and sniper at 8
- **Daily challenges:** earn 90–140 Black Coins; spend them on level-gated Black Pass rewards
- **Black Pass rewards:** Glasswing at level 3 (180 coins), Diamond camo at level 5 (420), Night Ops at level 8 (650), and Dark Matter camo at level 10 (900)
- **Settings** changes look sensitivity, sound-effect volume, and keyboard bindings, including Slide

### Phone/tablet
- Left virtual stick moves, right virtual stick looks around
- FIRE, AIM, RELOAD, JUMP, SLIDE, GUN, and nearby OPEN buttons on screen

## Maps and weapons

- **Sunset Suburb** — an original compact suburban arena with enterable homes, parked cars, fences, and cover.
- **Dustline Yard** — industrial depot, enterable warehouses, containers, and longer sightlines.
- **Harbor 09** — docks, stacked cargo, pier edges, and mixed-range cover.
- **Frontier Open World** — a 440-by-440-unit roaming map with roads, neighborhoods, enterable homes, and online rooms capped at 20 players.
- **Blackout SMG**, **Ranger 556 assault rifle**, **Sidewinder pistol**, **Breach 12 shotgun**, **Longview DMR marksman rifle**, and **Nightfall .308 bolt-action sniper**.

## Important limitations

This is an extensible multiplayer prototype, not a production-scale Warzone clone. Progression and Black Coins are browser-local and are not account-backed, so clearing browser storage clears them. The server relays state and performs basic server-side hit/damage checks, but it does not yet have full wall-occlusion validation, robust anti-cheat, skill-based matchmaking, accounts, voice chat, or ranked queues. Public hosting, latency, device/browser WebGL support, and CDN availability can affect play. The visuals, layouts, and synthesized effects are original; no Call of Duty art, maps, logos, or audio assets are included. A prototype cannot guarantee zero lag or bugs on all devices.
