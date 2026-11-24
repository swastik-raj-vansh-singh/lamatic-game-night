'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMediaSource } from '@/components/SongPlayer';
import { WheelPanel } from '@/components/WheelPanel';
import { BuzzList, FinalResults, Game1View, LiveBoard, LobbyView, RoundHeader, RoundStatusBoard } from '@/components/views';
import Link from 'next/link';
import { Loading, TopBar } from '@/components/ui';
import { getBackend } from '@/lib/backend';
import { currentAttempt, playersOnly, sortBuzzes } from '@/lib/game';
import { useBuzzes, useGameState, useGate } from '@/lib/hooks';
import { sfx } from '@/lib/sfx';
import type { Buzz, GameState, Playback, Player } from '@/lib/types';

function BuzzerPad({ game, me, buzzes }: { game: GameState; me: Player; buzzes: Buzz[] }) {
  const r = game.round;
  const openedAt = useRef<number | null>(null);
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [pressed, setPressed] = useState(false);
  const [localBuzz, setLocalBuzz] = useState<string | null>(null);

  useEffect(() => {
    openedAt.current = null;
    setNote(null);
    setLocalBuzz(null);
  }, [r.key]);
  useEffect(() => {
    if ((r.status === 'open' || r.status === 'answering') && openedAt.current === null) openedAt.current = performance.now();
  }, [r.status, r.key]);

  const sorted = sortBuzzes(buzzes).filter(b => b.roundKey === r.key);
  const mine = sorted.find(b => b.playerId === me.id);
  const buzzed = !!mine || localBuzz === r.key;
  const pos = mine ? sorted.indexOf(mine) + 1 : 0;
  const att = currentAttempt(r);
  const myAttempt = r.attempts.find(a => a.playerId === me.id);
  const buzzWindow = r.status === 'open' || r.status === 'answering';
  const live = buzzWindow && !buzzed && !myAttempt && !pending;

  const press = useCallback(async () => {
    if (!live) return;
    setPending(true);
    setPressed(true);
    setTimeout(() => setPressed(false), 140);
    sfx.buzz();
    try {
      navigator.vibrate?.(70);
    } catch {
      /* not supported */
    }
    const ms = openedAt.current !== null ? performance.now() - openedAt.current : 0;
    const res = await getBackend().buzz(r.key, ms);
    setPending(false);
    if (res.error) setNote(res.error);
    else {
      setLocalBuzz(r.key);
      setNote(`You buzzed in ${(ms / 1000).toFixed(2)}s`);
    }
  }, [live, r.key]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== 'Enter') return;
      const el = e.target as HTMLElement | null;
      if (el && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(el.tagName) && el.className.indexOf('buzzer') < 0) return;
      e.preventDefault();
      void press();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press]);

  let label = 'BUZZ';
  let sub = 'Tap the button or press Space';
  if (r.status === 'ready') {
    label = 'WAIT';
    sub = 'Buzzers open when the music starts.';
  } else if (att?.playerId === me.id) {
    label = 'SING!';
    sub = "You're up! Unmute and sing the next line.";
  } else if (myAttempt?.result === 'correct') {
    label = '★';
    sub = 'You got it!';
  } else if (myAttempt?.result === 'wrong') {
    label = 'OUT';
    sub = 'You had your turn this song.';
  } else if (buzzed) {
    label = pos ? `#${pos}` : '✓';
    sub = pos === 1 ? 'You were first!' : 'You are in the queue.';
  } else if (!buzzWindow) {
    label = 'DONE';
    sub = 'This song is over.';
  }

  return (
    <div className="buzzer-wrap">
      <button
        type="button"
        className={`buzzer${live ? ' live' : ''}${buzzed ? ' done' : ''}${pressed ? ' pressed' : ''}`}
        disabled={!live}
        onPointerDown={e => {
          e.preventDefault();
          void press();
        }}
        onClick={e => e.preventDefault()}
        aria-label={live ? 'Buzz in' : `Buzzer: ${sub}`}
      >
        {label}
      </button>
      <p className="buzz-note" aria-live="polite">
        {note && buzzed && !myAttempt ? note : sub}
      </p>
    </div>
  );
}

/**
 * Plays the song on this player's own device, following the host's Play/Pause.
 * It stops by itself when someone buzzes.
 */
