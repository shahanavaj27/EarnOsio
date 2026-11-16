import React from 'react';
import { ArrowLeft, Lock, Play, Star, Unlock, User } from 'lucide-react';
import { COIN_IMAGE_PATH } from '../game/assets';
import { GameProgress, LevelConfig } from '../game/types';
import { formatTime } from './GameHUD';

interface LevelSelectProps {
  levels: LevelConfig[];
  progress: GameProgress;
  onSelectLevel: (levelId: number) => void;
  onBack: () => void;
  onChangeUsername: () => void;
  onToggleUnlockAll: () => void;
}

const DIFFICULTY_TEXT_CLASS: Record<string, string> = {
  'Very Easy': 'text-emerald-400',
  Easy: 'text-lime-400',
  Medium: 'text-amber-400',
  Challenging: 'text-orange-400',
  Hard: 'text-rose-400',
  Expert: 'text-red-400',
};

export const LevelSelect: React.FC<LevelSelectProps> = ({
  levels,
  progress,
  onSelectLevel,
  onBack,
  onChangeUsername,
  onToggleUnlockAll,
}) => {
  return (
    <div className="fixed inset-0 z-30 flex flex-col overflow-x-hidden overflow-y-auto bg-[#070B11]/92 px-3.5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:p-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex h-11 items-center gap-2 rounded-lg border border-white/15 bg-slate-900 px-3.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-400 whitespace-nowrap"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <div>
              <h2 className="font-display text-2xl font-extrabold text-white sm:text-3xl">
                Select Track
              </h2>
              <p className="text-xs text-slate-300 sm:text-sm">
                Welcome, <span className="font-bold text-emerald-400">{progress.username}</span>! Complete each track to unlock the next challenge.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onChangeUsername}
              className="flex h-10 items-center gap-2 rounded-lg border border-white/15 bg-slate-900 px-3.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-400 whitespace-nowrap"
            >
              <User className="h-3.5 w-3.5 text-emerald-400" />
              Change Username
            </button>

            <button
              type="button"
              onClick={onToggleUnlockAll}
              className="flex h-10 items-center gap-2 rounded-lg border border-white/15 bg-slate-900 px-4 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-400 whitespace-nowrap"
            >
              <Unlock className="h-3.5 w-3.5 text-emerald-400" />
              {progress.unlockAll ? 'All Tracks Unlocked' : 'Unlock All Tracks'}
            </button>
          </div>
        </div>

        {/* Levels Grid */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {levels.map((lvl) => {
            const unlocked = progress.unlockAll || lvl.id <= progress.unlockedLevel;
            const rec = progress.records[lvl.id];
            const bestCoins = rec?.bestCoins ?? 0;
            const totalCoins = lvl.coins.length;
            const stars = rec?.stars ?? 0;
            const diffColor = DIFFICULTY_TEXT_CLASS[lvl.difficulty] || 'text-slate-300';

            return (
              <button
                key={lvl.id}
                type="button"
                disabled={!unlocked}
                onClick={() => unlocked && onSelectLevel(lvl.id)}
                className={`group flex flex-col justify-between rounded-2xl border p-5 text-left transition-all focus-visible:outline-2 focus-visible:outline-emerald-400 ${
                  unlocked
                    ? 'border-white/12 bg-slate-900/85 hover:border-emerald-400/60 hover:bg-slate-800/90 active:scale-[0.99]'
                    : 'cursor-not-allowed border-white/5 bg-slate-950/60 opacity-60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-slate-400">
                      Track 0{lvl.id} · {lvl.palette.environmentLabel}
                    </span>
                    <span className={`text-xs font-semibold ${diffColor}`}>
                      {lvl.difficulty}
                    </span>
                  </div>

                  <h3 className="mt-2 font-display text-xl font-bold text-white">
                    {lvl.name}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    {lvl.subtitle}
                  </p>
                </div>

                <div className="mt-5 border-t border-white/10 pt-3.5">
                  <div className="flex items-center justify-between gap-2">
                    {/* Coins */}
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-5 overflow-hidden rounded-full border border-white/70 bg-black">
                        <img
                          src={COIN_IMAGE_PATH}
                          alt="EarnOS Coin"
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <span className="font-mono text-xs font-semibold text-slate-200 tabular-nums">
                        {bestCoins}/{totalCoins}
                      </span>
                    </div>

                    {/* Best Time */}
                    <span className="font-mono text-xs text-slate-400 tabular-nums">
                      {rec?.bestTime ? formatTime(rec.bestTime) : `${lvl.lengthMeters}m`}
                    </span>

                    {/* Stars or Lock */}
                    {unlocked ? (
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3].map((s) => (
                          <Star
                            key={s}
                            className={`h-4 w-4 ${
                              s <= stars
                                ? 'fill-emerald-400 text-emerald-400'
                                : 'text-slate-600'
                            }`}
                          />
                        ))}
                      </div>
                    ) : (
                      <Lock className="h-4 w-4 text-slate-500" />
                    )}
                  </div>

                  {unlocked && (
                    <div className="mt-3 flex items-center justify-end gap-1.5 text-xs font-semibold text-emerald-400 group-hover:text-emerald-300">
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>Race Track</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
