import {
  LevelConfig,
  RampPlatform,
  TerrainSegment,
  Vec2,
  MovingObstacle,
} from './types';

const PIXELS_PER_METER = 64;
const COIN_RADIUS = 34; // 2x larger EarnOS coins
const SPECIAL_COIN_RADIUS = 48; // Bigger golden-bordered neon-glow 10-point EarnOS coin

type CoinSeed = {
  id: number;
  x: number;
  y: number;
  radius: number;
  isSpecial?: boolean;
};

function cosineInterp(a: number, b: number, t: number): number {
  const mu = (1 - Math.cos(t * Math.PI)) * 0.5;
  return a * (1 - mu) + b * mu;
}

function buildSmoothTerrain(anchors: Vec2[], step = 42): Vec2[] {
  if (anchors.length < 2) return anchors;
  const result: Vec2[] = [];
  for (let i = 0; i < anchors.length - 1; i++) {
    const p0 = anchors[i];
    const p1 = anchors[i + 1];
    const dx = p1.x - p0.x;
    const steps = Math.max(2, Math.round(dx / step));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      result.push({
        x: p0.x + dx * t,
        y: cosineInterp(p0.y, p1.y, t),
      });
    }
  }
  result.push(anchors[anchors.length - 1]);
  return result;
}

export function getTerrainHeightAt(
  segments: TerrainSegment[],
  x: number
): number | null {
  for (const seg of segments) {
    const pts = seg.points;
    if (pts.length < 2) continue;
    if (x < pts[0].x || x > pts[pts.length - 1].x) continue;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      if (x >= a.x && x <= b.x) {
        const span = b.x - a.x || 1;
        const t = (x - a.x) / span;
        return a.y + (b.y - a.y) * t;
      }
    }
  }
  return null;
}

function addCoinTrail(
  coins: CoinSeed[],
  segments: TerrainSegment[],
  startX: number,
  endX: number,
  count: number,
  heightAbove = 115
) {
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const x = startX + (endX - startX) * t;
    const gy = getTerrainHeightAt(segments, x);
    if (gy !== null) {
      coins.push({
        id: coins.length + 1,
        x,
        y: gy - heightAbove,
        radius: COIN_RADIUS,
      });
    }
  }
}

function addCoinArc(
  coins: CoinSeed[],
  startX: number,
  endX: number,
  baseY: number,
  arcHeight: number,
  count: number,
  specialCenter = false
) {
  const centerIdx = Math.floor(count / 2);
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const x = startX + (endX - startX) * t;
    const parabola = 4 * t * (1 - t);
    const y = baseY - parabola * arcHeight;
    const isSpecial = specialCenter && i === centerIdx;
    coins.push({
      id: coins.length + 1,
      x,
      y,
      radius: isSpecial ? SPECIAL_COIN_RADIUS : COIN_RADIUS,
      isSpecial: isSpecial || undefined,
    });
  }
}

