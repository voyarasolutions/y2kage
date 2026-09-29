// Story mode, "Insert Disk 2": five chapters across the five districts, four missions each.
// Pure data. A mission is a list of steps the Mission runner (game/mission.js) plays in order,
// with the horde trickling in the whole time. Coordinates are map cells (x, y) on the district map.
//
// Scene lines (cutscenes between missions and chat pop-ups during them):
//   { k: 'card', title, sub }           chapter title card
//   { k: 'news', text }                 NEWS 4 LIVE break on a TV
//   { k: 'pager', text }                a pager message (caps, pager spelling)
//   { k: 'aim', from, text }            an AIM chat window; the Bug talks this way
//   { k: 'say', who, text }             a hero (tina, marcus, dot, gus, kev) with their portrait
//
// Step types:
//   kill    { n }                        drop n zombies
//   collect { item, at: [[x, y]...] }    walk over every item
//   use     { at: [[x, y]...], hold }    hold USE (E) at each station for `hold` seconds
//                                        (`prop: [x, y, rot]` stands a street prop there, like the payphone)
//   hold    { at: [x, y], r, time }      stay in the zone; the clock only runs while someone is in it
//   code    { at: [x, y] }               read the code off the news ticker, enter it on the keypad
//   reach   { at: [x, y], r, all }       get there (with the whole crew if `all`)
//   survive { time }                     last that long
//   boss    { at: [x, y] }               the district boss crawls out there
// Any step can carry: text (objective line), say (chat lines when it starts), rush (zombies
// that pour in when it starts), mid (chat lines at a fraction of a hold: [[0.5, line]...]),
// join (a hero who joins the crew as a CPU teammate when the step is done), npc (a hero waiting
// at a spot until then: { id, at }), ticker (headlines for the news ticker, with the code digits).

export const ITEMS = {
  fuse: { name: 'FUSE', tip: 'A 30 amp cartridge fuse' },
  quarter: { name: 'QUARTER', tip: '25 cents toward a phone call' },
  bag: { name: "DOT'S BAG", tip: 'Three floppies inside. Y2K FIX. DO NOT LOSE.' },
};

// What a USE station looks like in the world.
export const STATIONS = {
  fusebox: { name: 'FUSE BOX', col: '#f6c945' },
  payphone: { name: 'PAYPHONE', col: '#3de0e0', decor: 'payphone' },
  keypad: { name: 'BAG CHECK', col: '#ff8a2a' },
  junction: { name: 'JUNCTION BOX', col: '#ff3b3b' },
};

