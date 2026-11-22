'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { sfx } from '@/lib/sfx';
import { SEGMENTS, landingFraction, norm360, restingRotation, sliceAt } from '@/lib/wheel';

const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/**
 * Prize wheel. Give it the server's result (`segment`) and a `seed`; every
 * screen lands on the same spot. `animate` spins it, otherwise it rests there.
 */
export function Wheel({ segment, seed, animate, onDone }: { segment: number | null; seed: string | null; animate: boolean; onDone?: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const pointer = useRef<SVGSVGElement>(null);
  const rotation = useRef(0);
  const [spinning, setSpinning] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const draw = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const size = c.clientWidth;
    if (!size) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(size * dpr);
    c.height = Math.round(size * dpr);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const r = size / 2;
    const seg = (2 * Math.PI) / SEGMENTS.length;
    const stage = cssVar('--stage');
    ctx.clearRect(0, 0, size, size);
    SEGMENTS.forEach((s, i) => {
      const a0 = -Math.PI / 2 + i * seg;
      ctx.beginPath();
      ctx.moveTo(r, r);
      ctx.arc(r, r, r - 3, a0, a0 + seg);
      ctx.closePath();
      ctx.fillStyle = cssVar(s.fill);
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = stage;
      ctx.stroke();
      ctx.save();
      ctx.translate(r, r);
      ctx.rotate(a0 + seg / 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = cssVar(s.text);
      if (s.kind === 'gift') {
        ctx.font = `${Math.round(size * 0.085)}px Bungee, "Arial Black", sans-serif`;
        ctx.fillText(`GIFT ${s.num}`, r - size * 0.06, 0);
      } else {
        ctx.font = `${Math.round(size * 0.042)}px Bungee, "Arial Black", sans-serif`;
        ctx.fillText('BETTER LUCK', r - size * 0.06, -size * 0.03);
        ctx.fillText('NEXT TIME', r - size * 0.06, size * 0.03);
      }
      ctx.restore();
    });
    ctx.beginPath();
    ctx.arc(r, r, r - 2, 0, 2 * Math.PI);
    ctx.lineWidth = 4;
    ctx.strokeStyle = cssVar('--bulb');
    ctx.stroke();
  }, []);

  const setRot = (deg: number) => {
    rotation.current = deg;
    if (canvas.current) canvas.current.style.transform = `rotate(${deg}deg)`;
  };

  useEffect(() => {
    const redraw = () => requestAnimationFrame(draw);
    if (document.fonts?.load) document.fonts.load('40px Bungee').then(redraw, redraw);
    else redraw();
    let t: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(draw, 120);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [draw]);

  useEffect(() => {
    if (segment === null || segment === undefined) {
      setRot(0);
      return;
    }
    const target = restingRotation(segment, landingFraction(seed ?? 'x'));
    if (!animate) {
      setRot(target);
      return;
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const from = rotation.current;
    const to = from + (reduce ? 1 : 7) * 360 + norm360(target - norm360(from));
    const dur = reduce ? 1400 : 6800;
    const start = performance.now();
    let last = sliceAt(from);
    let raf = 0;
    setSpinning(true);
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 4);
      setRot(from + (to - from) * eased);
      const s = sliceAt(rotation.current);
      if (s !== last) {
        last = s;
        sfx.tick();
        const p = pointer.current;
        if (p) {
          p.classList.remove('tick');
          void p.getBoundingClientRect();
          p.classList.add('tick');
        }
      }
      if (t < 1) raf = requestAnimationFrame(frame);
      else {
        setSpinning(false);
        setTimeout(() => doneRef.current?.(), 400);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [segment, seed, animate]);

  return (
    <div className={`wheel-stage${spinning ? ' spinning' : ''}`} ref={stageRef}>
      <div className="wheel-ring" aria-hidden="true">
        {Array.from({ length: 24 }, (_, i) => (
          <span key={i} className="wbulb" style={{ ['--a' as string]: `${i * 15}deg` }} />
        ))}
      </div>
      <canvas
        ref={canvas}
        className="wheel-canvas"
        role="img"
        aria-label="Prize wheel with five slices: Gift 1, Better luck next time, Gift 2, Gift 3, Better luck next time"
      />
      <div className="hub" aria-hidden="true">
        SPIN
      </div>
      <svg ref={pointer} className="pointer" viewBox="0 0 36 46" aria-hidden="true">
        <path d="M18 44 3 12a15 15 0 1 1 30 0Z" fill="var(--coral)" stroke="var(--ink)" strokeWidth="2.5" />
        <circle cx="18" cy="13" r="5" fill="var(--ink)" />
      </svg>
    </div>
  );
}
