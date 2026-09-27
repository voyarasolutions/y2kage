# Y2Kage

**A 16-bit first-person zombie horde shooter set on New Year's Eve 1999.** The Y2K bug is real, it turned the party into
a horde, and you have until midnight. Pick one of five 90s kids, each with their own ride and their own ridiculous
weapon, and hold out through 50 levels, one per minute from 11:10 PM, until the ball drops and the clocks roll over to 2000.

Built from scratch in Three.js. The city is real 3D geometry rendered at 384x216 and crushed to a dithered 16-bit
palette; everything you see (textures, zombies, weapons, the Windows 98 interface) is pixel art painted in code at boot.
Runs in any modern browser, supports online co-op for up to four players, and ships to iOS with Capacitor.

| | |
|---|---|
| ![Hero select](docs/screenshots/hero-select.png) | ![Broadway horde](docs/screenshots/broadway-horde.png) |
| ![Tidal Wave special](docs/screenshots/special-tidal-wave.png) | ![Online co-op](docs/screenshots/coop.png) |
| ![Subway platform](docs/screenshots/subway.png) | ![Game over](docs/screenshots/bsod.png) |
| ![The Frontman's shockwave](docs/screenshots/boss-frontman.png) | ![The Mainframe firing packets](docs/screenshots/boss-mainframe.png) |
| ![The Countdown](docs/screenshots/boss-countdown.png) | ![Picking an upgrade](docs/screenshots/upgrades.png) |
| ![The Soaker 2500 pumping back up](docs/screenshots/soaker-2500.png) | ![Playing with three CPU teammates](docs/screenshots/cpu-crew.png) |

## Features

- **50 levels, 5 districts, 5 bosses.** Level *n* takes place at 11:(09+*n*) PM on December 31, 1999. The district
  changes every ten levels, and each district ends in a fight with its own boss. Beat level 50 at 11:59 and the year
  rolls over.
- **Upgrades between levels.** Clear a level and install one of three random upgrades (fire rate, damage, max health,
  regeneration, pickup range and more). They stack for the rest of the run.
- **Trophies and unlockables.** 17 trophies. Beating bosses and other feats unlock Endless mode and cheats.
- **Endless mode.** Pick any district you have reached and survive as many waves as you can; its boss returns every
  fifth wave. Your best wave per district is saved.
- **Gamepad support.** Plug in any standard controller (Xbox, PlayStation, Switch Pro) and play without the keyboard.
- **Five heroes, five rides, five weapons.** Every hero moves differently and shoots differently, and each has a
  special move that charges over time and with kills (R or right-click). Weapons are held at a three-quarter angle:
  Tina's Soaker 2500 has a see-through reservoir that drains as she sprays and a pump she works to build pressure back up.
- **A 90s horde.** Party Shamblers, Ravers, Bouncers, Bloaters, Crawlers, CRT-headed Corrupted, and the Millennium Bug,
  dressed for whichever district you're in.
- **Headshots and combos.** Headshots deal double damage and pop heads off; chained kills build a score multiplier with
  90s call-outs.
- **Hero progression.** Each hero earns XP that persists between runs; every rank adds 4% damage.
- **Powerups.** Y2K Patch (invincibility), Multitasking (triple, piercing shots), Screensaver (slow motion) and
  Ctrl+Alt+Del (clears the screen).
- **CPU teammates.** Play offline with up to three computer-controlled heroes. They stick with you, keep their distance
  from the horde, pick their own upgrades and fire their specials into crowds.
- **Online co-op** for up to four players with room codes and join links.
- **The horde scales with the team.** Every extra player, human or CPU, adds 75% more zombies to each wave, 45% more on
  screen at once, and 50% more boss health.
- **Full Y2K presentation.** Power-on BIOS screen, 56k dial-up handshake, Windows 98 taskbar HUD with the countdown in
  the system tray, a Blue Screen of Death when you die, a chiptune soundtrack and an Auld Lang Syne ending.

## The bosses

| Levels | Boss | What it does |
|---|---|---|
| 10 | **The Millennium Bug** | Telegraphed bull charges. Sidestep when it roars. |
| 20 | **The Frontman** | A zombie boy-band lead. Sonic shockwaves roll along the street (jump or dash through them) and he calls in backup dancers. |
| 30 | **The Conductor** | Burrows under the platform, tunnels toward you and erupts under your feet. Keep moving when the ground turns red. Brings crawlers up from the tracks. |
| 40 | **The Mainframe** | A walking room-sized computer. Fires fans of data packets, teleports through static and spawns Corrupted. |
| 50 | **The Countdown** | The Times Square ball itself. Charges, shockwaves, packets and minions, all at once. |

Every boss gets faster below half health. From level 30 on, boss levels send two.

## Upgrades

After each cleared level, pick one of three. Each can stack up to five times.

| Upgrade | Effect |
|---|---|
| Overclocked CPU | +15% damage |
| Turbo Button | +15% fire rate |
| Fresh Wheels | +10% ride speed |
| Extra RAM | +25 max health |
| Surge Protector | Start levels with +40 armor |
| Defragmenter | Heal 1 health per second |
| Broadband | Grab pickups from further away |
| Lucky Floppy | +50% powerup drops |
| Hyper-Threading | Special charges 30% faster |
| HEADSHOT.EXE | +30% headshot damage |
| Call Waiting | Combos last 1 second longer |
| Volt Cola Tap | Heal 2 health per kill |
| Long Distance | Powerups last 40% longer |

Retrying a level puts your upgrades back to how they were when it started. Quitting to the menu ends the run. In
online co-op every player picks their own.

## Trophies and extras

Open **Trophies** on the title screen to see them all. The ones that unlock something:

| Trophy | Unlocks |
|---|---|
| Bug Squashed (beat level 10) | **Endless mode**, on the hero select screen (TAB) |
| Encore Cancelled (beat level 20) | **Low Gravity** cheat |
| End of the Line (beat level 30) | **Confetti Goo** cheat |
| Pulled the Plug (beat level 40) | **Turbo Mode** cheat (whole game 25% faster) |
| Happy New Year (beat level 50) | **One Hit Wonder** cheat (everything dies in one hit, you too) |
| Head Hunter (25 headshot kills in a level) | **Big Heads** cheat |

Cheats are switched on and off in the Trophy Case. In co-op the host's cheats apply to everyone.

## The roster

| Hero | Ride | Weapon | Special |
|---|---|---|---|
| Tina | Rollerblades | Soaker 2500 | **Tidal Wave**: a firehose blast that shoves the whole street back |
| Marcus | Skateboard | Dual Yo-Yos | **Around the World**: both yo-yos orbit you for 6 seconds |
| Dot | Slinky Springs | Floppy Disks (ricochet) | **Defrag**: two rings of 24 floppies burst out and bounce everywhere |
| Gus | Pogo Stick | Bottle Rockets | **Grand Finale**: sixteen fireworks rain down around you |
| Kev | Kick Scooter | Laser Pointer | **Light Show**: six spinning beams cut through everything |

## Districts

| Levels | District |
|---|---|
| 1 to 10 | Times Square |
| 11 to 20 | Broadway |
| 21 to 30 | Subway Platform |
| 31 to 40 | Bank Server Room |
| 41 to 50 | The Ball Drop |

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
position and actions. Waves grow 75% per extra player. A player who goes down reboots at the start of the next wave; the
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
- `src/gfx/model.js` is a tiny pixel modeller for the first-person weapons: tubes, boxes and discs laid along a slanted
  axis and shaded per pixel, so each weapon reads as a solid object seen over the hero's shoulder.
- `src/gfx/bosses.js` draws the four district bosses after the Millennium Bug, their data packets and burrow mound.
- `src/gfx/sprites.js` draws the horde (party shamblers, ravers, bouncers, CRT-headed Corrupted, the Millennium Bug),
  projectiles, pickups, hero portraits and icons, all with 1px outlines.
- `src/world/world.js` turns each ASCII map into buildings, storefronts, jumbotrons, subway tile and server racks, with
  streetlamp, neon and fluorescent light baked into vertex colours.
- `src/ui/` is the Windows 98 layer: taskbar HUD with the countdown clock in the tray, dialog banners, the iMac-colour
  hero picker, the Blue Screen of Death, and "It's now safe to turn off your computer."
- `src/audio/` has the synthesised effects, a 56k dial-up handshake, and a chiptune player (pulse, triangle, noise).

## Layout

- `src/data/`   levels (50-level wave design, level n = 11:(09+n) PM, bosses, Endless), maps (one arena per district),
  heroes, upgrades, achievements (trophies, extras, cheats)
- `src/game/`   `game.js` (modes, flow, rendering each frame) and `sim.js` (rides, weapons, flow-field zombie AI, waves)
- `src/core/`   palette, pixel font (Press Start 2P and Silkscreen, thresholded to hard pixels), input, storage

## Controls

**Keyboard and mouse:** WASD move, arrows or Q/E turn, mouse look up/down/around (click to lock); headshots do double
damage, legs 60%, click fire, Space and Shift for ride tricks, R or right-click for the hero's special once its meter
is full, P or Esc pause, M mute.

**Gamepad:** left stick moves, right stick aims, RT (or X) fires, A jumps, B or LB for the ride trick, Y or RB for the
special, Start pauses. In menus the d-pad or left stick moves, A selects, B goes back, X switches between the
campaign and Endless on the hero select screen, and Y changes the number of CPU teammates.

**Hero select:** C (or the CPU button) cycles 0 to 3 CPU teammates; they play the next heroes along from yours.

**Touch:** left thumb moves, right thumb looks, with on-screen fire, jump and boost buttons.