function createLevel1(): LevelConfig {
  const seg1 = buildSmoothTerrain([
    { x: -450, y: 420 },
    { x: 0, y: 420 },
    { x: 640, y: 420 },
    { x: 1120, y: 315 },
    { x: 1620, y: 435 },
    { x: 2200, y: 345 },
    { x: 2760, y: 455 },
    { x: 3360, y: 325 },
    { x: 3960, y: 445 },
    { x: 4620, y: 335 },
    { x: 5280, y: 450 },
    { x: 5880, y: 400 },
    { x: 6550, y: 420 },
    { x: 7400, y: 420 },
  ]);

  const segments: TerrainSegment[] = [{ points: seg1 }];

  const ramps: RampPlatform[] = [
    {
      id: 'l1-r1',
      p1: { x: 1700, y: 428 },
      p2: { x: 2020, y: 315 },
      thickness: 34,
      style: 'wood',
    },
    {
      id: 'l1-r2',
      p1: { x: 3980, y: 442 },
      p2: { x: 4320, y: 315 },
      thickness: 34,
      boost: 1.15,
      style: 'steel',
    },
    {
      id: 'l1-r3',
      p1: { x: 5340, y: 445 },
      p2: { x: 5640, y: 345 },
      thickness: 34,
      style: 'wood',
    },
  ];

  const coins: CoinSeed[] = [];
  addCoinTrail(coins, segments, 740, 1280, 4, 118);
  addCoinArc(coins, 1960, 2480, 310, 175, 5, true);
  addCoinTrail(coins, segments, 2940, 3480, 4, 118);
  addCoinArc(coins, 4260, 4840, 310, 195, 5, true);
  addCoinArc(coins, 5590, 6080, 340, 155, 4);

  return {
    id: 1,
    name: 'Meadow Warmup',
    subtitle: 'Gentle hills and wide starter launch ramps',
    difficulty: 'Very Easy',
    lengthMeters: Math.round((6350 - 240) / PIXELS_PER_METER),
    startX: 240,
    startY: 325,
    finishX: 6350,
    deathY: 1280,
    gravity: 1140,
    maxSpeed: 800,
    accel: 860,
    palette: {
      timeOfDay: 'morning',
      environmentLabel: 'Morning Sunrise',
      skyTop: '#1D4ED8',
      skyBottom: '#60A5FA',
      skyHorizon: '#FDE68A',
      sunColor: '#FDE047',
      sunGlow: 'rgba(251, 191, 36, 0.36)',
      cloudColor: 'rgba(255, 255, 255, 0.94)',
      mistColor: 'rgba(254, 249, 195, 0.28)',
      farHill: '#2E7D5B',
      midHill: '#16A34A',
      hillBase: '#065F46',
      mountainLit: '#3B82A6',
      mountainShade: '#1D4E6E',
      foliageLit: '#22C55E',
      foliageShade: '#14532D',
      waterTop: '#38BDF8',
      waterDeep: '#0369A1',
      cliffEarthTop: '#3F2E21',
      cliffEarthBottom: '#1C140F',
      groundFillTop: '#332924',
      groundFillBottom: '#171311',
      groundCap: '#16C768',
      groundRim: '#4ADE80',
      accent: '#16C768',
      starsAlpha: 0,
    },
    terrainSegments: segments,
    ramps,
    coins,
    obstacles: [],
  };
}

