import type { Song } from './types';

/**
 * Ten traditional, public-domain songs with generated instrumental clips in
 * public/songs/trial-*.mp3, so a full practice game works before the real
 * songs are added. Each clip stops right before the second line.
 */
export const TRIAL_SONGS: Song[] = [
  { round: 1, title: "Twinkle, Twinkle, Little Star", artist: 'Traditional', source: '/songs/trial-01.mp3', start: 0, stop: 5.27, line: "How I wonder what you are" },
  { round: 2, title: "Jingle Bells", artist: 'Traditional', source: '/songs/trial-02.mp3', start: 0, stop: 3.9, line: "Jingle all the way" },
  { round: 3, title: "Mary Had a Little Lamb", artist: 'Traditional', source: '/songs/trial-03.mp3', start: 0, stop: 4.83, line: "Little lamb, little lamb" },
  { round: 4, title: "Old MacDonald Had a Farm", artist: 'Traditional', source: '/songs/trial-04.mp3', start: 0, stop: 4.47, line: "E-I-E-I-O" },
  { round: 5, title: "Row, Row, Row Your Boat", artist: 'Traditional', source: '/songs/trial-05.mp3', start: 0, stop: 2.65, line: "Gently down the stream" },
  { round: 6, title: "London Bridge Is Falling Down", artist: 'Traditional', source: '/songs/trial-06.mp3', start: 0, stop: 4.83, line: "Falling down, falling down" },
  { round: 7, title: "Are You Sleeping (Frère Jacques)", artist: 'Traditional', source: '/songs/trial-07.mp3', start: 0, stop: 4.83, line: "Brother John, Brother John" },
  { round: 8, title: "Yankee Doodle", artist: 'Traditional', source: '/songs/trial-08.mp3', start: 0, stop: 2.22, line: "A-riding on a pony" },
  { round: 9, title: "Hot Cross Buns", artist: 'Traditional', source: '/songs/trial-09.mp3', start: 0, stop: 4.83, line: "One a penny, two a penny" },
  { round: 10, title: "Auld Lang Syne", artist: 'Traditional', source: '/songs/trial-10.mp3', start: 0, stop: 5.8, line: "And never brought to mind" },
];

/**
 * The game night song list, with the clip timing the host picked. Each link is
 * the official upload, checked to play inside the site. The correct line is
 * typed by the host in Answer sheet → Songs.
 */
export const GAME_NIGHT_SONGS: Song[] = [
  { round: 1, title: 'Die With A Smile', artist: 'Lady Gaga, Bruno Mars', source: 'https://www.youtube.com/watch?v=kPa7bsKwL-c', start: 30, stop: 44, line: '' },
  { round: 2, title: 'Tumhi Ho Bandhu', artist: 'Neeraj Shridhar, Kavita Seth · Cocktail', source: 'https://www.youtube.com/watch?v=o1RducJbUdc', start: 47, stop: 61, line: '' },
  { round: 3, title: 'Dilliwaali Girlfriend', artist: 'Arijit Singh, Sunidhi Chauhan · Yeh Jawaani Hai Deewani', source: 'https://www.youtube.com/watch?v=frIxzllegWg', start: 7, stop: 15, line: '' },
  { round: 4, title: 'Beauty And A Beat', artist: 'Justin Bieber ft. Nicki Minaj', source: 'https://www.youtube.com/watch?v=Ys7-6_t7OEQ', start: 43, stop: 50, line: '' },
  { round: 5, title: 'Closer', artist: 'The Chainsmokers ft. Halsey', source: 'https://www.youtube.com/watch?v=0zGcUoRlhmw', start: 36, stop: 50, line: '' },
  { round: 6, title: 'Shape of You', artist: 'Ed Sheeran', source: 'https://www.youtube.com/watch?v=JGwWNGJdvx8', start: 46, stop: 56, line: '' },
  { round: 7, title: 'Perfect', artist: 'Ed Sheeran', source: 'https://www.youtube.com/watch?v=2Vv-BfVoq4g', start: 47, stop: 66, line: '' },
  { round: 8, title: 'Love Story', artist: 'Taylor Swift', source: 'https://www.youtube.com/watch?v=8xg3vE8Ie_E', start: 48, stop: 64, line: '' },
  { round: 9, title: 'Badtameez Dil', artist: 'Benny Dayal · Yeh Jawaani Hai Deewani', source: 'https://www.youtube.com/watch?v=II2EO3Nw4m0', start: 58, stop: 67, line: '' },
  { round: 10, title: 'Swalla', artist: 'Jason Derulo ft. Nicki Minaj, Ty Dolla $ign', source: 'https://www.youtube.com/watch?v=NGLxoKOvzu4', start: 38, stop: 48, line: '' },
  { round: 11, title: 'Baby', artist: 'Justin Bieber ft. Ludacris', source: 'https://www.youtube.com/watch?v=kffacxfA7G4', start: 0, stop: 14, line: '' },
];

