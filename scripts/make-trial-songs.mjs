// Generates the 10 trial songs: simple instrumental versions of traditional,
// public-domain tunes, so a full practice round works before real songs exist.
//
//   node scripts/make-trial-songs.mjs <out-dir>
//
// Writes trial-01.wav … trial-10.wav and prints each song's stop time (the
// moment the second line starts). Convert to mp3 for the site with:
//   for f in <out-dir>/*.wav; do ffmpeg -y -loglevel error -i "$f" -ac 1 -b:a 96k "public/songs/$(basename "${f%.wav}").mp3"; done
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] ?? 'trial-wav';
mkdirSync(out, { recursive: true });

const RATE = 22050;
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midi = n => {
  const m = n.match(/^([A-G])(#?)(\d)$/);
  return 12 * (Number(m[3]) + 1) + NOTE[m[1]] + (m[2] ? 1 : 0);
};
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
const parse = line => line.trim().split(/\s+/).map(t => {
  const [n, d] = t.split(':');
  return { m: midi(n), d: d ? Number(d) : 1 };
});

// Each song: tempo (beats per minute for one unit), units per click, and its lines.
// The answer is always line 2; the clip stops right before it.
export const SONGS = [
  { title: 'Twinkle, Twinkle, Little Star', bpm: 100, beat: 1, lines: ['C4 C4 G4 G4 A4 A4 G4:2', 'F4 F4 E4 E4 D4 D4 C4:2', 'G4 G4 F4 F4 E4 E4 D4:2', 'G4 G4 F4 F4 E4 E4 D4:2'] },
  { title: 'Jingle Bells', bpm: 140, beat: 1, lines: ['E4 E4 E4:2 E4 E4 E4:2', 'E4 G4 C4:1.5 D4:0.5 E4:4', 'F4 F4 F4:1.5 F4:0.5 F4 E4 E4 E4:0.5 E4:0.5', 'E4 D4 D4 E4 D4:2 G4:2'] },
  { title: 'Mary Had a Little Lamb', bpm: 110, beat: 1, lines: ['E4 D4 C4 D4 E4 E4 E4:2', 'D4 D4 D4:2 E4 G4 G4:2', 'E4 D4 C4 D4 E4 E4 E4 E4', 'D4 D4 E4 D4 C4:4'] },
  { title: 'Old MacDonald Had a Farm', bpm: 120, beat: 1, lines: ['G4 G4 G4 D4 E4 E4 D4:2', 'B4 B4 A4 A4 G4:3', 'D4 G4 G4 G4 D4 E4 E4 D4:2', 'B4 B4 A4 A4 G4:3'] },
  { title: 'Row, Row, Row Your Boat', bpm: 330, beat: 3, lines: ['C4:3 C4:3 C4:2 D4:1 E4:3', 'E4:2 D4:1 E4:2 F4:1 G4:6', 'C5 C5 C5 G4 G4 G4 E4 E4 E4 C4 C4 C4', 'G4:2 F4:1 E4:2 D4:1 C4:6'] },
  { title: 'London Bridge Is Falling Down', bpm: 110, beat: 1, lines: ['G4:1.5 A4:0.5 G4 F4 E4 F4 G4:2', 'D4 E4 F4:2 E4 F4 G4:2', 'G4:1.5 A4:0.5 G4 F4 E4 F4 G4:2', 'D4:2 G4:2 E4 C4:3'] },
  { title: 'Are You Sleeping (Frère Jacques)', bpm: 110, beat: 1, lines: ['C4 D4 E4 C4 C4 D4 E4 C4', 'E4 F4 G4:2 E4 F4 G4:2', 'G4:0.5 A4:0.5 G4:0.5 F4:0.5 E4 C4 G4:0.5 A4:0.5 G4:0.5 F4:0.5 E4 C4', 'C4 G3 C4:2 C4 G3 C4:2'] },
  { title: 'Yankee Doodle', bpm: 120, beat: 1, lines: ['C4:0.5 C4:0.5 D4:0.5 E4:0.5 C4:0.5 E4:0.5 D4:0.5', 'G3:0.5 C4:0.5 C4:0.5 D4:0.5 E4:0.5 C4 B3', 'C4:0.5 C4:0.5 D4:0.5 E4:0.5 F4:0.5 E4:0.5 D4:0.5 C4:0.5', 'B3:0.5 G3:0.5 A3:0.5 B3:0.5 C4 C4'] },
  { title: 'Hot Cross Buns', bpm: 110, beat: 1, lines: ['E4 D4 C4:2 E4 D4 C4:2', 'C4:0.5 C4:0.5 C4:0.5 C4:0.5 D4:0.5 D4:0.5 D4:0.5 D4:0.5', 'E4 D4 C4:2', 'E4 D4 C4:2 E4 D4 C4:2', 'C4:0.5 C4:0.5 C4:0.5 C4:0.5 D4:0.5 D4:0.5 D4:0.5 D4:0.5', 'E4 D4 C4:2'] },
  { title: 'Auld Lang Syne', bpm: 90, beat: 1, lines: ['C4 F4:1.5 F4:0.5 F4 A4 G4:1.5 F4:0.5 G4', 'A4 F4:1.5 F4:0.5 A4 C5 D5:3', 'D5 C5:1.5 A4:0.5 A4 F4 G4:1.5 F4:0.5 G4', 'A4 F4:1.5 D4:0.5 D4 C4 F4:3'] },
];

function render(song) {
  const unit = 60 / song.bpm;
  const lead = 0.5; // two soft count-in clicks first
  const lines = song.lines.map(parse);
  const total = lines.flat().reduce((s, n) => s + n.d, 0);
  const seconds = lead + total * unit + 1.2;
  const buf = new Float32Array(Math.ceil(seconds * RATE));
  const add = (i, v) => { if (i >= 0 && i < buf.length) buf[i] += v; };

  // count-in clicks
  for (let k = 0; k < 2; k++) {
    const at = Math.floor((lead - (2 - k) * 0.22) * RATE);
    for (let i = 0; i < 0.03 * RATE; i++) add(at + i, Math.sin(2 * Math.PI * 1800 * i / RATE) * 0.15 * (1 - i / (0.03 * RATE)));
  }

  let t = lead;
  let line2 = 0;
  lines.forEach((notes, li) => {
    if (li === 1) line2 = t;
    for (const n of notes) {
      const dur = n.d * unit;
      const start = Math.floor(t * RATE);
      const len = Math.floor(dur * RATE);
      const f = hz(n.m);
      for (let i = 0; i < len + 0.08 * RATE; i++) {
        const s = i / RATE;
        const env = Math.min(1, s / 0.01) * (i < len ? 0.65 + 0.35 * Math.exp(-s * 5) : Math.exp(-(s - dur) * 40));
        const vib = 1 + 0.003 * Math.sin(2 * Math.PI * 5.5 * s);
        const ph = 2 * Math.PI * f * vib * s;
        const tri = (2 / Math.PI) * Math.asin(Math.sin(ph));
        const sq = Math.sign(Math.sin(ph)) * 0.18;
        const low = Math.sin(ph / 2) * 0.35;
        add(start + i, (tri * 0.55 + sq + low) * env * 0.42);
      }
      t += dur;
    }
  });

  // soft kick on each click beat
  const beatSec = unit * song.beat;
  for (let bt = lead; bt < t; bt += beatSec) {
    const at = Math.floor(bt * RATE);
    for (let i = 0; i < 0.09 * RATE; i++) {
      const s = i / RATE;
      add(at + i, Math.sin(2 * Math.PI * (110 - s * 500) * s) * 0.35 * Math.exp(-s * 35));
    }
  }

  // normalise and fade out
  let peak = 0;
  for (const v of buf) peak = Math.max(peak, Math.abs(v));
  const pcm = new Int16Array(buf.length);
  for (let i = 0; i < buf.length; i++) {
    const fade = Math.min(1, (buf.length - i) / (0.6 * RATE));
    pcm[i] = Math.round((buf[i] / peak) * 0.9 * fade * 32767);
  }
  return { pcm, stop: Math.max(0.5, line2 - 0.03), length: seconds };
}

function wav(pcm) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length * 2, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length * 2, 40);
  return Buffer.concat([h, Buffer.from(pcm.buffer)]);
}

const summary = SONGS.map((s, i) => {
  const r = render(s);
  const name = `trial-${String(i + 1).padStart(2, '0')}`;
  writeFileSync(join(out, `${name}.wav`), wav(r.pcm));
  return { round: i + 1, title: s.title, file: `/songs/${name}.mp3`, stop: Math.round(r.stop * 100) / 100, length: Math.round(r.length * 10) / 10 };
});
console.log(JSON.stringify(summary, null, 1));
