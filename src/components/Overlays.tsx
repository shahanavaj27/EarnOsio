import React from 'react';
import {
  ArrowRight,
  Map,
  Play,
  RotateCcw,
  Star,
  User,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { COIN_IMAGE_PATH } from '../game/assets';
import { HudSnapshot, LevelConfig } from '../game/types';
import { formatTime } from './GameHUD';

interface ReadyOverlayProps {
  level: LevelConfig;
  username: string;
  onStartRace: () => void;
  onLevelSelect: () => void;
}

export const ReadyOverlay: React.FC<ReadyOverlayProps> = ({
  level,
  username,
  onStartRace,
  onLevelSelect,
}) => (
  <div className="pointer-events-none fixed inset-0 z-[25] flex flex-col items-center justify-end px-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] sm:px-4 sm:pb-8">
    <div className="pointer-events-auto flex w-full max-w-md flex-col items-center gap-2.5 rounded-2xl border border-emerald-400/35 bg-[#0B0F14]/90 p-3.5 shadow-2xl backdrop-blur-md sm:gap-3 sm:p-5">
      <div className="text-center">
        <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
          Level {level.id} · {level.name}
        </div>
        <p className="mt-0.5 text-xs font-semibold text-slate-100 sm:mt-1 sm:text-sm">
          Welcome, <span className="text-emerald-400">{username}</span>! Press START to ride
        </p>
      </div>

      <button
        type="button"
        onClick={onStartRace}
        aria-label="Start Race"
        className="flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-xl bg-[#16C768] px-6 py-3 font-display text-xl font-black tracking-wide text-slate-950 shadow-[0_10px_34px_rgba(22,199,104,0.45)] transition-transform hover:bg-emerald-400 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-white sm:min-h-[68px] sm:gap-3 sm:rounded-2xl sm:px-8 sm:py-4 sm:text-2xl"
      >
        <Play className="h-6 w-6 fill-current sm:h-7 sm:w-7" />
        START
      </button>

      <button
        type="button"
        onClick={onLevelSelect}
        className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-slate-800/90 px-4 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700 hover:text-white sm:min-h-[44px] sm:py-2.5 sm:text-sm"
      >
        <Map className="h-4 w-4 text-emerald-400" />
        Select Track
      </button>
    </div>
  </div>
);

interface PauseOverlayProps {
  level: LevelConfig;
  username: string;
  muted: boolean;
  onResume: () => void;
  onRestart: () => void;
  onLevelSelect: () => void;
  onChangeUsername: () => void;
  onToggleMute: () => void;
}

export const PauseOverlay: React.FC<PauseOverlayProps> = ({
  level,
  username,
  muted,
  onResume,
  onRestart,
  onLevelSelect,
  onChangeUsername,
  onToggleMute,
}) => (
  <div className="fixed inset-0 z-30 flex items-center justify-center overflow-y-auto bg-[#070B11]/75 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
    <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-slate-900 p-5 shadow-2xl sm:p-6">
      <div className="flex items-center justify-between gap-2 text-xs font-semibold text-emerald-400">
        <span>
          Level {level.id} · {level.name}
        </span>
        <span className="truncate text-slate-300">{username}</span>
      </div>
      <h2 className="mt-1 font-display text-2xl font-extrabold text-white">
        Game Paused
      </h2>

      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          onClick={onResume}
          className="flex min-h-[54px] items-center justify-center gap-2.5 rounded-xl bg-[#16C768] px-5 py-3 font-display text-lg font-extrabold text-slate-950 shadow-lg shadow-emerald-500/25 transition-transform hover:bg-emerald-400 active:scale-[0.98]"
        >
          <Play className="h-5 w-5 fill-current" />
          Resume Race
        </button>

        <button
          type="button"
          onClick={onRestart}
          className="flex min-h-[50px] items-center justify-center gap-2.5 rounded-xl border border-white/15 bg-slate-800 px-5 py-3 text-base font-bold text-white transition-colors hover:bg-slate-700 active:scale-[0.98]"
        >
          <RotateCcw className="h-5 w-5" />
          Restart Track
        </button>

        <button
          type="button"
          onClick={onToggleMute}
          className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          {muted ? 'Audio: Muted' : 'Audio: On'}
        </button>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onLevelSelect}
            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-slate-800/60 px-3 py-2.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <Map className="h-4 w-4" />
            Tracks
          </button>
          <button
            type="button"
            onClick={onChangeUsername}
            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-slate-800/60 px-3 py-2.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <User className="h-4 w-4 text-emerald-400" />
            Change Name
          </button>
        </div>
      </div>
    </div>
  </div>
);

interface CrashOverlayProps {
  level: LevelConfig;
  username: string;
  snapshot: HudSnapshot;
  onRestart: () => void;
  onLevelSelect: () => void;
}