function createLevel2(): LevelConfig {
  const seg1 = buildSmoothTerrain([
    { x: -450, y: 420 },
    { x: 600, y: 420 },
    { x: 1120, y: 290 },
    { x: 1700, y: 460 },
    { x: 2340, y: 315 },
    { x: 2960, y: 475 },
    { x: 3560, y: 395 },
  ]);

  // Gap 1: 3560 -> 3860 (300px jump off boost ramp)
  const seg2 = buildSmoothTerrain([
    { x: 3860, y: 440 },
    { x: 4400, y: 495 },
    { x: 5000, y: 335 },
    { x: 5620, y: 475 },
    { x: 6300, y: 385 },
    { x: 7050, y: 420 },
    { x: 7850, y: 420 },
  ]);

  const segments: TerrainSegment[] = [{ points: seg1 }, { points: seg2 }];

  const ramps: RampPlatform[] = [
    {
      id: 'l2-r1',
      p1: { x: 1780, y: 452 },
      p2: { x: 2120, y: 300 },
      thickness: 34,
      style: 'wood',
    },
    {
      id: 'l2-r2',
      p1: { x: 3200, y: 440 },
      p2: { x: 3570, y: 320 },
      thickness: 36,
      boost: 1.2,
      style: 'steel',
    },
    {
      id: 'l2-r3',
      p1: { x: 5680, y: 468 },
      p2: { x: 6040, y: 325 },
      thickness: 36,
      boost: 1.15,
      style: 'steel',
    },
  ];

  const coins: CoinSeed[] = [];
  addCoinTrail(coins, segments, 820, 1340, 4, 118);
  addCoinArc(coins, 2060, 2620, 295, 200, 5);
  addCoinArc(coins, 3480, 4080, 315, 215, 5, true);
  addCoinTrail(coins, segments, 4560, 5140, 4, 118);
  addCoinArc(coins, 5980, 6560, 320, 205, 5, true);

  return {
    id: 2,
    name: 'Sunlit Ridge',
    subtitle: 'Bigger wave hills and your first canyon gap',
    difficulty: 'Easy',
    lengthMeters: Math.round((6900 - 240) / PIXELS_PER_METER),
    startX: 240,
    startY: 325,
    finishX: 6900,
    deathY: 1320,
    gravity: 1160,
    maxSpeed: 845,
    accel: 900,
    palette: {
      timeOfDay: 'afternoon',
      environmentLabel: 'Bright Afternoon',
      skyTop: '#0284C7',
      skyBottom: '#38BDF8',
      skyHorizon: '#E0F2FE',
      sunColor: '#FDE047',
      sunGlow: 'rgba(251, 146, 60, 0.34)',
      cloudColor: 'rgba(255, 255, 255, 0.96)',
      mistColor: 'rgba(224, 242, 254, 0.14)',
      farHill: '#1D6B68',
      midHill: '#16A34A',
      hillBase: '#14532D',
      mountainLit: '#4B89A6',
      mountainShade: '#1E4E68',
      foliageLit: '#22C55E',
      foliageShade: '#166534',
      waterTop: '#0EA5E9',
      waterDeep: '#075985',
      cliffEarthTop: '#475569',
      cliffEarthBottom: '#1E293B',
      groundFillTop: '#334155',
      groundFillBottom: '#141B26',
      groundCap: '#22C55E',
      groundRim: '#86EFAC',
      accent: '#22C55E',
      starsAlpha: 0,
    },
    terrainSegments: segments,
    ramps,
    coins,
    obstacles: [],
  };
}