/** Titles from the sample lists shipped earlier (practice songs and the first hits list). */
const SAMPLE_TITLES = new Set([
  ...TRIAL_SONGS.map(s => s.title),
  'Shape of You', 'Kesariya', 'Believer', 'Tum Hi Ho', 'See You Again', 'Badtameez Dil',
  'Someone Like You', 'Kal Ho Naa Ho', 'Bohemian Rhapsody', 'Kala Chashma',
]);
const GAME_NIGHT_ONLY = new Set([...GAME_NIGHT_SONGS.map(s => s.title), 'Beauty and the Beast'].filter(t => !SAMPLE_TITLES.has(t)));

/**
 * True when the saved list is still one of the untouched sample lists, so the
 * answer sheet can switch to the game night songs without losing any work.
 */
export function isUntouchedSampleList(list: Song[]): boolean {
  if (!list.length) return true;
  if (list.some(s => GAME_NIGHT_ONLY.has(s.title))) return false;
  return list.every(s => {
    if (/^Song \d+ title$/.test(s.title)) return true;
    if (!SAMPLE_TITLES.has(s.title)) return false;
    const trial = TRIAL_SONGS.find(t => t.title === s.title);
    if (trial) return s.source === trial.source && s.line === trial.line;
    return !s.line.trim();
  });
}

/** Bump when the host asks for timing changes to songs already saved. */
export const SONG_LIST_VERSION = 2;

const yt = (id: string) => `https://www.youtube.com/watch?v=${id}`;
const UPDATES: Record<number, Array<{ source: string; patch: Partial<Song> }>> = {
  2: [
    { source: yt('JGwWNGJdvx8'), patch: { start: 46, stop: 56 } },
    { source: yt('II2EO3Nw4m0'), patch: { start: 58, stop: 67 } },
    { source: yt('NGLxoKOvzu4'), patch: { start: 38, stop: 48 } },
    { source: yt('o1RducJbUdc'), patch: { start: 47, stop: 61 } },
    { source: yt('frIxzllegWg'), patch: { start: 7, stop: 15 } },
    {
      source: yt('axySrE0Kg6k'),
      patch: { title: 'Beauty And A Beat', artist: 'Justin Bieber ft. Nicki Minaj', source: yt('Ys7-6_t7OEQ'), start: 43, stop: 50, line: '' },
    },
  ],
};

/** Applies the host's requested changes once to a saved list. Typed lines are kept. */
export function upgradeSongList(list: Song[], fromVersion: number): { list: Song[]; changed: boolean } {
  let changed = false;
  let out = list;
  for (let v = fromVersion + 1; v <= SONG_LIST_VERSION; v++) {
    for (const u of UPDATES[v] ?? []) {
      out = out.map(s => {
        if (s.source.trim() !== u.source) return s;
        changed = true;
        return { ...s, ...u.patch };
      });
    }
  }
  return { list: out, changed };
}
