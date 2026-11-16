import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { GameHUD } from './components/GameHUD';
import { LevelSelect } from './components/LevelSelect';
import {
  CrashOverlay,
  PauseOverlay,
  ReadyOverlay,
  VictoryOverlay,
} from './components/Overlays';
import { TitleScreen } from './components/TitleScreen';
import { GameAssets, loadGameAssets } from './game/assets';
import { soundEngine } from './game/audio';
import { LEVELS } from './game/levels';
import {
  GameProgress,
  GameScreen,
  HudSnapshot,
  InputState,
} from './game/types';

import { validateUsername } from './game/username';

const STORAGE_KEY = 'earnos_bike_rush_v1';

const DEFAULT_PROGRESS: GameProgress = {
  username: '',
  unlockedLevel: 1,
  unlockAll: false,
  totalBankCoins: 0,
  muted: false,
  records: {},
};

function loadProgress(): GameProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROGRESS;
    const parsed = JSON.parse(raw) as Partial<GameProgress>;
    const savedName = typeof parsed.username === 'string' ? parsed.username.trim().slice(0, 15) : '';
    return {
      username: savedName,
      unlockedLevel: parsed.unlockedLevel ?? 1,
      unlockAll: Boolean(parsed.unlockAll),
      totalBankCoins: parsed.totalBankCoins ?? 0,
      muted: Boolean(parsed.muted),
      records: parsed.records ?? {},
    };
  } catch {
    return DEFAULT_PROGRESS;
  }
}

function saveProgress(progress: GameProgress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Ignore storage quota errors
  }
}