function createLevel3(): LevelConfig {
  const seg1 = buildSmoothTerrain([
    { x: -450, y: 420 },
    { x: 600, y: 420 },
    { x: 1160, y: 310 },
    { x: 1760, y: 475 },
    { x: 2180, y: 430 },
  ]);

  // Gap 1: 2180 -> 2540 (360px)
  const seg2 = buildSmoothTerrain([
    { x: 2540, y: 455 },
    { x: 3080, y: 525 },
    { x: 3680, y: 350 },
    { x: 4200, y: 435 },
  ]);

  // Gap 2: 4200 -> 4600 (400px)
  const seg3 = buildSmoothTerrain([
    { x: 4600, y: 470 },
    { x: 5160, y: 530 },
    { x: 5740, y: 360 },
    { x: 6260, y: 440 },
  ]);

  // Gap 3: 6260 -> 6660 (400px)
  const seg4 = buildSmoothTerrain([
    { x: 6660, y: 475 },
    { x: 7260, y: 495 },
    { x: 7860, y: 405 },
    { x: 8650, y: 420 },
  ]);

  const segments: TerrainSegment[] = [
    { points: seg1 },
    { points: seg2 },
    { points: seg3 },
    { points: seg4 },
  ];

  const ramps: RampPlatform[] = [
    {
      id: 'l3-r1',
      p1: { x: 1800, y: 468 },
      p2: { x: 2190, y: 325 },
      thickness: 36,
      boost: 1.24,
      style: 'steel',
    },
    {
      id: 'l3-r2',
      p1: { x: 3120, y: 515 },
      p2: { x: 3480, y: 335 },
      thickness: 34,
      style: 'wood',
    },
    {
      id: 'l3-r3',
      p1: { x: 3820, y: 385 },
      p2: { x: 4210, y: 300 },
      thickness: 36,
      boost: 1.28,
      style: 'steel',
    },
    {
      id: 'l3-r4',
      p1: { x: 5860, y: 390 },
      p2: { x: 6270, y: 305 },
      thickness: 36,
      boost: 1.28,
      style: 'steel',
    },
  ];

  const coins: CoinSeed[] = [];
  addCoinTrail(coins, segments, 820, 1340, 4, 118);
  addCoinArc(coins, 2100, 2700, 320, 230, 5, true);
  addCoinArc(coins, 3420, 3860, 320, 175, 5, true);
  addCoinArc(coins, 4140, 4760, 295, 240, 5);
  addCoinArc(coins, 6180, 6820, 300, 240, 5, true);
  addCoinTrail(coins, segments, 7040, 7560, 3, 118);

  return {
    id: 3,
    name: 'Canyon Jumps',
    subtitle: 'Boost ramps across deep red-rock chasms',
    difficulty: 'Medium',
    lengthMeters: Math.round((8050 - 240) / PIXELS_PER_METER),
    startX: 240,
    startY: 325,
    finishX: 8050,
    deathY: 1360,
    gravity: 1180,
    maxSpeed: 890,
    accel: 940,
    palette: {
      timeOfDay: 'evening',
      environmentLabel: 'Evening Sunset',
      skyTop: '#31105E',
      skyBottom: '#EA580C',
      skyHorizon: '#FB7185',
      sunColor: '#FED7AA',
      sunGlow: 'rgba(251, 146, 60, 0.45)',
      cloudColor: 'rgba(254, 205, 211, 0.78)',
      mistColor: 'rgba(251, 113, 133, 0.22)',
      farHill: '#6D2849',
      midHill: '#854D32',
      hillBase: '#3B1829',
      mountainLit: '#D97742',
      mountainShade: '#4A1D33',
      foliageLit: '#D97706',
      foliageShade: '#78350F',
      waterTop: '#38BDF8',
      waterDeep: '#1E3A8A',
      cliffEarthTop: '#6B2D26',
      cliffEarthBottom: '#281114',
      groundFillTop: '#4A211F',
      groundFillBottom: '#1B0D10',
      groundCap: '#F97316',
      groundRim: '#FDBA74',
      accent: '#F97316',
      starsAlpha: 0.26,
    },
    terrainSegments: segments,
    ramps,
    coins,
    obstacles: [],
  };
}

