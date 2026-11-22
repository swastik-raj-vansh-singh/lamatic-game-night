// Generates public/songs/demo-tune.wav: an original 20-second chiptune loop
// used by the placeholder rounds, so Play / Stop can be tested before real songs exist.
import { writeFileSync, mkdirSync } from 'node:fs';

const rate = 16000;
const seconds = 20;
const n = rate * seconds;
const data = new Int16Array(n);
const bpm = 120;
const beat = 60 / bpm;
const midi = m => 440 * Math.pow(2, (m - 69) / 12);
// Simple I–V–vi–IV arpeggios in C major.
const chords = [[60, 64, 67, 72], [55, 59, 62, 67], [57, 60, 64, 69], [53, 57, 60, 65]];
for (let i = 0; i < n; i++) {
  const t = i / rate;
  const step = Math.floor(t / (beat / 2));
  const chord = chords[Math.floor(step / 8) % chords.length];
  const note = chord[step % 4] + (step % 8 >= 4 ? 12 : 0);
  const local = t % (beat / 2);
  const env = Math.exp(-local * 6);
  const lead = Math.sign(Math.sin(2 * Math.PI * midi(note) * t)) * 0.18 * env;
  const bass = Math.sin(2 * Math.PI * midi(chord[0] - 24) * t) * 0.22;
  const kick = (t % beat) < 0.06 ? Math.sin(2 * Math.PI * (120 - (t % beat) * 900) * t) * 0.5 * (1 - (t % beat) / 0.06) : 0;
  const fade = Math.min(1, t / 0.3, (seconds - t) / 0.5);
  data[i] = Math.max(-1, Math.min(1, (lead + bass + kick) * fade)) * 32767;
}
const header = Buffer.alloc(44);
header.write('RIFF', 0); header.writeUInt32LE(36 + n * 2, 4); header.write('WAVE', 8);
header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
header.write('data', 36); header.writeUInt32LE(n * 2, 40);
mkdirSync('public/songs', { recursive: true });
writeFileSync('public/songs/demo-tune.wav', Buffer.concat([header, Buffer.from(data.buffer)]));
console.log('wrote public/songs/demo-tune.wav');
