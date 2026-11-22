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
 * Five English and five Hindi hits, linked to their official YouTube videos.
 * The clip timing and the correct line are left for the host: open the Songs
 * tab, use "Set timing" to mark where the clip stops, and type the line.
 */
export const FAMOUS_SONGS: Song[] = [
  { round: 1, title: 'Shape of You', artist: 'Ed Sheeran', source: 'https://www.youtube.com/watch?v=JGwWNGJdvx8', start: 0, stop: 0, line: '' },
  { round: 2, title: 'Kesariya', artist: 'Arijit Singh · Brahmāstra', source: 'https://www.youtube.com/watch?v=BddP6PYo2gs', start: 0, stop: 0, line: '' },
  { round: 3, title: 'Believer', artist: 'Imagine Dragons', source: 'https://www.youtube.com/watch?v=7wtfhZwyrcc', start: 0, stop: 0, line: '' },
  { round: 4, title: 'Tum Hi Ho', artist: 'Arijit Singh · Aashiqui 2', source: 'https://www.youtube.com/watch?v=IJq0yyWug1k', start: 0, stop: 0, line: '' },
  { round: 5, title: 'See You Again', artist: 'Wiz Khalifa ft. Charlie Puth', source: 'https://www.youtube.com/watch?v=RgKAFK5djSk', start: 0, stop: 0, line: '' },
  { round: 6, title: 'Badtameez Dil', artist: 'Benny Dayal · Yeh Jawaani Hai Deewani', source: 'https://www.youtube.com/watch?v=II2EO3Nw4m0', start: 0, stop: 0, line: '' },
  { round: 7, title: 'Someone Like You', artist: 'Adele', source: 'https://www.youtube.com/watch?v=hLQl3WQQoQ0', start: 0, stop: 0, line: '' },
  { round: 8, title: 'Kal Ho Naa Ho', artist: 'Sonu Nigam · Kal Ho Naa Ho', source: 'https://www.youtube.com/watch?v=g0eO74UmRBs', start: 0, stop: 0, line: '' },
  { round: 9, title: 'Bohemian Rhapsody', artist: 'Queen', source: 'https://www.youtube.com/watch?v=fJ9rUzIMcZQ', start: 0, stop: 0, line: '' },
  { round: 10, title: 'Kala Chashma', artist: 'Badshah, Neha Kakkar · Baar Baar Dekho', source: 'https://www.youtube.com/watch?v=4WRJHbL4dAk', start: 0, stop: 0, line: '' },
];