function createLevel4(): LevelConfig {
  const seg1 = buildSmoothTerrain([
    { x: -450, y: 420 },
    { x: 560, y: 420 },
    { x: 1120, y: 315 },
    { x: 1700, y: 475 },
    { x: 2320, y: 405 },
  ]);

  // Gap 1: 2320 -> 2700 (380px)
  const seg2 = buildSmoothTerrain([
    { x: 2700, y: 455 },
    { x: 3380, y: 485 },
    { x: 3980, y: 335 },
    { x: 4540, y: 435 },
  ]);

  // Gap 2: 4540 -> 4960 (420px)
  const seg3 = buildSmoothTerrain([
    { x: 4960, y: 475 },
    { x: 5620, y: 495 },
    { x: 6260, y: 355 },
    { x: 6840, y: 435 },
  ]);

  // Gap 3: 6840 -> 7260 (420px)
  const seg4 = buildSmoothTerrain([
    { x: 7260, y: 470 },
    { x: 7980, y: 450 },
    { x: 8680, y: 415 },
    { x: 9400, y: 420 },
  ]);

  const segments: TerrainSegment[] = [
    { points: seg1 },
    { points: seg2 },
    { points: seg3 },
    { points: seg4 },
  ];

  const ramps: RampPlatform[] = [
    {
      id: 'l4-r1',
      p1: { x: 1940, y: 448 },
      p2: { x: 2330, y: 305 },
      thickness: 36,
      boost: 1.28,
      style: 'steel',
    },
    {
      id: 'l4-catwalk',
      p1: { x: 3060, y: 295 },
      p2: { x: 3780, y: 265 },
      thickness: 34,
      style: 'bridge',
    },
    {
      id: 'l4-r2',
      p1: { x: 4160, y: 375 },
      p2: { x: 4550, y: 295 },
      thickness: 36,
      boost: 1.32,
      style: 'steel',
    },
    {
      id: 'l4-r3',
      p1: { x: 6440, y: 385 },
      p2: { x: 6850, y: 290 },
      thickness: 36,
      boost: 1.32,
      style: 'steel',
    },
  ];

  const coins: CoinSeed[] = [];
  addCoinTrail(coins, segments, 800, 1320, 4, 118);
  addCoinArc(coins, 2240, 2860, 295, 240, 5);
  for (let i = 0; i < 4; i++) {
    const isSpecial = i === 2;
    coins.push({
      id: coins.length + 1,
      x: 3150 + i * 180,
      y: 195 - i * 8,
      radius: isSpecial ? SPECIAL_COIN_RADIUS : COIN_RADIUS,
      isSpecial: isSpecial || undefined,
    });
  }
  addCoinArc(coins, 4460, 5120, 285, 250, 5, true);
  addCoinTrail(coins, segments, 5360, 5900, 4, 118);
  addCoinArc(coins, 6760, 7420, 285, 250, 5, true);
  addCoinTrail(coins, segments, 7660, 8160, 3, 118);

  const obstacles: Omit<MovingObstacle, 'x' | 'y'>[] = [
    {
      id: 'l4-obs1',
      kind: 'drone',
      baseX: 1480,
      baseY: 280,
      axis: 'y',
      amplitude: 115,
      speed: 2.1,
      phase: 0,
      radius: 34,
    },
    {
      id: 'l4-obs2',
      kind: 'barrier',
      baseX: 5720,
      baseY: 380,
      axis: 'y',
      amplitude: 95,
      speed: 2.4,
      phase: 1.4,
      radius: 34,
      width: 44,
      height: 92,
    },
    {
      id: 'l4-obs3',
      kind: 'drone',
      baseX: 7840,
      baseY: 325,
      axis: 'x',
      amplitude: 155,
      speed: 2.2,
      phase: 0.7,
      radius: 34,
    },
  ];

  return {
    id: 4,
    name: 'Neon Foundry',
    subtitle: 'Elevated catwalks and patrolling hazard drones',
    difficulty: 'Challenging',
    lengthMeters: Math.round((8700 - 240) / PIXELS_PER_METER),
    startX: 240,
    startY: 325,
    finishX: 8700,
    deathY: 1380,
    gravity: 1190,
    maxSpeed: 925,
    accel: 970,
    palette: {
      timeOfDay: 'night',
      environmentLabel: 'Night Racing',
      skyTop: '#020617',
      skyBottom: '#0F172A',
      skyHorizon: '#0F2F3E',
      sunColor: '#F1F5F9',
      sunGlow: 'rgba(148, 163, 184, 0.28)',
      cloudColor: 'rgba(30, 41, 59, 0.72)',
      mistColor: 'rgba(22, 199, 104, 0.10)',
      farHill: '#0F2537',
      midHill: '#133245',
      hillBase: '#07131E',
      mountainLit: '#1E3A5F',
      mountainShade: '#0B172A',
      foliageLit: '#047857',
      foliageShade: '#022C22',
      waterTop: '#0284C7',
      waterDeep: '#082F49',
      cliffEarthTop: '#1E293B',
      cliffEarthBottom: '#090E16',
      groundFillTop: '#1E293B',
      groundFillBottom: '#090D14',
      groundCap: '#16C768',
      groundRim: '#6EE7B7',
      accent: '#16C768',
      starsAlpha: 0.94,
    },
    terrainSegments: segments,
    ramps,
    coins,
    obstacles,
  };
}