export const CHAPTERS = [
  {
    n: 1,
    title: 'Times Square',
    hero: 'tina',
    district: 0,
    blurb: "Tina's party goes wrong.",
    // explore / pressure / boss tracks (music.js)
    music: ['c1Explore', 'c1Pressure', 'c1Boss'],
    missions: [
      {
        id: '1-1',
        name: 'Party Crashers',
        minute: 10,
        stage: 1,
        crew: ['tina'],
        trickle: { every: 2.2, max: 9 },
        intro: [
          { k: 'card', title: 'CHAPTER 1', sub: 'TIMES SQUARE  11:10 PM' },
          { k: 'news', text: 'NEWS 4 LIVE: A million people in Times Square tonight, and every screen in the city counting down with them.' },
          { k: 'say', who: 'tina', text: "Dot said meet under the big screen at eleven. She's never late. She's never NOT early." },
          { k: 'pager', text: '911 911 DONT LOOK AT THE SCREENS -DOT' },
          { k: 'say', who: 'tina', text: '...What?' },
          { k: 'news', text: 'N3WS 4 L1V3: STAY TUNED. STAY TUNED. STAY TUNED. STAY TUNED.' },
          { k: 'say', who: 'tina', text: 'Okay. That guy just bit that other guy.' },
        ],
        steps: [
          { type: 'kill', n: 10, rush: 6, text: 'The crowd turned. Hose them down!' },
          {
            type: 'collect', item: 'fuse', at: [[3.5, 1.5], [26.5, 12.5], [1.5, 17.5]],
            text: 'Find 3 fuses by the storefronts',
            say: [{ k: 'pager', text: 'BIG SCREEN FUSES BLEW. SPARES IN THE SHOPS. PUT EM IN, READ THE SCREEN -DOT' }],
          },
          { type: 'use', station: 'fusebox', at: [[12.5, 1.5]], hold: 2.5, text: 'Fix the fuse box under the jumbotron', rush: 5 },
          {
            type: 'reach', at: [14.5, 15.5], r: 1.4,
            text: 'Find Dot behind the police barricade',
            say: [{ k: 'aim', from: 'JUMBOTRON', text: 'TINA. BEHIND THE POLICE BARRICADE. BRING THE SOAKER. -D' }],
            npc: { id: 'dot', at: [14.5, 15.8] },
            join: 'dot',
          },
          {
            type: 'survive', time: 25, rush: 8,
            text: 'Hold the square with Dot',
            say: [{ k: 'say', who: 'dot', text: 'You came! Okay. Shoot first, I explain second.' }],
          },
        ],
        outro: [
          { k: 'say', who: 'dot', text: "Kev's mom Diane works at the bank. She saw this coming. Nobody believed her." },
          { k: 'say', who: 'dot', text: 'She gave me a patch. Three floppies. Y2K FIX, DO NOT LOSE.' },
          { k: 'say', who: 'tina', text: 'Where are they?' },
          { k: 'say', who: 'dot', text: 'In my bag. Which I checked. At the bag check. In Duffy Square.' },
          { k: 'say', who: 'tina', text: 'You checked the cure for the apocalypse.' },
          { k: 'say', who: 'dot', text: 'It was HEAVY. And first we need Marcus.' },
        ],
      },
      {
        id: '1-2',
        name: 'Quarters',
        minute: 12,
        stage: 2,
        start: [35.5, 9.5],
        crew: ['tina', 'dot'],
        trickle: { every: 1.9, max: 11 },
        intro: [
          { k: 'say', who: 'dot', text: "Marcus is backstage at the boy band show. His pager's off, so we call the theater." },
          { k: 'say', who: 'tina', text: 'With what?' },
          { k: 'news', text: 'NEWS 4: Cell networks are jammed across Midtown. Officials urge callers to use a landline.' },
          { k: 'say', who: 'dot', text: 'Payphone on 7th Avenue. Thirty-five cents.' },
          { k: 'say', who: 'tina', text: 'I have a Super Soaker and a Discman.' },
        ],
        steps: [
          {
            type: 'collect', item: 'quarter', at: [[33.5, 16.5], [32.5, 3.5], [20.5, 6.5], [40.5, 11.5]],
            text: 'Find 4 quarters',
            say: [{ k: 'say', who: 'dot', text: 'Check the taxis, the newsboxes, the trash. People drop change when they run.' }],
          },
          { type: 'use', station: 'payphone', at: [[42.3, 9.5]], prop: [42.74, 9.5, -Math.PI / 2], hold: 2, text: 'Call the theater from the payphone' },
          {
            type: 'hold', at: [41.5, 9.5], r: 2.6, time: 30, rush: 10,
            text: 'Stay on the line while it connects',
            say: [{ k: 'aim', from: 'PAYPHONE', text: 'Ring... ring... ring...' }],
            mid: [
              [0.3, { k: 'say', who: 'marcus', text: 'Stage door. Who is this?' }],
              [0.6, { k: 'say', who: 'marcus', text: "Tina?! The band just ATE the band! There's backup dancers in the rafters!" }],
              [0.9, { k: 'say', who: 'marcus', text: "Duffy Square. Red steps. I'm coming." }],
            ],
          },
        ],
        outro: [
          { k: 'say', who: 'tina', text: 'Marcus is on his way to the red steps.' },
          { k: 'say', who: 'dot', text: "Then so are we. That's where my bag is." },
        ],
      },
      {
        id: '1-3',
        name: 'Duffy Square',
        minute: 15,
        stage: 3,
        start: [21.5, 22.5],
        crew: ['tina', 'dot'],
        trickle: { every: 1.6, max: 13 },
        intro: [
          { k: 'say', who: 'dot', text: "The bag check guy's gone. The locker wants a four-digit code." },
          { k: 'say', who: 'tina', text: 'Do you know it?' },
          { k: 'say', who: 'dot', text: "He said it'd be on the zipper." },
          { k: 'say', who: 'tina', text: 'The what?' },
          { k: 'say', who: 'dot', text: 'The news ticker! Lost and found notices run on it. Watch the ticker, remember the digits.' },
        ],
        steps: [
          {
            type: 'code', station: 'keypad', at: [9.6, 24.5],
            text: 'Read the code off the ticker, enter it at bag check',
            ticker: [
              'MAYOR: "NO REASON TO PANIC"',
              'CROWD ESTIMATE PASSES ONE MILLION',
              'CON ED REPORTS "UNUSUAL" LOAD ON MIDTOWN SCREENS',
              'DICK CLARK: "WE ARE STILL ON THE AIR"',
              'VCRs ACROSS CITY FLASHING 12:00',
            ],
          },
          { type: 'collect', item: 'bag', at: [[8.5, 25.5]], text: "Grab Dot's bag", rush: 6 },
          {
            type: 'reach', at: [21.5, 29.5], r: 2, all: true,
            text: 'Get Dot to the red steps',
            say: [{ k: 'say', who: 'dot', text: 'Red steps! Marcus said the red steps!' }],
          },
          {
            type: 'hold', at: [21.5, 29.5], r: 3.2, time: 25, rush: 12,
            text: 'Hold the steps while Dot checks the disks',
            mid: [
              [0.35, { k: 'say', who: 'dot', text: 'Disk 1... okay. Disk 2...' }],
              [0.7, { k: 'say', who: 'dot', text: 'Disk 3. All here. Nobody breathe on them.' }],
            ],
          },
        ],
        outro: [
          { k: 'say', who: 'marcus', text: 'Did everybody see the jumbotron? It is LOOKING at people.' },
          { k: 'aim', from: 'MillenniumBug99', text: 'hi tina' },
          { k: 'say', who: 'tina', text: '...Dot. Why is the jumbotron typing.' },
          { k: 'aim', from: 'MillenniumBug99', text: 'u r not supposed 2 have that disk' },
        ],
      },
      {
        id: '1-4',
        name: 'The Bug Wakes',
        minute: 19,
        stage: 3,
        start: [14.5, 8.5],
        crew: ['tina', 'dot', 'marcus'],
        trickle: { every: 1.7, max: 12 },
        boss: true,
        intro: [
          { k: 'aim', from: 'MillenniumBug99', text: 'u have something of mine' },
          { k: 'aim', from: 'MillenniumBug99', text: '3 little disks :)' },
          { k: 'say', who: 'tina', text: 'Everybody stop looking at the screens!' },
          { k: 'say', who: 'dot', text: "It's living in the power. Cut the junction boxes and it has to come out." },
          { k: 'say', who: 'marcus', text: 'And then what?' },
          { k: 'say', who: 'tina', text: 'Then we hose it.' },
        ],
        steps: [
          { type: 'use', station: 'junction', at: [[1.5, 10.5], [25.5, 2.5]], hold: 2.5, text: 'Cut the power at 2 junction boxes', rush: 8 },
          {
            type: 'boss', at: [14.5, 3.5],
            text: 'Delete the Millennium Bug',
            say: [{ k: 'aim', from: 'MillenniumBug99', text: 'fine. ill come out. u wont like it' }],
          },
        ],
        outro: [
          { k: 'news', text: 'NEWS 4: Power is back in Times Square. Witnesses describe "a very, very big bug."' },
          { k: 'say', who: 'marcus', text: 'Is it gone?' },
          { k: 'say', who: 'dot', text: "That was one piece. It lives in the bank's mainframe. We have to get downtown." },
          { k: 'say', who: 'marcus', text: 'Streets are jammed. But the theater has a way down to the subway. Follow me.' },
          { k: 'card', title: 'CHAPTER 1 COMPLETE', sub: 'CHAPTER 2: BROADWAY  COMING SOON' },
        ],
      },
    ],
  },
];

export const MISSIONS = CHAPTERS.flatMap((C) => C.missions.map((M, i) => ({ ...M, chapter: C, idx: i })));
export const missionById = (id) => MISSIONS.find((M) => M.id === id);