export default function App() {
  const [assets, setAssets] = useState<GameAssets>({
    loaded: false,
    frogCanvas: null,
    frogHeadCanvas: null,
    frogDataUrl: null,
    coinCanvas: null,
    specialCoinCanvas: null,
    rawFrogImg: null,
    rawCoinImg: null,
  });

  const [progress, setProgress] = useState<GameProgress>(() => loadProgress());
  const [screen, setScreen] = useState<GameScreen>('TITLE');
  const [currentLevelId, setCurrentLevelId] = useState<number>(1);
  const [runKey, setRunKey] = useState<number>(1);
  const [lastVictoryStars, setLastVictoryStars] = useState<number>(1);
  const [focusInputSignal, setFocusInputSignal] = useState<number>(0);

  const currentLevel = useMemo(
    () => LEVELS.find((l) => l.id === currentLevelId) || LEVELS[0],
    [currentLevelId]
  );

  const [hud, setHud] = useState<HudSnapshot>({
    distanceMeters: 0,
    totalMeters: currentLevel.lengthMeters,
    coinsCollected: 0,
    totalCoins: currentLevel.coins.length,
    score: 0,
    elapsedSeconds: 0,
    speedKmh: 0,
    flips: 0,
    isReversing: false,
  });

  const inputRef = useRef<InputState>({
    gas: false,
    brake: false,
    leanBack: false,
    leanForward: false,
    jump: false,
  });

  const [uiInput, setUiInput] = useState<InputState>({
    gas: false,
    brake: false,
    leanBack: false,
    leanForward: false,
    jump: false,
  });

  useEffect(() => {
    loadGameAssets().then(setAssets);
  }, []);

  useEffect(() => {
    soundEngine.setMuted(progress.muted);
    saveProgress(progress);
  }, [progress]);

  const clearInputs = useCallback(() => {
    inputRef.current = {
      gas: false,
      brake: false,
      leanBack: false,
      leanForward: false,
      jump: false,
    };
    setUiInput({
      gas: false,
      brake: false,
      leanBack: false,
      leanForward: false,
      jump: false,
    });
  }, []);

  const startLevel = useCallback(
    (levelId: number, overrideUsername?: string) => {
      const check = validateUsername(overrideUsername ?? progress.username);
      if (!check.valid) {
        clearInputs();
        setScreen('TITLE');
        setFocusInputSignal((n) => n + 1);
        return;
      }
      soundEngine.unlock();
      clearInputs();
      setCurrentLevelId(levelId);
      setRunKey((k) => k + 1);
      setScreen('READY');
    },
    [clearInputs, progress.username]
  );

  const restartCurrentLevel = useCallback(() => {
    soundEngine.unlock();
    clearInputs();
    setRunKey((k) => k + 1);
    setScreen('READY');
  }, [clearInputs]);

  const handleStartRace = useCallback(() => {
    soundEngine.unlock();
    clearInputs();
    setScreen('PLAYING');
  }, [clearInputs]);

  const handleOpenProfile = useCallback(() => {
    clearInputs();
    setScreen('TITLE');
    setFocusInputSignal((n) => n + 1);
  }, [clearInputs]);

  const handleControlChange = useCallback(
    (key: keyof InputState, active: boolean) => {
      soundEngine.unlock();
      inputRef.current[key] = active;
      setUiInput((prev) =>
        prev[key] === active ? prev : { ...prev, [key]: active }
      );
    },
    []
  );

  // Keyboard bindings
  useEffect(() => {
    const keyToControl = (code: string): keyof InputState | null => {
      switch (code) {
        case 'ArrowUp':
        case 'KeyW':
          return 'gas';
        case 'ArrowDown':
        case 'KeyS':
          return 'brake';
        case 'ArrowLeft':
        case 'KeyA':
          return 'leanBack';
        case 'ArrowRight':
        case 'KeyD':
          return 'leanForward';
        case 'Space':
          return 'jump';
        default:
          return null;
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement | null)?.tagName;
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA') {
        return;
      }

      if (e.code === 'Space' && screen === 'CRASHED') {
        e.preventDefault();
        restartCurrentLevel();
        return;
      }

      const ctrl = keyToControl(e.code);
      if (ctrl) {
        if (screen === 'PLAYING') {
          e.preventDefault();
          handleControlChange(ctrl, true);
        }
        return;
      }

      if (e.code === 'KeyR') {
        if (screen === 'PLAYING' || screen === 'CRASHED' || screen === 'PAUSED') {
          e.preventDefault();
          restartCurrentLevel();
        }
      } else if (e.code === 'Escape' || e.code === 'KeyP') {
        if (screen === 'PLAYING') {
          e.preventDefault();
          clearInputs();
          setScreen('PAUSED');
        } else if (screen === 'PAUSED') {
          e.preventDefault();
          setScreen('PLAYING');
        }
      } else if (e.code === 'Enter') {
        if (screen === 'CRASHED') {
          e.preventDefault();
          restartCurrentLevel();
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const ctrl = keyToControl(e.code);
      if (ctrl) {
        handleControlChange(ctrl, false);
      }
    };

    const onBlur = () => clearInputs();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [screen, handleControlChange, restartCurrentLevel, clearInputs]);

  const handleToggleMute = useCallback(() => {
    setProgress((prev) => {
      const nextMuted = !prev.muted;
      soundEngine.setMuted(nextMuted);
      if (!nextMuted) soundEngine.unlock();
      return { ...prev, muted: nextMuted };
    });
  }, []);

  const handleCrash = useCallback(
    (snapshot: HudSnapshot) => {
      setHud(snapshot);
      clearInputs();
      // Give a tiny dramatic moment before showing crash overlay
      window.setTimeout(() => {
        setScreen((curr) => (curr === 'PLAYING' ? 'CRASHED' : curr));
      }, 420);
    },
    [clearInputs]
  );

  const handleVictory = useCallback(
    (snapshot: HudSnapshot) => {
      setHud(snapshot);
      clearInputs();
      const coinRatio =
        snapshot.totalCoins > 0
          ? snapshot.coinsCollected / snapshot.totalCoins
          : 1;
      const stars = coinRatio >= 0.85 ? 3 : coinRatio >= 0.45 ? 2 : 1;
      setLastVictoryStars(stars);

      setProgress((prev) => {
        const existing = prev.records[currentLevel.id];
        const prevBestCoins = existing?.bestCoins ?? 0;
        const bestCoins = Math.max(prevBestCoins, snapshot.coinsCollected);
        const bestScore = Math.max(existing?.bestScore ?? 0, snapshot.score);
        const bestTime =
          existing?.bestTime != null
            ? Math.min(existing.bestTime, snapshot.elapsedSeconds)
            : snapshot.elapsedSeconds;
        const bestStars = Math.max(existing?.stars ?? 0, stars);

        return {
          ...prev,
          unlockedLevel: Math.min(
            LEVELS.length,
            Math.max(prev.unlockedLevel, currentLevel.id + 1)
          ),
          totalBankCoins: prev.totalBankCoins + snapshot.coinsCollected,
          records: {
            ...prev.records,
            [currentLevel.id]: {
              completed: true,
              bestCoins,
              totalCoins: snapshot.totalCoins,
              bestScore,
              bestTime,
              stars: bestStars,
            },
          },
        };
      });

      setScreen((curr) => (curr === 'PLAYING' ? 'VICTORY' : curr));
    },
    [clearInputs, currentLevel.id]
  );

  const handlePlayFromTitle = useCallback(
    (username: string) => {
      const check = validateUsername(username);
      if (!check.valid) return;
      soundEngine.unlock();
      setProgress((prev) => ({ ...prev, username: check.normalized }));
      const startId = Math.min(progress.unlockedLevel, LEVELS.length);
      startLevel(startId, check.normalized);
    },
    [progress.unlockedLevel, startLevel]
  );

  const handleOpenLevelsFromTitle = useCallback((username: string) => {
    const check = validateUsername(username);
    if (!check.valid) return;
    soundEngine.unlock();
    setProgress((prev) => ({ ...prev, username: check.normalized }));
    setScreen('LEVEL_SELECT');
  }, []);

  const handleToggleUnlockAll = useCallback(() => {
    setProgress((prev) => ({ ...prev, unlockAll: !prev.unlockAll }));
  }, []);

  const displayUsername = progress.username || 'Player';

  return (
    <div className="fixed inset-0 h-dvh w-full overflow-hidden bg-[#0B0F14] select-none">
      {/* Main 2D Racing Canvas */}
      <GameCanvas
        level={currentLevel}
        screen={screen}
        runKey={runKey}
        assets={assets}
        inputRef={inputRef}
        onHudUpdate={setHud}
        onCrash={handleCrash}
        onVictory={handleVictory}
      />

      {/* Player Profile / Start Screen */}
      {screen === 'TITLE' && (
        <TitleScreen
          assets={assets}
          savedUsername={progress.username}
          totalCoinsBanked={progress.totalBankCoins}
          muted={progress.muted}
          focusInputSignal={focusInputSignal}
          onPlay={handlePlayFromTitle}
          onOpenLevels={handleOpenLevelsFromTitle}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* Level Selection Screen */}
      {screen === 'LEVEL_SELECT' && (
        <LevelSelect
          levels={LEVELS}
          progress={progress}
          onSelectLevel={(id) => startLevel(id)}
          onBack={() => setScreen('TITLE')}
          onChangeUsername={handleOpenProfile}
          onToggleUnlockAll={handleToggleUnlockAll}
        />
      )}

      {/* Pre-Start Ready HUD + Active Gameplay HUD & Touch Controls */}
      {(screen === 'READY' || screen === 'PLAYING') && (
        <GameHUD
          level={currentLevel}
          username={displayUsername}
          hud={hud}
          muted={progress.muted}
          isReady={screen === 'READY'}
          inputState={uiInput}
          onBack={() => {
            clearInputs();
            setScreen('LEVEL_SELECT');
          }}
          onToggleMute={handleToggleMute}
          onRestart={restartCurrentLevel}
          onPause={() => {
            clearInputs();
            setScreen('PAUSED');
          }}
          onControlChange={handleControlChange}
        />
      )}

      {/* Pre-Start Stationary Ready Overlay with Large START Button */}
      {screen === 'READY' && (
        <ReadyOverlay
          level={currentLevel}
          username={displayUsername}
          onStartRace={handleStartRace}
          onLevelSelect={() => {
            clearInputs();
            setScreen('LEVEL_SELECT');
          }}
        />
      )}

      {/* Pause Modal */}
      {screen === 'PAUSED' && (
        <PauseOverlay
          level={currentLevel}
          username={displayUsername}
          muted={progress.muted}
          onResume={() => setScreen('PLAYING')}
          onRestart={restartCurrentLevel}
          onLevelSelect={() => setScreen('LEVEL_SELECT')}
          onChangeUsername={handleOpenProfile}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* Crash Instant Retry Modal */}
      {screen === 'CRASHED' && (
        <CrashOverlay
          level={currentLevel}
          username={displayUsername}
          snapshot={hud}
          onRestart={restartCurrentLevel}
          onLevelSelect={() => setScreen('LEVEL_SELECT')}
        />
      )}

      {/* Victory Finish Screen */}
      {screen === 'VICTORY' && (
        <VictoryOverlay
          level={currentLevel}
          username={displayUsername}
          snapshot={hud}
          starsEarned={lastVictoryStars}
          hasNextLevel={currentLevel.id < LEVELS.length}
          onNextLevel={() => startLevel(currentLevel.id + 1)}
          onReplay={restartCurrentLevel}
          onLevelSelect={() => setScreen('LEVEL_SELECT')}
        />
      )}
    </div>
  );
}