function createLevel5(): LevelConfig {
  const seg1 = buildSmoothTerrain([
    { x: -450, y: 390 },
    { x: 540, y: 390 },
    { x: 1120, y: 545 },
    { x: 1800, y: 660 },
    { x: 2400, y: 505 },
  ]);

  // Gap 1: 2400 -> 2860 (460px mega dive jump)
  const seg2 = buildSmoothTerrain([
    { x: 2860, y: 565 },
    { x: 3460, y: 640 },
    { x: 4100, y: 405 },
    { x: 4680, y: 460 },
  ]);

  // Gap 2: 4680 -> 5140 (460px)
  const seg3 = buildSmoothTerrain([
    { x: 5140, y: 505 },
    { x: 5820, y: 575 },
    { x: 6460, y: 360 },
    { x: 7060, y: 445 },
  ]);

  // Gap 3: 7060 -> 7540 (480px)
  const seg4 = buildSmoothTerrain([
    { x: 7540, y: 495 },
    { x: 8300, y: 545 },
    { x: 8920, y: 410 },
    { x: 9700, y: 420 },
  ]);

  const segments: TerrainSegment[] = [
    { points: seg1 },
    { points: seg2 },
    { points: seg3 },
    { points: seg4 },
  ];

  const ramps: RampPlatform[] = [
    {
      id: 'l5-r1',
      p1: { x: 2010, y: 615 },
      p2: { x: 2410, y: 410 },
      thickness: 38,
      boost: 1.35,
      style: 'steel',
    },
    {
      id: 'l5-r2',
      p1: { x: 4280, y: 425 },
      p2: { x: 4690, y: 305 },
      thickness: 38,
      boost: 1.34,
      style: 'steel',
    },
    {
      id: 'l5-bridge',
      p1: { x: 5540, y: 345 },
      p2: { x: 6260, y: 315 },
      thickness: 34,
      style: 'bridge',
    },
    {
      id: 'l5-r3',
      p1: { x: 6660, y: 390 },
      p2: { x: 7070, y: 285 },
      thickness: 38,
      boost: 1.38,
      style: 'steel',
    },
  ];

  const coins: CoinSeed[] = [];
  addCoinTrail(coins, segments, 820, 1480, 4, 118);
  addCoinArc(coins, 2320, 3020, 400, 280, 5, true);
  addCoinTrail(coins, segments, 3260, 3860, 4, 118);
  addCoinArc(coins, 4600, 5300, 295, 265, 5);
  for (let i = 0; i < 4; i++) {
    const isSpecial = i === 1;
    coins.push({
      id: coins.length + 1,
      x: 5640 + i * 180,
      y: 235 - i * 8,
      radius: isSpecial ? SPECIAL_COIN_RADIUS : COIN_RADIUS,
      isSpecial: isSpecial || undefined,
    });
  }
  addCoinArc(coins, 6980, 7700, 280, 285, 5, true);
  addCoinTrail(coins, segments, 8000, 8600, 3, 118);

  const obstacles: Omit<MovingObstacle, 'x' | 'y'>[] = [
    {
      id: 'l5-obs1',
      kind: 'saw',
      baseX: 1460,
      baseY: 485,
      axis: 'y',
      amplitude: 110,
      speed: 2.5,
      phase: 0,
      radius: 36,
    },
    {
      id: 'l5-obs2',
      kind: 'drone',
      baseX: 3640,
      baseY: 440,
      axis: 'circle',
      amplitude: 92,
      speed: 2.2,
      phase: 1.1,
      radius: 34,
    },
    {
      id: 'l5-obs3',
      kind: 'crusher',
      baseX: 5900,
      baseY: 460,
      axis: 'y',
      amplitude: 105,
      speed: 2.6,
      phase: 0.4,
      radius: 36,
      width: 56,
      height: 66,
    },
    {
      id: 'l5-obs4',
      kind: 'saw',
      baseX: 8300,
      baseY: 430,
      axis: 'x',
      amplitude: 185,
      speed: 2.4,
      phase: 1.9,
      radius: 36,
    },
  ];

  return {
    id: 5,
    name: 'Alpine Rollercoaster',
    subtitle: 'Massive downhill dives and sky-high stunt gaps',
    difficulty: 'Hard',
    lengthMeters: Math.round((9250 - 240) / PIXELS_PER_METER),
    startX: 240,
    startY: 300,
    finishX: 9250,
    deathY: 1420,
    gravity: 1210,
    maxSpeed: 965,
    accel: 1010,
    palette: {
      timeOfDay: 'morning',
      environmentLabel: 'Misty Morning',
      skyTop: '#0F4C81',
      skyBottom: '#60A5FA',
      skyHorizon: '#BAE6FD',
      sunColor: '#FEF9C3',
      sunGlow: 'rgba(253, 224, 71, 0.32)',
      cloudColor: 'rgba(255, 255, 255, 0.94)',
      mistColor: 'rgba(224, 242, 254, 0.26)',
      farHill: '#1E5B70',
      midHill: '#0F766E',
      hillBase: '#064E3B',
      mountainLit: '#38BDF8',
      mountainShade: '#1E3A8A',
      foliageLit: '#10B981',
      foliageShade: '#064E3B',
      waterTop: '#0EA5E9',
      waterDeep: '#0C4A6E',
      cliffEarthTop: '#334155',
      cliffEarthBottom: '#131C28',
      groundFillTop: '#293548',
      groundFillBottom: '#0F1622',
      groundCap: '#38BDF8',
      groundRim: '#BAE6FD',
      accent: '#38BDF8',
      starsAlpha: 0,
    },
    terrainSegments: segments,
    ramps,
    coins,
    obstacles,
  };
}

