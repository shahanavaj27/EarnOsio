import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Map,
  Play,
  User,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { COIN_IMAGE_PATH, FROG_IMAGE_PATH, GameAssets } from '../game/assets';
import {
  MAX_USERNAME_LENGTH,
  MIN_USERNAME_LENGTH,
  sanitizeUsernameInput,
  validateUsername,
} from '../game/username';

interface TitleScreenProps {
  assets: GameAssets;
  savedUsername: string;
  totalCoinsBanked: number;
  muted: boolean;
  focusInputSignal?: number;
  onPlay: (username: string) => void;
  onOpenLevels: (username: string) => void;
  onToggleMute: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  assets,
  savedUsername,
  totalCoinsBanked,
  muted,
  focusInputSignal = 0,
  onPlay,
  onOpenLevels,
  onToggleMute,
}) => {
  const frogSrc = assets.frogDataUrl || FROG_IMAGE_PATH;
  const [draftName, setDraftName] = useState<string>(savedUsername);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraftName(savedUsername);
  }, [savedUsername]);

  useEffect(() => {
    if (focusInputSignal > 0) {
      inputRef.current?.focus();
    }
  }, [focusInputSignal]);

  const tryValidateAndProceed = (nextAction: (cleanName: string) => void) => {
    const result = validateUsername(draftName);
    if (!result.valid) {
      setErrorMsg(result.error);
      inputRef.current?.focus();
      return;
    }
    setErrorMsg(null);
    setDraftName(result.normalized);
    nextAction(result.normalized);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    tryValidateAndProceed(onPlay);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = sanitizeUsernameInput(e.target.value);
    setDraftName(clean);
    if (errorMsg) {
      const check = validateUsername(clean);
      if (check.valid || clean.trim().length >= MIN_USERNAME_LENGTH) {
        setErrorMsg(null);
      }
    }
  };

  const handleClearName = () => {
    setDraftName('');
    setErrorMsg(null);
    inputRef.current?.focus();
  };

  const trimmedLen = draftName.trim().length;

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-between overflow-x-hidden overflow-y-auto bg-gradient-to-b from-[#070B11]/82 via-[#0B0F14]/74 to-[#070B11]/92 px-3.5 pt-[max(0.85rem,env(safe-area-inset-top))] pb-[max(0.85rem,env(safe-area-inset-bottom))] backdrop-blur-[2px] sm:p-8">
      {/* Top Bar */}
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 sm:gap-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border-2 border-white/80 bg-black sm:h-9 sm:w-9">
            <img
              src={COIN_IMAGE_PATH}
              alt="EarnOS Logo"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
          </div>
          <span className="font-display text-base font-bold tracking-tight text-white whitespace-nowrap sm:text-lg">
            EarnOS
          </span>
          <span className="hidden text-xs text-slate-400 whitespace-nowrap min-[380px]:inline sm:text-sm">
            @earnos_io
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 overflow-hidden rounded-full border border-white/70 bg-black">
              <img
                src={COIN_IMAGE_PATH}
                alt="EarnOS Coin"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            </div>
            <span className="font-mono text-sm font-bold text-slate-100 tabular-nums whitespace-nowrap">
              {totalCoinsBanked}
            </span>
          </div>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-slate-900/80 text-slate-200 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-400"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* Center Player Profile Card */}
      <main className="mx-auto my-3 flex w-full max-w-lg flex-col items-center text-center sm:my-4">
        <div className="mb-2 flex items-center justify-center sm:mb-4">
          <div className="relative h-20 w-20 sm:h-32 sm:w-32">
            <img
              src={frogSrc}
              alt="EarnOS Frog Mascot"
              referrerPolicy="no-referrer"
              className="h-full w-full object-contain drop-shadow-[0_14px_26px_rgba(0,0,0,0.65)]"
            />
          </div>
        </div>

        <h1 className="font-display text-2xl font-black tracking-tight text-white text-balance min-[380px]:text-3xl sm:text-5xl">
          EarnOS Bike Rush
        </h1>
        <p className="mt-1.5 max-w-md text-xs leading-relaxed text-slate-300 sm:mt-2 sm:text-sm">
          {savedUsername
            ? `Welcome back, ${savedUsername}! Ready to hit the tracks?`
            : 'Create your rider profile to race across all 6 tracks.'}
        </p>

        {/* Player Profile Form */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="mt-5 w-full rounded-2xl border border-white/15 bg-[#0B0F14]/88 p-4 text-left shadow-2xl backdrop-blur-md sm:mt-6 sm:p-6"
        >
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="player-username-input"
              className="font-display text-sm font-bold text-emerald-400 sm:text-base"
            >
              Player Profile
            </label>
            <span className="font-mono text-xs text-slate-400 tabular-nums">
              {trimmedLen}/{MAX_USERNAME_LENGTH} chars
            </span>
          </div>

          <div className="relative mt-2.5">
            <User
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-slate-400"
            />
            <input
              ref={inputRef}
              id="player-username-input"
              type="text"
              value={draftName}
              onChange={handleInputChange}
              placeholder="Enter Your Username"
              maxLength={MAX_USERNAME_LENGTH}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              aria-invalid={Boolean(errorMsg)}
              aria-describedby={errorMsg ? 'username-error-text' : 'username-help-text'}
              className={`h-14 w-full rounded-xl border-2 bg-slate-950/90 pr-11 pl-11 font-display text-base font-bold text-white placeholder:font-medium placeholder:text-slate-500 focus:outline-none sm:text-lg ${
                errorMsg
                  ? 'border-rose-400 focus:border-rose-300'
                  : 'border-white/20 focus:border-[#16C768]'
              }`}
            />
            {draftName.length > 0 && (
              <button
                type="button"
                onClick={handleClearName}
                aria-label="Clear username"
                className="absolute top-1/2 right-2.5 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {errorMsg ? (
            <div
              id="username-error-text"
              role="alert"
              className="mt-2.5 flex items-center gap-2 text-xs font-semibold text-rose-400 sm:text-sm"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          ) : (
            <p
              id="username-help-text"
              className="mt-2 text-xs text-slate-400"
            >
              Use {MIN_USERNAME_LENGTH} to {MAX_USERNAME_LENGTH} characters. Saved on this device.
            </p>
          )}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              className="flex min-h-[60px] flex-1 items-center justify-center gap-3 rounded-2xl bg-[#16C768] px-7 py-3.5 font-display text-xl font-black tracking-wide text-slate-950 shadow-xl shadow-emerald-500/35 transition-transform hover:bg-emerald-400 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-white whitespace-nowrap"
            >
              <Play className="h-6 w-6 fill-current" />
              PLAY
            </button>

            <button
              type="button"
              onClick={() => tryValidateAndProceed(onOpenLevels)}
              className="flex min-h-[56px] items-center justify-center gap-2.5 rounded-2xl border border-white/15 bg-slate-900 px-5 py-3.5 font-display text-base font-semibold text-white transition-colors hover:bg-slate-800 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-emerald-400 whitespace-nowrap sm:min-w-[165px]"
            >
              <Map className="h-5 w-5 text-emerald-400" />
              Select Level
            </button>
          </div>
        </form>
      </main>

      {/* Bottom Controls Hint */}
      <footer className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-400">
        <span>Accelerate: W / ↑</span>
        <span aria-hidden="true">·</span>
        <span>Brake: S / ↓</span>
        <span aria-hidden="true">·</span>
        <span>Air Tilt: A / D or ← / →</span>
        <span aria-hidden="true">·</span>
        <span>Touch buttons supported on Android</span>
      </footer>
    </div>
  );
};
