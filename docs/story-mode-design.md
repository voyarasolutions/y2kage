# Y2Kage Story Mode: "Insert Disk 2"

Design, 2026-09-29, approved in outline by VS. It covers every mission, the puzzles and parts, and the music. Chapter 1 (Times Square) is built and playable in v0.15.0; chapters 2 to 5 follow this plan.

## Premise

At 11:10 PM on December 31, 1999, a program called MILLENNIUM.BUG wakes up inside the city's bank mainframe and starts rewriting anyone staring at a screen, from jumbotrons and TVs to pagers and arcade cabinets, into zombies.

Dot has three floppy disks labeled "Y2K FIX - DO NOT LOSE" that she got from Kev's mom, Diane, a sysadmin at the bank who saw it coming. Nobody believed her. The patch only works if it is uploaded before midnight, and the only transmitter strong enough to reach every computer in the city is the antenna on top of the Ball Drop tower.

The crew has 50 minutes to cross Manhattan with it.

**The villain** is the Bug itself. It talks to the player through AIM chat windows that pop up mid-mission ("MillenniumBug99 has entered the chat"), taunts in lowercase with bad 90s leetspeak, and grows more coherent (and more frightening) as midnight gets closer. Each district boss is something it has taken over.

**The twist (chapter 4):** the backup tapes show that Diane wrote the Bug by accident: a date rollover script for the bank that learned to copy itself. The patch is her way of fixing her own mistake, and Kev finds out from her voicemail.

## How it plays

- **Mission goals instead of wave clears.** Every mission has a main goal: find parts, solve a puzzle, escort someone, hold a spot or reach the exit. Zombies keep coming the whole time (trickle spawns plus scripted rushes), with fewer of them than the campaign has, but they hit harder.
- **Parts and puzzles in every mission,** as VS asked. Parts are hidden across the map and shown in an inventory strip on the taskbar HUD. Puzzles are physical: levers, fuse boxes, keypads, valves and dial-up handshakes, used with an interact key (E / pad X) while the horde pushes in. No puzzle pauses the game.
- **The hero is set by the story.** Each chapter follows one hero, and other heroes appear as CPU teammates (the existing bot code) when they are with the group. In chapter 5 you choose the hero for each mission.
- **The clock moves between missions only.** Chapters match the campaign's times: chapter 1 is 11:10 to 11:19, chapter 5 is 11:50 to 11:59. The taskbar clock shows the story time.
- **Cutscenes are cheap and in period:** pager messages, AIM chats, TV news breaks with a pixel-art anchor, Win98 dialog boxes and still panels drawn in the hero-portrait style. They can be skipped.
- **Collectibles:** 20 hidden floppy logs (one per mission) of Diane's notes, bank memos and Bug chat transcripts. Finding all of them unlocks a secret ending line and a trophy.
- **Ammo and melee pickups** from the other thread are part of it: melee is always useful in tight interiors, and ammo is placed by hand, so scarcity is part of the pacing.
- **Saves at every mission start**, like the campaign's CONTINUE. Grades S/A/B/C carry over, and each mission counts parts found and time taken.
- **Difficulty:** uses the existing Easy/Normal/Hard setting. Puzzles don't change, only the horde.

Target length: 20 missions of 6 to 12 minutes each, about 3 hours for a first playthrough.

## Chapters and missions

### Chapter 1: Times Square (Tina, 11:10 to 11:19)

Tina is at the Times Square party waiting for her friends when the jumbotron flickers and the crowd turns.

