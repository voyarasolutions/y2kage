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

WASD move, arrows or Q/E turn, mouse look (click to lock), click fire, Space and Shift for ride tricks, P or Esc pause,
M mute. On touch screens: left thumb moves, right thumb looks, with on-screen fire, jump and boost buttons.
