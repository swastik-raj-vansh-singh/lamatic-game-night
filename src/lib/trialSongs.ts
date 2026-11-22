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