function PlayerAudio({ game }: { game: GameState }) {
  const r = game.round;
  const clip = game.playOnDevices ? r.clip : null;
  const pb = r.playback;
  const box = useRef<HTMLDivElement>(null);
  const media = useMediaSource(clip?.source ?? '', box, clip?.start ?? 0);
  const m = useRef(media);
  m.current = media;
  const [state, setState] = useState<'waiting' | 'playing' | 'paused'>('waiting');
  const [unlocked, setUnlocked] = useState(false);
  const seen = useRef<number>(pb?.seq ?? 0); // don't replay a command from before this page opened
  const pending = useRef<Playback | null>(null);
  const raf = useRef(0);

  const halt = () => {
    cancelAnimationFrame(raf.current);
    pending.current = null;
    m.current.pause();
  };
  const run = (cmd: Playback) => {
    cancelAnimationFrame(raf.current);
    if (cmd.status !== 'playing') {
      m.current.pause();
      setState('paused');
      return;
    }
    m.current.seek(cmd.from);
    m.current.play();
    setState('playing');
    const started = performance.now();
    const loop = () => {
      if (cmd.until && performance.now() - started > 400 && m.current.now() >= cmd.until - 0.03) {
        m.current.pause();
        setState('paused');
        return;
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  };

  // A new command from the host.
  useEffect(() => {
    if (!pb || !clip || pb.seq <= seen.current) return;
    seen.current = pb.seq;
    if (pb.status === 'playing' && r.status === 'answering') return;
    if (!m.current.ready) {
      pending.current = pb;
      return;
    }
    run(pb);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pb?.seq, !!clip]);

  // A command that arrived while the song was still loading.
  useEffect(() => {
    if (media.ready && pending.current) {
      const c = pending.current;
      pending.current = null;
      run(c);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media.ready]);

  // Someone buzzed, the song ended, or the host switched to "only this screen".
  useEffect(() => {
    if (r.status === 'answering' || r.status === 'won' || r.status === 'failed' || !game.playOnDevices) {
      halt();
      setState(s => (s === 'waiting' ? s : 'paused'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.status, r.attempts.length, game.playOnDevices]);

  // New song: start fresh.
  useEffect(() => {
    halt();
    setState('waiting');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.key]);

  // Any tap on the page lets the browser play sound later.
  useEffect(() => {
    if (unlocked) return;
    const onTap = () => {
      m.current.unlock();
      setUnlocked(true);
    };
    document.addEventListener('pointerdown', onTap, { once: true });
    return () => document.removeEventListener('pointerdown', onTap);
  }, [unlocked]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  if (!clip) return null;
  return (
    <section className="card" aria-label="Song on this device">
      <div className="row" style={{ alignItems: 'center' }}>
        {media.isYouTube && (
          <div className="yt-wrap">
            <div className="yt-box" ref={box} />
            <div className="yt-cover" aria-hidden="true">
              ♪
            </div>
          </div>
        )}
        <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
          <span className="eyebrow">Song on this phone</span>
          <b>
            {media.failed
              ? "This song won't play on this device. Listen on the host's screen."
              : !media.ready
                ? 'Loading the song…'
                : state === 'playing'
                  ? '♪ Playing'
                  : state === 'paused'
                    ? 'Paused'
                    : 'Ready. It plays when the host presses Play.'}
          </b>
          {media.isYouTube && <span className="hint">On iPhone, if you hear nothing, tap the ♪ box once.</span>}
        </div>
      </div>
      {!unlocked && (
        <button type="button" className="teal" onClick={() => undefined}>
          🔊 Tap to turn on sound
        </button>
      )}
    </section>
  );
}

export default function PlayPage() {
  const { me, players, host, ready } = useGate({ needPlayer: true });
  const { game } = useGameState();
  const buzzes = useBuzzes(game?.phase === 'round' ? game.round.key : null);
  const lastStatus = useRef<string | null>(null);

  useEffect(() => {
    if (!game || game.phase !== 'round') return;
    const s = `${game.round.key}:${game.round.status}:${game.round.attempts.length}`;
    if (lastStatus.current && lastStatus.current !== s) {
      if (game.round.status === 'won') sfx.fanfare();
      else if (game.round.attempts.some(a => a.result === 'wrong') && game.round.status !== 'answering') sfx.wrong();
    }
    lastStatus.current = s;
  }, [game]);

  if (!ready || !game) return <Loading />;
  if (host || !me) {
    return (
      <>
        <TopBar host={host} />
        <main className="shell narrow">
          <div className="card">
            <h2>You&apos;re the host</h2>
            <p className="muted">Hosts run the game and don&apos;t play, so you won&apos;t appear on anyone&apos;s screen. Share the Stage on Meet and keep the Answer sheet on your phone.</p>
            <div className="row">
              <Link className="btn" href="/stage">
                Open the Stage
              </Link>
              <Link className="btn ghost" href="/host">
                Open the Answer sheet
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }
  const visible = playersOnly(players, game);

  return (
    <>
      <TopBar me={me} points={game.points[me.id] ?? 0} host={host} />
      <main className="shell">
        {game.phase === 'lobby' && <LobbyView players={visible} meId={me.id} />}
        {game.phase === 'game1' && <Game1View game={game} players={visible} />}
        {game.phase === 'round' && (
          <>
            <RoundHeader game={game} />
            <RoundStatusBoard game={game} players={players} meId={me.id} />
            <BuzzerPad game={game} me={me} buzzes={buzzes} />
            <PlayerAudio game={game} />
            <BuzzList game={game} players={players} buzzes={buzzes} limit={6} />
            <LiveBoard game={game} players={visible} meId={me.id} />
          </>
        )}
        {game.phase === 'leaderboard' && <FinalResults game={game} players={visible} meId={me.id} />}
        {game.phase === 'wheel' && <WheelPanel game={game} players={visible} canSpin={game.winnerId === me.id} viewerIsWinner={game.winnerId === me.id} />}
      </main>
    </>
  );
}
