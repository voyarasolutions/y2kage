# Y2Kage

A 16-bit first-person zombie horde shooter set on New Year's Eve 1999. Five heroes, each with their own ride and weapon,
hold out through 50 levels, one per minute from 11:10 PM, until the ball drops and the clocks roll over to 2000.

Built from scratch in Three.js. The city is real 3D geometry rendered at 384x216 and crushed to a dithered 16-bit
palette; everything you see (textures, zombies, weapons, Windows 98 interface) is pixel art painted in code at boot.
Runs in any modern browser and ships to iOS with Capacitor.

## Run it

```sh
npm install
npm run dev        # local dev server
npm run build      # production build into dist/
```

Add `?skip=title` to the URL to jump past the power-on, BIOS and dial-up intro.

## Put it online

`npm run build` makes a plain static site in `dist/` (relative paths, no server code). Any static host works:

- **itch.io**: zip the *contents* of `dist/` (so `index.html` is at the top of the zip), create a new project, set
  Kind to HTML, upload the zip, tick "This file will be played in the browser", and set the embed size to 1280x720 with
  the fullscreen button on. Share the page link.
- **GitHub Pages, Netlify, Cloudflare Pages**: publish the `dist/` folder as the site root.

## Online co-op

Up to four players, host plus three guests, over WebRTC (`src/net/net.js`, PeerJS). Online Co-op on the title screen:
the host gets a five-letter room code and a join link (`?join=CODE`); guests type the code or open the link. The host's
game runs the level and streams snapshots about 20 times a second; each guest moves themselves locally and sends their
position and actions. Waves grow 60% per extra player. A player who goes down reboots at the start of the next wave; the
level is lost only when everyone is down.

Matchmaking uses the free public PeerJS broker, and PeerJS's TURN relay covers strict NATs. For local testing without
internet, run a PeerJS server (`npx peerjs --port 9000`) and add `?peer=localhost:9000` to every player's URL.

## iOS

The Xcode project is in `ios/` (Capacitor, Swift Package Manager). On a Mac with Xcode:

```sh
npm run build
npx cap sync ios
npx cap open ios   # then run on a simulator or device from Xcode
```

The app is locked to landscape. Fonts are bundled so it works offline.

## How it looks 16-bit

- `src/gfx/pipeline.js` renders the scene into a 384x216 target with nearest filtering, then a post pass quantises
  each channel with a 4x4 Bayer dither, adds Y2K glitch tearing and damage flashes. The browser upscales with hard edges.
- `src/gfx/textures.js` paints every wall, floor, sky and prop skin at 32 texels per map unit.
- `src/gfx/sprites.js` draws the horde (party shamblers, ravers, bouncers, CRT-headed Corrupted, the Millennium Bug),
  projectiles, pickups, hero portraits and icons, all with 1px outlines.
- `src/world/world.js` turns each ASCII map into buildings, storefronts, jumbotrons, subway tile and server racks, with
  streetlamp, neon and fluorescent light baked into vertex colours.
- `src/ui/` is the Windows 98 layer: taskbar HUD with the countdown clock in the tray, dialog banners, the iMac-colour
  hero picker, the Blue Screen of Death, and "It's now safe to turn off your computer."
- `src/audio/` has the synthesised effects, a 56k dial-up handshake, and a chiptune player (pulse, triangle, noise).

## Layout

- `src/data/`   levels (50-level wave design, level n = 11:(09+n) PM), maps (one arena per district), heroes
- `src/game/`   `game.js` (modes, flow, rendering each frame) and `sim.js` (rides, weapons, flow-field zombie AI, waves)
- `src/core/`   palette, pixel font (Press Start 2P and Silkscreen, thresholded to hard pixels), input, storage

## Controls

WASD move, arrows or Q/E turn, mouse look (click to lock), click fire, Space and Shift for ride tricks, R or right-click
for the hero's special once its meter is full, P or Esc pause, M mute. On touch screens: left thumb moves, right thumb looks, with on-screen fire, jump and boost buttons.