export const CrashOverlay: React.FC<CrashOverlayProps> = ({
  level,
  username,
  snapshot,
  onRestart,
  onLevelSelect,
}) => (
  <div className="fixed inset-0 z-30 flex items-center justify-center overflow-y-auto bg-[#070B11]/65 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-[2px]">
    <div className="w-full max-w-sm rounded-2xl border border-rose-500/30 bg-slate-900/95 p-5 text-center shadow-2xl sm:p-6">
      <div className="text-xs font-semibold text-rose-400">
        Level {level.id} · {level.name}
      </div>
      <h2 className="mt-1 font-display text-3xl font-extrabold text-white">
        Wiped Out!
      </h2>
      <p className="mt-1.5 text-sm text-slate-300">
        <span className="font-semibold text-white">{username}</span> reached{' '}
        {snapshot.distanceMeters}m of {snapshot.totalMeters}m
      </p>

      <div className="mt-6 flex flex-col gap-2.5">
        <button
          type="button"
          onClick={onRestart}
          className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[#16C768] px-5 py-3 font-display text-base font-bold text-slate-950 transition-colors hover:bg-emerald-400"
        >
          <RotateCcw className="h-4 w-4" />
          Try Again (R)
        </button>
        <button
          type="button"
          onClick={onLevelSelect}
          className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-slate-800 px-5 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-700"
        >
          <Map className="h-4 w-4" />
          Level Selection
        </button>
      </div>
    </div>
  </div>
);

interface VictoryOverlayProps {
  level: LevelConfig;
  username: string;
  snapshot: HudSnapshot;
  starsEarned: number;
  hasNextLevel: boolean;
  onNextLevel: () => void;
  onReplay: () => void;
  onLevelSelect: () => void;
}

export const VictoryOverlay: React.FC<VictoryOverlayProps> = ({
  level,
  username,
  snapshot,
  starsEarned,
  hasNextLevel,
  onNextLevel,
  onReplay,
  onLevelSelect,
}) => (
  <div className="fixed inset-0 z-30 flex items-center justify-center overflow-y-auto bg-[#070B11]/75 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
    <div className="w-full max-w-md rounded-2xl border border-emerald-500/35 bg-slate-900 p-5 shadow-2xl sm:p-7">
      <div className="text-center">
        <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
          Level {level.id} · {level.name}
        </div>
        <h2 className="mt-1 font-display text-3xl font-extrabold text-white">
          Level Complete!
        </h2>

        {/* Stars */}
        <div className="mt-3 flex items-center justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <Star
              key={s}
              className={`h-8 w-8 transition-transform ${
                s <= starsEarned
                  ? 'scale-105 fill-emerald-400 text-emerald-400'
                  : 'text-slate-700'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Player Username Alongside Final Score */}
      <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-emerald-400/30 bg-slate-950/75 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <User className="h-5 w-5 shrink-0 text-emerald-400" />
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Player
            </div>
            <div className="truncate font-display text-lg font-extrabold text-white">
              {username}
            </div>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Final Score
          </div>
          <div className="font-mono text-xl font-black text-amber-300 tabular-nums">
            {snapshot.score} pts
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="mt-4 grid grid-cols-3 gap-3 border-b border-white/10 pb-4 text-center">
        <div>
          <div className="text-xs text-slate-400">EarnOS Coins</div>
          <div className="mt-1 flex items-center justify-center gap-1.5">
            <div className="h-5 w-5 overflow-hidden rounded-full border border-white/75 bg-black">
              <img
                src={COIN_IMAGE_PATH}
                alt="EarnOS Coin"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            </div>
            <span className="font-mono text-base font-bold text-white tabular-nums">
              {snapshot.coinsCollected}/{snapshot.totalCoins}
            </span>
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-400">Time</div>
          <div className="mt-1 font-mono text-base font-bold text-white tabular-nums">
            {formatTime(snapshot.elapsedSeconds)}
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-400">Flips</div>
          <div className="mt-1 font-mono text-base font-bold text-white tabular-nums">
            {snapshot.flips}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex flex-col gap-2.5">
        {hasNextLevel && (
          <button
            type="button"
            onClick={onNextLevel}
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#16C768] px-6 py-3 font-display text-base font-bold text-slate-950 transition-colors hover:bg-emerald-400"
          >
            Next Level
            <ArrowRight className="h-5 w-5" />
          </button>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onReplay}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
          >
            <RotateCcw className="h-4 w-4" />
            Replay
          </button>
          <button
            type="button"
            onClick={onLevelSelect}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
          >
            <Map className="h-4 w-4" />
            Tracks
          </button>
        </div>
      </div>
    </div>
  </div>
);
