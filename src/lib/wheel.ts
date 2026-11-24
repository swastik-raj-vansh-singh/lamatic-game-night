export type Segment = {
  kind: 'gift' | 'miss';
  num?: number;
  prize?: string;
  fill: string;
  text: string;
};

/** Order matters: the database picks an index from 0 to 4. */
export const SEGMENTS: Segment[] = [
  { kind: 'gift', num: 1, prize: 'Swiggy voucher', fill: '--bulb', text: '--on-bulb' },
  { kind: 'miss', fill: '--panel-2', text: '--muted' },
  { kind: 'gift', num: 2, prize: 'Amazon voucher', fill: '--teal', text: '--on-teal' },
  { kind: 'gift', num: 3, prize: 'Zomato voucher', fill: '--coral', text: '--on-bulb' },
  { kind: 'miss', fill: '--stage-raise', text: '--muted' },
];

export const SLICE = 360 / SEGMENTS.length;

export const norm360 = (d: number) => ((d % 360) + 360) % 360;

/** Rotation (deg, clockwise) that puts the pointer at fraction f of slice i. */
export const restingRotation = (i: number, f = 0.5) => norm360(360 - (i + f) * SLICE);

export const sliceAt = (rotation: number) =>
  Math.floor(norm360(360 - norm360(rotation)) / SLICE) % SEGMENTS.length;

/** Same landing spot on every screen: derived from the spin's timestamp. */
export function landingFraction(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return 0.2 + ((h >>> 0) % 1000) / 1000 * 0.6;
}

/** How many spins the winner gets: the first is always a miss, the second wins. */
export const MAX_SPINS = 2;

export function segmentLabel(i: number): string {
  const s = SEGMENTS[i];
  if (!s) return '';
  return s.kind === 'gift' ? `Gift ${s.num} · ${s.prize}` : 'Better luck next time';
}
