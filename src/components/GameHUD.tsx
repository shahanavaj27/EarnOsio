import React, { useEffect, useRef } from 'react';
import {
  ArrowLeft,
  ArrowUp,
  Clock,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  RotateCw,
  Gauge,
  OctagonX,
} from 'lucide-react';
import { COIN_IMAGE_PATH } from '../game/assets';
import { HudSnapshot, InputState, LevelConfig } from '../game/types';

interface GameHUDProps {
  level: LevelConfig;
  username: string;
  hud: HudSnapshot;
  muted: boolean;
  isReady?: boolean;
  inputState: InputState;
  onBack: () => void;
  onToggleMute: () => void;
  onRestart: () => void;
  onPause: () => void;
  onControlChange: (key: keyof InputState, active: boolean) => void;
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const tenths = Math.floor((seconds * 10) % 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  level,
  username,
  hud,
  muted,
  isReady = false,
  inputState,
  onBack,
  onToggleMute,
  onRestart,
  onPause,
  onControlChange,
}) => {
  const activePointersRef = useRef<Record<keyof InputState, Set<number>>>({
    gas: new Set(),
    brake: new Set(),
    leanBack: new Set(),
    leanForward: new Set(),
    jump: new Set(),
  });

  useEffect(() => {
    const pointers = activePointersRef.current;
    return () => {
      (Object.keys(pointers) as (keyof InputState)[]).forEach((k) => {
        pointers[k].clear();
      });
    };
  }, []);

  const progressPct = Math.max(
    0,
    Math.min(100, (hud.distanceMeters / Math.max(1, hud.totalMeters)) * 100)
  );

  const releasePointer = (key: keyof InputState, pointerId: number) => {
    const set = activePointersRef.current[key];
    if (set.has(pointerId)) {
      set.delete(pointerId);
    }
    if (set.size === 0) {
      onControlChange(key, false);
    }
  };

  const bindPointer = (key: keyof InputState) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture is unsupported
      }
      activePointersRef.current[key].add(e.pointerId);
      onControlChange(key, true);
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore if already released
      }
      releasePointer(key, e.pointerId);
    },
    onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => {
      releasePointer(key, e.pointerId);
    },
    onLostPointerCapture: (e: React.PointerEvent<HTMLButtonElement>) => {
      releasePointer(key, e.pointerId);
    },
    onPointerLeave: (e: React.PointerEvent<HTMLButtonElement>) => {
      try {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) {
          releasePointer(key, e.pointerId);
        }
      } catch {
        releasePointer(key, e.pointerId);
      }
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between px-2 pt-[max(0.4rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4 lg:p-5">
      {/* Top HUD Bar */}
      <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 rounded-xl border border-white/15 bg-[#0B0F14]/88 px-2 py-1.5 backdrop-blur-md sm:gap-3 sm:rounded-2xl sm:px-4 sm:py-2.5">
        {/* Left: Back Button, Welcome Greeting, Level & Distance Progress */}
        <div className="order-1 flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to level select"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-slate-900/95 text-slate-100 transition-colors hover:bg-slate-800 hover:text-white active:scale-95 focus-visible:outline-2 focus-visible:outline-emerald-400 sm:h-12 sm:w-12 sm:rounded-xl"
          >
            <ArrowLeft className="h-4.5 w-4.5 sm:h-6 sm:w-6" strokeWidth={2.5} />
          </button>

          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-extrabold leading-tight text-white sm:text-sm">
              Welcome, <span className="text-emerald-400">{username}</span>!
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-[11px] font-bold leading-tight text-slate-300 sm:gap-1.5 sm:text-xs">
              <span className="whitespace-nowrap text-emerald-300">Lvl {level.id}</span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span className="truncate text-slate-100">{level.name}</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 sm:gap-2">
              <div className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-slate-800 sm:h-2 sm:w-32 md:w-40">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-transform duration-150"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="font-mono text-[10px] font-bold leading-none text-slate-200 tabular-nums whitespace-nowrap sm:text-xs">
                {hud.distanceMeters}m / {hud.totalMeters}m
              </span>
            </div>
          </div>
        </div>

        {/* Center / Row 2 on Mobile: Compact EarnOS Coins, Score & Timer */}
        <div className="order-3 flex w-full items-center justify-between gap-2 border-t border-white/10 pt-1.5 sm:order-2 sm:w-auto sm:justify-start sm:gap-4 sm:border-t-0 sm:pt-0">
          {/* EarnOS Coin Counter */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="h-6 w-6 shrink-0 overflow-hidden rounded-full border border-slate-100 bg-black shadow-sm sm:h-9 sm:w-9 sm:border-2">
              <img
                src={COIN_IMAGE_PATH}
                alt="EarnOS Coin"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            </div>
            <span className="font-mono text-sm font-extrabold text-white tabular-nums whitespace-nowrap sm:text-lg">
              {hud.coinsCollected}
              <span className="text-[11px] font-semibold text-slate-400 sm:text-sm">
                /{hud.totalCoins}
              </span>
            </span>
          </div>

          <div className="h-4 w-px bg-white/15 sm:h-6" />

          {/* Score & Points Counter */}
          <div className="flex items-baseline gap-1 font-mono tabular-nums whitespace-nowrap sm:gap-1.5">
            <span className="text-sm font-black text-amber-300 sm:text-lg">
              {hud.score}
            </span>
            <span className="text-[10px] font-extrabold uppercase tracking-wide text-emerald-400 sm:text-xs">
              pts
            </span>
          </div>

          <div className="h-4 w-px bg-white/15 sm:h-6" />

          {/* Timer & Reverse Status Indicator */}
          <div className="flex items-center gap-1 font-mono text-xs font-extrabold text-slate-100 tabular-nums whitespace-nowrap sm:gap-1.5 sm:text-base">
            <Clock className="h-3.5 w-3.5 shrink-0 text-emerald-400 sm:h-4.5 sm:w-4.5" strokeWidth={2.4} />
            <span>{formatTime(hud.elapsedSeconds)}</span>
            {hud.isReversing && (
              <span className="ml-0.5 rounded bg-amber-400 px-1 py-0.5 text-[10px] font-black tracking-wide text-slate-950 sm:text-xs">
                REV
              </span>
            )}
          </div>
        </div>

        {/* Right: Sound, Restart & Pause Buttons */}
        <div className="order-2 flex shrink-0 items-center gap-1.5 sm:order-3 sm:gap-2">
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-slate-900/95 text-slate-100 transition-colors hover:bg-slate-800 hover:text-white active:scale-95 focus-visible:outline-2 focus-visible:outline-emerald-400 sm:h-12 sm:w-12 sm:rounded-xl"
          >
            {muted ? (
              <VolumeX className="h-4.5 w-4.5 sm:h-6 sm:w-6" strokeWidth={2.3} />
            ) : (
              <Volume2 className="h-4.5 w-4.5 sm:h-6 sm:w-6" strokeWidth={2.3} />
            )}
          </button>
          <button
            type="button"
            onClick={onRestart}
            aria-label="Restart level"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-slate-900/95 text-slate-100 transition-colors hover:bg-slate-800 hover:text-white active:scale-95 focus-visible:outline-2 focus-visible:outline-emerald-400 sm:h-12 sm:w-12 sm:rounded-xl"
          >
            <RotateCcw className="h-4.5 w-4.5 sm:h-6 sm:w-6" strokeWidth={2.3} />
          </button>
          <button
            type="button"
            onClick={onPause}
            disabled={isReady}
            aria-label="Pause game"
            className={`flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-400/45 bg-emerald-500/20 text-emerald-200 transition-colors focus-visible:outline-2 focus-visible:outline-emerald-400 sm:h-12 sm:w-12 sm:rounded-xl ${
              isReady
                ? 'cursor-not-allowed opacity-40'
                : 'hover:bg-emerald-500/35 hover:text-white active:scale-95'
            }`}
          >
            <Pause className="h-4.5 w-4.5 sm:h-6 sm:w-6" strokeWidth={2.3} />
          </button>
        </div>
      </div>

      {/* Bottom Mobile Controls: Hidden until START is pressed */}
      {!isReady && (
        <div className="flex items-end justify-between gap-2 pb-0.5 sm:gap-4 sm:pb-1">
          {/* Left Cluster: Brake centered above Tilt Back & Tilt Forward */}
          <div className="pointer-events-auto flex flex-col items-center gap-1.5 md:[@media(min-height:540px)]:gap-2.5">
            {/* Brake Button Centered Above Both Tilt Buttons */}
            <button
              type="button"
              {...bindPointer('brake')}
              aria-label="Brake"
              className={`touch-control flex h-[46px] w-[114px] min-[390px]:w-[126px] flex-row items-center justify-center gap-1.5 rounded-xl border-2 px-2.5 transition-transform md:[@media(min-height:540px)]:h-[74px] md:[@media(min-height:540px)]:w-[144px] md:[@media(min-height:540px)]:flex-col md:[@media(min-height:540px)]:gap-0.5 md:[@media(min-height:540px)]:rounded-2xl ${
                inputState.brake
                  ? 'scale-95 border-rose-300 bg-rose-500 text-white shadow-lg shadow-rose-500/40'
                  : 'border-rose-400/60 bg-rose-500/25 text-rose-100 hover:bg-rose-500/35'
              } backdrop-blur-md`}
            >
              <OctagonX className="h-5 w-5 shrink-0 md:[@media(min-height:540px)]:h-8 md:[@media(min-height:540px)]:w-8" strokeWidth={2.5} />
              <span className="text-center text-xs font-extrabold leading-tight tracking-tight md:[@media(min-height:540px)]:text-sm">
                Brake
              </span>
            </button>

            {/* Bottom Left Pair: Tilt Back & Tilt Forward */}
            <div className="flex items-center gap-1.5 md:[@media(min-height:540px)]:gap-3">
              <button
                type="button"
                {...bindPointer('leanBack')}
                aria-label="Tilt Back"
                className={`touch-control flex h-[54px] w-[72px] min-[390px]:w-[80px] flex-col items-center justify-center rounded-xl border-2 px-1.5 transition-transform md:[@media(min-height:540px)]:h-[86px] md:[@media(min-height:540px)]:w-[120px] md:[@media(min-height:540px)]:rounded-2xl ${
                  inputState.leanBack
                    ? 'scale-95 border-emerald-300 bg-emerald-500/45 text-white shadow-lg shadow-emerald-500/25'
                    : 'border-white/20 bg-[#0B0F14]/82 text-slate-100 hover:bg-slate-900/95'
                } backdrop-blur-md`}
              >
                <RotateCcw className="h-5 w-5 md:[@media(min-height:540px)]:h-8 md:[@media(min-height:540px)]:w-8" strokeWidth={2.5} />
                <span className="mt-0.5 text-center text-[10px] min-[390px]:text-[11px] font-extrabold leading-tight tracking-tight md:[@media(min-height:540px)]:text-sm">
                  Tilt Back
                </span>
              </button>

              <button
                type="button"
                {...bindPointer('leanForward')}
                aria-label="Tilt Forward"
                className={`touch-control flex h-[54px] w-[72px] min-[390px]:w-[80px] flex-col items-center justify-center rounded-xl border-2 px-1.5 transition-transform md:[@media(min-height:540px)]:h-[86px] md:[@media(min-height:540px)]:w-[120px] md:[@media(min-height:540px)]:rounded-2xl ${
                  inputState.leanForward
                    ? 'scale-95 border-emerald-300 bg-emerald-500/45 text-white shadow-lg shadow-emerald-500/25'
                    : 'border-white/20 bg-[#0B0F14]/82 text-slate-100 hover:bg-slate-900/95'
                } backdrop-blur-md`}
              >
                <RotateCw className="h-5 w-5 md:[@media(min-height:540px)]:h-8 md:[@media(min-height:540px)]:w-8" strokeWidth={2.5} />
                <span className="mt-0.5 text-center text-[10px] min-[390px]:text-[11px] font-extrabold leading-tight tracking-tight md:[@media(min-height:540px)]:text-sm">
                  Tilt Forward
                </span>
              </button>
            </div>
          </div>

          {/* Center Keyboard Legend (desktop only) */}
          <div className="hidden flex-col items-center gap-1 rounded-lg bg-[#0B0F14]/65 px-3.5 py-1.5 text-xs text-slate-300 backdrop-blur-sm lg:flex">
            {hud.isReversing && (
              <span className="font-mono font-black tracking-wider text-amber-300">
                REVERSING
              </span>
            )}
            <div className="flex items-center gap-3">
              <span>W / ↑ Gas</span>
              <span className="text-slate-600">·</span>
              <span>S / ↓ Brake / Rev</span>
              <span className="text-slate-600">·</span>
              <span>Space Jump</span>
              <span className="text-slate-600">·</span>
              <span>A / D Tilt</span>
            </div>
          </div>

          {/* Right Side: Dedicated JUMP Button Above Gas Pedal */}
          <div className="pointer-events-auto flex flex-col items-end gap-1.5 md:[@media(min-height:540px)]:gap-2.5">
            <button
              type="button"
              {...bindPointer('jump')}
              aria-label="Jump"
              className={`touch-control flex h-[46px] w-[96px] min-[390px]:w-[108px] flex-row items-center justify-center gap-1 rounded-xl border-2 px-2.5 transition-transform md:[@media(min-height:540px)]:h-[74px] md:[@media(min-height:540px)]:w-[152px] md:[@media(min-height:540px)]:flex-col md:[@media(min-height:540px)]:gap-0.5 md:[@media(min-height:540px)]:rounded-2xl ${
                inputState.jump
                  ? 'scale-95 border-amber-200 bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/40'
                  : 'border-amber-400/70 bg-amber-500/25 text-amber-200 hover:bg-amber-500/35'
              } backdrop-blur-md`}
            >
              <ArrowUp className="h-5 w-5 shrink-0 md:[@media(min-height:540px)]:h-8 md:[@media(min-height:540px)]:w-8" strokeWidth={2.75} />
              <span className="text-center text-xs font-black leading-tight tracking-tight md:[@media(min-height:540px)]:text-sm">
                JUMP
              </span>
            </button>

            <button
              type="button"
              {...bindPointer('gas')}
              aria-label="Gas"
              className={`touch-control flex h-[54px] w-[96px] min-[390px]:w-[108px] flex-row items-center justify-center gap-1.5 rounded-xl border-2 px-2.5 transition-transform md:[@media(min-height:540px)]:h-[92px] md:[@media(min-height:540px)]:w-[152px] md:[@media(min-height:540px)]:flex-col md:[@media(min-height:540px)]:gap-0.5 md:[@media(min-height:540px)]:rounded-2xl ${
                inputState.gas
                  ? 'scale-95 border-emerald-200 bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/40'
                  : 'border-emerald-400/65 bg-emerald-500/25 text-emerald-200 hover:bg-emerald-500/35'
              } backdrop-blur-md`}
            >
              <Gauge className="h-5.5 w-5.5 shrink-0 md:[@media(min-height:540px)]:h-9 md:[@media(min-height:540px)]:w-9" strokeWidth={2.5} />
              <span className="text-center text-sm font-black leading-tight tracking-tight md:[@media(min-height:540px)]:text-lg">
                Gas
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
