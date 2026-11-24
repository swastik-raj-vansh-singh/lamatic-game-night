'use client';

import { useEffect, useRef, useState } from 'react';
import type { Song } from '@/lib/types';
import { useMediaSource } from './SongPlayer';

const fmt = (t: number) => `${Math.floor(Math.max(0, t) / 60)}:${(Math.max(0, t) % 60).toFixed(1).padStart(4, '0')}`;

/**
 * Play a song freely and mark where the clip should start and stop.
 * Tap "Stop here" right before the line people have to sing.
 */
export function TimingTool({ song, onChange, onClose }: { song: Song; onChange: (patch: Partial<Song>) => void; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const media = useMediaSource(song.source, box, song.start);
  const [time, setTime] = useState(song.start);
  const [playing, setPlaying] = useState(false);
  const [testing, setTesting] = useState(false);
  const raf = useRef(0);
  const mediaRef = useRef(media);
  mediaRef.current = media;
  const testEnd = useRef(0);

  useEffect(() => {
    const loop = () => {
      const t = mediaRef.current.now();
      setTime(t);
      if (testEnd.current && t >= testEnd.current - 0.03) {
        mediaRef.current.pause();
        testEnd.current = 0;
        setPlaying(false);
        setTesting(false);
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  useEffect(() => () => mediaRef.current.pause(), []);

  const toggle = () => {
    testEnd.current = 0;
    setTesting(false);
    if (playing) {
      media.pause();
      setPlaying(false);
    } else {
      media.play();
      setPlaying(true);
    }
  };
  const jump = (d: number) => media.seek(media.now() + d);
  const test = () => {
    if (!(song.stop > song.start)) return;
    media.seek(song.start);
    testEnd.current = song.stop;
    media.play();
    setPlaying(true);
    setTesting(true);
  };

  return (
    <div className="card" style={{ background: 'var(--stage)', borderColor: 'var(--teal)' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3>
          Set timing · Round {song.round}: {song.title || 'Untitled'}
        </h3>
        <button type="button" className="ghost small" onClick={onClose}>
          Done
        </button>
      </div>
      {!song.source.trim() ? (
        <p className="error">Add an audio file or YouTube link for this round first.</p>
      ) : (
        <>
          <ol className="hint">
            <li>Press Play and listen.</li>
            <li>
              Tap <b>Start here</b> where the clip should begin (usually 0:00, or skip a long intro).
            </li>
            <li>
              Tap <b>Stop here</b> right before the line people must sing.
            </li>
            <li>
              Press <b>Test the clip</b> to hear exactly what players will hear, then <b>Save songs</b>.
            </li>
          </ol>
          <div className="row" style={{ alignItems: 'center' }}>
            {media.isYouTube && <div className="yt-box" ref={box} />}
            <div style={{ display: 'grid', gap: 4 }}>
              <span className="display num" style={{ fontSize: '2rem', color: 'var(--bulb)' }}>
                {fmt(time)}
              </span>
              <span className="muted">{media.failed ? media.failed : media.ready ? (testing ? 'Testing the clip…' : playing ? 'Playing' : 'Paused') : 'Loading…'}</span>
            </div>
          </div>
          <div className="row">
            <button type="button" className="teal" onClick={toggle} disabled={!media.ready}>
              {playing ? '❚❚ Pause' : '▶ Play'}
            </button>
            <button type="button" className="ghost small" onClick={() => jump(-5)} disabled={!media.ready}>
              −5s
            </button>
            <button type="button" className="ghost small" onClick={() => jump(-1)} disabled={!media.ready}>
              −1s
            </button>
            <button type="button" className="ghost small" onClick={() => jump(1)} disabled={!media.ready}>
              +1s
            </button>
            <button type="button" className="ghost small" onClick={() => jump(5)} disabled={!media.ready}>
              +5s
            </button>
          </div>
          <div className="row">
            <button type="button" onClick={() => onChange({ start: Math.round(media.now() * 10) / 10 })} disabled={!media.ready}>
              Start here ({fmt(song.start)})
            </button>
            <button type="button" className="coral" onClick={() => onChange({ stop: Math.round(media.now() * 10) / 10 })} disabled={!media.ready}>
              Stop here ({song.stop > 0 ? fmt(song.stop) : 'not set'})
            </button>
            <button type="button" className="ghost" onClick={test} disabled={!media.ready || !(song.stop > song.start)}>
              ▶ Test the clip
            </button>
          </div>
          {song.stop > 0 && !(song.stop > song.start) && <p className="error">The stop point must be after the start point.</p>}
        </>
      )}
    </div>
  );
}
