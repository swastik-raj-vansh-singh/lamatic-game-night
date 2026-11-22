'use client';

import { useEffect, useState } from 'react';
import { CountUp } from './ui';

export type BoardRow = {
  id: string;
  label: string;
  avatar?: string;
  color: string;
  from: number;
  to: number;
  highlight?: boolean;
  tag?: React.ReactNode;
};

function order(rows: BoardRow[], key: 'from' | 'to') {
  return rows.slice().sort((a, b) => b[key] - a[key] || a.label.localeCompare(b.label));
}

/**
 * Menti-style board: shows the previous scores first, then slides rows into
 * their new places while bars grow and numbers count up.
 */
export function AnimatedBoard({ rows, rowHeight = 62, limit, unit = 'pts' }: { rows: BoardRow[]; rowHeight?: number; limit?: number; unit?: string }) {
  const [stage, setStage] = useState<'from' | 'to'>('from');
  useEffect(() => {
    const t = setTimeout(() => setStage('to'), 700);
    return () => clearTimeout(t);
  }, []);

  const before = order(rows, 'from');
  const after = order(rows, 'to');
  const shown = stage === 'from' ? before : after;
  const pos = new Map(shown.map((r, i) => [r.id, i]));
  const prevRank = new Map(before.map((r, i) => [r.id, i]));
  const nowRank = new Map(after.map((r, i) => [r.id, i]));
  const val = (r: BoardRow) => (stage === 'from' ? r.from : r.to);
  const max = Math.max(1, ...rows.map(val));
  const visible = Math.min(rows.length, limit ?? rows.length);

  return (
    <div className="board" style={{ height: visible * rowHeight }} role="list">
      {rows.map(r => {
        const p = pos.get(r.id) ?? 0;
        const moved = stage === 'to' ? (prevRank.get(r.id) ?? 0) - (nowRank.get(r.id) ?? 0) : 0;
        return (
          <div
            key={r.id}
            role="listitem"
            className={`board-row${r.highlight ? ' hl' : ''}`}
            style={{
              transform: `translateY(${p * rowHeight}px)`,
              height: rowHeight - 8,
              opacity: p < visible ? 1 : 0,
              ['--bar' as string]: r.color,
            }}
          >
            <span className="board-bar" style={{ width: `${(val(r) / max) * 100}%` }} />
            <span className="board-rank">{p + 1}</span>
            <span className="board-av" aria-hidden="true">
              {r.avatar ?? ''}
            </span>
            <span className="board-name">
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</span>
              {r.tag}
            </span>
            <span className="board-score">
              {moved > 0 && <span className="move up">▲{moved}</span>}
              {moved < 0 && <span className="move down">▼{-moved}</span>}
              <span>
                <CountUp value={val(r)} />
                <span className="sr"> {unit}</span>
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