function createLevel6(): LevelConfig {
  const seg1 = buildSmoothTerrain([
    { x: -450, y: 420 },
    { x: 540, y: 420 },
    { x: 960, y: 325 },
    { x: 1360, y: 465 },
    { x: 1760, y: 325 },
    { x: 2160, y: 475 },
    { x: 2620, y: 405 },
  ]);

  // Gap 1: 2620 -> 3120 (500px)
  const seg2 = buildSmoothTerrain([
    { x: 3120, y: 485 },
    { x: 3740, y: 565 },
    { x: 4380, y: 365 },
    { x: 4960, y: 440 },
  ]);

  // Gap 2: 4960 -> 5460 (500px)
  const seg3 = buildSmoothTerrain([
    { x: 5460, y: 490 },
    { x: 6120, y: 585 },
    { x: 6780, y: 345 },
    { x: 7380, y: 430 },
  ]);

  // Gap 3: 7380 -> 7900 (520px)
  const seg4 = buildSmoothTerrain([
    { x: 7900, y: 485 },
    { x: 8620, y: 515 },
    { x: 9260, y: 395 },
    { x: 10200, y: 420 },
  ]);

  const segments: TerrainSegment[] = [
    { points: seg1 },
    { points: seg2 },
    { points: seg3 },
    { points: seg4 },
  ];

  const ramps: RampPlatform[] = [
    {
      id: 'l6-r1',
      p1: { x: 2230, y: 465 },
      p2: { x: 2630, y: 295 },
      thickness: 38,
      boost: 1.38,
      style: 'steel',
    },
    {
      id: 'l6-sky1',
      p1: { x: 3500, y: 320 },
      p2: { x: 4220, y: 275 },
      thickness: 34,
      style: 'bridge',
    },
    {
      id: 'l6-r2',
      p1: { x: 4560, y: 385 },
      p2: { x: 4970, y: 280 },
      thickness: 38,
      boost: 1.38,
      style: 'steel',
    },
    {
      id: 'l6-r3',
      p1: { x: 6960, y: 375 },
      p2: { x: 7390, y: 265 },
      thickness: 38,
      boost: 1.42,
      style: 'steel',
    },
  ];

  const coins: CoinSeed[] = [];
  addCoinTrail(coins, segments, 760, 1880, 5, 120);
  addCoinArc(coins, 2540, 3260, 290, 285, 5, true);
  for (let i = 0; i < 4; i++) {
    const isSpecial = i === 2;
    coins.push({
      id: coins.length + 1,
      x: 3590 + i * 180,
      y: 205 - i * 10,
      radius: isSpecial ? SPECIAL_COIN_RADIUS : COIN_RADIUS,
      isSpecial: isSpecial || undefined,
    });
  }
  addCoinArc(coins, 4880, 5620, 275, 290, 5);
  addCoinTrail(coins, segments, 5860, 6500, 4, 120);
  addCoinArc(coins, 7300, 8060, 260, 305, 5, true);
  addCoinTrail(coins, segments, 8400, 9120, 4, 118);

  const obstacles: Omit<MovingObstacle, 'x' | 'y'>[] = [
    {
      id: 'l6-obs1',
      kind: 'drone',
      baseX: 1360,
      baseY: 335,
      axis: 'y',
      amplitude: 112,
      speed: 2.6,
      phase: 0,
      radius: 34,
    },
    {
      id: 'l6-obs2',
      kind: 'saw',
      baseX: 3800,
      baseY: 455,
      axis: 'x',
      amplitude: 185,
      speed: 2.5,
      phase: 0.9,
      radius: 36,
    },
    {
      id: 'l6-obs3',
      kind: 'barrier',
      baseX: 6120,
      baseY: 455,
      axis: 'y',
      amplitude: 112,
      speed: 2.8,
      phase: 0.4,
      radius: 34,
      width: 44,
      height: 94,
    },
    {
      id: 'l6-obs4',
      kind: 'drone',
      baseX: 6600,
      baseY: 255,
      axis: 'circle',
      amplitude: 85,
      speed: 2.4,
      phase: 2.0,
      radius: 34,
    },
    {
      id: 'l6-obs5',
      kind: 'crusher',
      baseX: 8650,
      baseY: 390,
      axis: 'y',
      amplitude: 110,
      speed: 2.9,
      phase: 1.2,
      radius: 36,
      width: 56,
      height: 68,
    },
  ];

  return {
    id: 6,
    name: 'EarnOS Summit Finale',
    subtitle: 'High-speed rhythm whoops, sky rails, and champion gaps',
    difficulty: 'Expert',
    lengthMeters: Math.round((9700 - 240) / PIXELS_PER_METER),
    startX: 240,
    startY: 325,
    finishX: 9700,
    deathY: 1450,
    gravity: 1230,
    maxSpeed: 1000,
    accel: 1050,
    palette: {
      timeOfDay: 'night',
      environmentLabel: 'Midnight Finale',
      skyTop: '#020617',
      skyBottom: '#071B24',
      skyHorizon: '#0B3A2E',
      sunColor: '#F1F5F9',
      sunGlow: 'rgba(22, 199, 104, 0.28)',
      cloudColor: 'rgba(15, 34, 45, 0.72)',
      mistColor: 'rgba(22, 199, 104, 0.14)',
      farHill: '#0B242E',
      midHill: '#0F362E',
      hillBase: '#051618',
      mountainLit: '#134E4A',
      mountainShade: '#071B22',
      foliageLit: '#059669',
      foliageShade: '#022C22',
      waterTop: '#0EA5E9',
      waterDeep: '#082F49',
      cliffEarthTop: '#162830',
      cliffEarthBottom: '#070E12',
      groundFillTop: '#162229',
      groundFillBottom: '#070B0E',
      groundCap: '#16C768',
      groundRim: '#A7F3D0',
      accent: '#16C768',
      starsAlpha: 0.96,
    },
    terrainSegments: segments,
    ramps,
    coins,
    obstacles,
  };
}

export const LEVELS: LevelConfig[] = [
  createLevel1(),
  createLevel2(),
  createLevel3(),
  createLevel4(),
  createLevel5(),
  createLevel6(),
];

export { PIXELS_PER_METER };