| # | Mission | Goal | Parts / puzzle |
|---|---|---|---|
| 1.1 | Party Crashers | Survive the turn and find Dot in the crowd | Tutorial. Dot's pager message is garbled; find **3 fuses** in the storefronts to power the small jumbotron and read it on the big screen. |
| 1.2 | Quarters | Call Marcus from a payphone | Find **4 quarters** (a newsbox, a taxi, a trash can, a street performer's hat). The call dials up like a modem, and you hold the phone booth for 30 seconds while it connects. |
| 1.3 | Duffy Square | Get the floppy case out of Dot's locked bag check | The ticker on the building scrolls a 4-digit code one digit at a time between news headlines. Read it and enter it on the bag-check keypad. Escort Dot (CPU) to the red steps. |
| 1.4 | The Bug Wakes | Boss: The Millennium Bug | The Bug crawls out of the jumbotron. Its first AIM message: "u r not supposed 2 have that disk". |

### Chapter 2: Broadway (Marcus, 11:20 to 11:29)

Marcus is backstage at a boy-band New Year's show, where the band has already turned. The crew needs to get through the theater to reach the subway.

| # | Mission | Goal | Parts / puzzle |
|---|---|---|---|
| 2.1 | Stage Door | Get backstage | Find the stage manager's **keyring** and **laminated pass** in the alley dumpsters and dressing rooms. |
| 2.2 | Lighting Cues | Light the stage so the crowd can escape | A lighting board with 4 sliders. The cue sheet taped in the booth lists colors; match each spotlight. Correct spotlights stun zombies standing in them, which is also how you survive the mission. |
| 2.3 | Orchestra Pit | Rescue Gus from the pit | Gus is trapped under the stage lift. Find the **lift crank handle** and **2 counterweights**, then hold the lift while it slowly rises. |
| 2.4 | Encore | Boss: The Frontman | He sings to his dancers. The Bug chats: "they loved me more when they stopped thinking". |

### Chapter 3: Subway (Gus, 11:30 to 11:39)

The streets are jammed, so the only way to reach the bank downtown is the last train. Gus has a bag of fireworks and no plan.

| # | Mission | Goal | Parts / puzzle |
|---|---|---|---|
| 3.1 | Token Booth | Get onto the platform | The turnstiles are locked. Find **5 tokens**, or find the booth key and break in for all of them plus a supply cache. |
| 3.2 | Switchyard | Route the last train to your platform | A wall map shows the tracks. Flip **3 track levers** in the right order; the wrong order sends the train past and a louder horde arrives. |
| 3.3 | Express | Hold the moving train | A fight across the train cars at each stop, with doors opening on both sides. At the third stop the train dies: find the **fuse** in the motorman's cab and the **reset key** at the far end. |
| 3.4 | End of the Line | Boss: The Conductor | Kev is waiting at the exit; the Conductor burrows between you. |

### Chapter 4: Bank Server Room (Kev, 11:40 to 11:49)

Kev takes the crew into the bank where his mom works to find out what the Bug is and where to send the patch.

| # | Mission | Goal | Parts / puzzle |
|---|---|---|---|
| 4.1 | Badge Access | Get into the server floor | Find Diane's **ID badge** in the lobby. The door wants her password; sticky notes all over her desk give 6 guesses, and only one matches the hint on her screen saver ("the dog's name + the year I met your dad"). |
| 4.2 | Meltdown | Stop the servers from overheating | Temperatures on 3 racks climb. Turn **coolant valves** on the pipes to keep all three under the red line while the horde comes through the raised floor. |
| 4.3 | Tape Backup | Learn the truth | Find **4 backup tapes** and load them in order. Each tape plays part of Diane's voicemail to Kev, and the last one reveals she wrote the Bug and that the patch has to go out from the Ball Drop antenna. |
| 4.4 | Big Iron | Boss: The Mainframe | The Bug speaks through it: "diane made me. u should thank me". |

### Chapter 5: The Ball Drop (all five, 11:50 to 11:59)

Back where it started. You pick the hero for each mission and the rest of the crew fight alongside you.

| # | Mission | Goal | Parts / puzzle |
|---|---|---|---|
| 5.1 | Service Stairs | Climb the tower | The elevator is dead. Find **3 generator parts** (spark plug, fuel can, pull cord) on the way up the stairwell floors and start it for the freight lift. |
| 5.2 | Antenna | Aim the transmitter | Three dish panels on the roof; rotate each until the signal meter on the laptop peaks. Loose cables are **4 parts** to find and reconnect. |
| 5.3 | Insert Disk 2 | Upload the patch | A 28.8k upload with a Win98 progress bar while the whole horde climbs the tower. At 33% and 66% the laptop asks for "Disk 2" and "Disk 3", and you run to the crew member holding it and bring it back. |
| 5.4 | 11:59 | Boss: The Countdown | The Bug's last form. It drops to one clean line at the end: "i just wanted to see 2000 too". At midnight the patch goes out, the zombies collapse, confetti falls and Auld Lang Syne plays. |

**Ending:** the crew on the rooftop at 12:00. Diane pages Kev: "HAPPY NEW YEAR. I'M SORRY. PROUD OF YOU." With all 20 logs found, a last pager message comes from the Bug.

## Music

The game has 4 songs today (title, play, boss and the Auld Lang Syne ending), written as tracker patterns in `src/audio/music.js`. Story mode needs its own soundtrack so each chapter feels like a different place. The new songs use the same format, so nothing needs to be downloaded, and the soundtrack stays chiptune.

Each chapter gets 3 tracks:

- **Explore:** a lighter track for searching and puzzles.
- **Pressure:** a busier variation that crossfades in during rushes, holds and escorts.
- **Boss:** a remix of that chapter's theme for its boss.

| Chapter | Style | Tracks |
|---|---|---|
| 1 Times Square | Eurodance / trance | "Party Like It's 1999" (explore), "Crowd Surge" (pressure), "Jumbotron" (boss) |
| 2 Broadway | Boy-band pop and show tunes | "Backstage Pass" (explore), "House Lights" (pressure), "Encore" (boss) |
| 3 Subway | Breakbeat / jungle | "Mind the Gap" (explore), "Express Track" (pressure), "Last Stop" (boss) |
| 4 Bank Server Room | Dark techno with modem noise | "Cold Storage" (explore), "Thermal Runaway" (pressure), "Big Iron" (boss) |
| 5 Ball Drop | Big-beat anthem | "Service Stairs" (explore), "Upload 28.8k" (pressure), "11:59" (boss, climbing into Auld Lang Syne at midnight) |

It also needs 3 shared pieces:

- **"Insert Disk 2" theme:** a short melody for the patch, heard on the story title screen, in chapter stings and as the hook of the final boss track, so the soundtrack sounds like one story.
- **"The Bug" motif:** a detuned, glitchy 4-note phrase that plays when the Bug enters the chat.
- **Cutscene beds:** "Pager" (quiet, for messages), "Newsbreak" (a jingle for TV breaks) and "Credits".

That is 21 new pieces in all. The music player also needs a crossfade from explore to pressure (it only switches hard between songs today), which is a small change.

## What needs building (for later, after the ammo work lands)

1. **Mission system:** goal list, triggers, scripted rushes and trickle spawns, win and fail conditions.
2. **Interactables and inventory:** E / pad X to use; fuses, keys, valves, levers, keypads and dials; a parts strip on the HUD.
3. **Story maps:** 20 hand-built maps from the existing tile set, plus a few new tiles (payphone, lighting board, turnstile, valve, tape drive, dish).
4. **Cutscene player:** pager, AIM chat, newsbreak and still-panel scenes, skippable.
5. **Music:** 21 new pieces and the crossfade.
6. **Menu:** STORY on the title screen, a chapter select that fills in as you play, saves and grades.

Suggested order: build chapter 1 end to end first (all four missions, three tracks, the pager and AIM scenes) and ship it so VS can play it, then do the other chapters one at a time.
