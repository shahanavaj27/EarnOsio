export type GameScreen =
  | 'TITLE'
  | 'LEVEL_SELECT'
  | 'READY'
  | 'PLAYING'
  | 'PAUSED'
  | 'CRASHED'
  | 'VICTORY';

export type DifficultyLabel =
  | 'Very Easy'
  | 'Easy'
  | 'Medium'
  | 'Challenging'
  | 'Hard'
  | 'Expert';

export interface InputState {
  gas: boolean;
  brake: boolean;
  leanBack: boolean;
  leanForward: boolean;
  jump: boolean;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface TerrainSegment {
  points: Vec2[];
}

export interface RampPlatform {
  id: string;
  p1: Vec2;
  p2: Vec2;
  thickness: number;
  boost?: number;
  style: 'wood' | 'steel' | 'bridge';
}

export interface CoinItem {
  id: number;
  x: number;
  y: number;
  radius: number;
  isSpecial?: boolean;
  collected: boolean;
  collectAnim: number; // 0 -> 1 after collection
}

export interface MovingObstacle {
  id: string;
  kind: 'drone' | 'barrier' | 'crusher' | 'saw';
  baseX: number;
  baseY: number;
  axis: 'x' | 'y' | 'circle';
  amplitude: number;
  speed: number;
  phase: number;
  radius: number;
  width?: number;
  height?: number;
  x: number;
  y: number;
}

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export interface BiomePalette {
  timeOfDay: TimeOfDay;
  environmentLabel: string;
  skyTop: string;
  skyBottom: string;
  skyHorizon: string;
  sunColor: string;
  sunGlow: string;
  cloudColor: string;
  mistColor: string;
  farHill: string;
  midHill: string;
  hillBase: string;
  mountainLit: string;
  mountainShade: string;
  foliageLit: string;
  foliageShade: string;
  waterTop: string;
  waterDeep: string;
  cliffEarthTop: string;
  cliffEarthBottom: string;
  groundFillTop: string;
  groundFillBottom: string;
  groundCap: string;
  groundRim: string;
  accent: string;
  starsAlpha: number;
}

export interface LevelConfig {
  id: number;
  name: string;
  subtitle: string;
  difficulty: DifficultyLabel;
  lengthMeters: number;
  startX: number;
  startY: number;
  finishX: number;
  deathY: number;
  gravity: number;
  maxSpeed: number;
  accel: number;
  palette: BiomePalette;
  terrainSegments: TerrainSegment[];
  ramps: RampPlatform[];
  coins: Omit<CoinItem, 'collected' | 'collectAnim'>[];
  obstacles: Omit<MovingObstacle, 'x' | 'y'>[];
}

export interface BikeState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  angularVel: number;
  wheelAngle: number;
  rearGrounded: boolean;
  frontGrounded: boolean;
  rearCompression: number;
  frontCompression: number;
  airTime: number;
  accumulatedFlipAngle: number;
  flipsCompleted: number;
  crashed: boolean;
  crashTimer: number;
  finished: boolean;
  boostTimer: number;
  riderLean: number;
  riderBobY: number;
  headTilt: number;
  isReversing: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
  kind: 'dust' | 'exhaust' | 'spark' | 'coin' | 'confetti';
}

export interface FloatingPopup {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  isSpecial?: boolean;
}

export interface HudSnapshot {
  distanceMeters: number;
  totalMeters: number;
  coinsCollected: number;
  totalCoins: number;
  score: number;
  elapsedSeconds: number;
  speedKmh: number;
  flips: number;
  isReversing: boolean;
}

export interface LevelRecord {
  completed: boolean;
  bestCoins: number;
  totalCoins: number;
  bestScore?: number;
  bestTime: number | null;
  stars: number;
}

export interface GameProgress {
  username: string;
  unlockedLevel: number;
  unlockAll: boolean;
  totalBankCoins: number;
  muted: boolean;
  records: Record<number, LevelRecord>;
}
