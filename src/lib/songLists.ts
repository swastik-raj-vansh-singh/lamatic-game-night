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
  { round: 2, title: 'Tumhi Ho Bandhu', artist: 'Neeraj Shridhar, Kavita Seth · Cocktail', source: 'https://www.youtube.com/watch?v=o1RducJbUdc', start: 50, stop: 64, line: '' },
  { round: 3, title: 'Dilliwaali Girlfriend', artist: 'Arijit Singh, Sunidhi Chauhan · Yeh Jawaani Hai Deewani', source: 'https://www.youtube.com/watch?v=frIxzllegWg', start: 13, stop: 30, line: '' },
  { round: 4, title: 'Beauty and the Beast', artist: 'Ariana Grande, John Legend', source: 'https://www.youtube.com/watch?v=axySrE0Kg6k', start: 0, stop: 14, line: '' },
  { round: 5, title: 'Closer', artist: 'The Chainsmokers ft. Halsey', source: 'https://www.youtube.com/watch?v=0zGcUoRlhmw', start: 36, stop: 50, line: '' },
  { round: 6, title: 'Shape of You', artist: 'Ed Sheeran', source: 'https://www.youtube.com/watch?v=JGwWNGJdvx8', start: 40, stop: 51, line: '' },
  { round: 7, title: 'Perfect', artist: 'Ed Sheeran', source: 'https://www.youtube.com/watch?v=2Vv-BfVoq4g', start: 47, stop: 66, line: '' },
  { round: 8, title: 'Love Story', artist: 'Taylor Swift', source: 'https://www.youtube.com/watch?v=8xg3vE8Ie_E', start: 48, stop: 64, line: '' },
  { round: 9, title: 'Badtameez Dil', artist: 'Benny Dayal · Yeh Jawaani Hai Deewani', source: 'https://www.youtube.com/watch?v=II2EO3Nw4m0', start: 26, stop: 37, line: '' },
  { round: 10, title: 'Swalla', artist: 'Jason Derulo ft. Nicki Minaj, Ty Dolla $ign', source: 'https://www.youtube.com/watch?v=NGLxoKOvzu4', start: 26, stop: 36, line: '' },
  { round: 11, title: 'Baby', artist: 'Justin Bieber ft. Ludacris', source: 'https://www.youtube.com/watch?v=kffacxfA7G4', start: 0, stop: 14, line: '' },
];
