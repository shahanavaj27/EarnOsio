import { getRoadsideBoardsForLevel } from './boards';
import { getTerrainHeightAt } from './levels';
import { LevelConfig, TerrainSegment } from './types';

export interface LandscapeProp {
  id: string;
  kind: 'pine' | 'canopy_tree' | 'rock' | 'night_lamp';
  x: number;
  y: number;
  scale: number;
  variant: number;
}

export interface RiverWaterfall {
  id: string;
  x1: number;
  x2: number;
  waterY: number;
  fallX: number;
  fallTopY: number;
  fallWidth: number;
  secondaryFallX?: number;
  secondaryFallTopY?: number;
}

export interface TunnelLandmark {
  id: string;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  archHeight: number;
}

export interface ScenicBridge {
  id: string;
  x1: number;
  x2: number;
  deckY: number;
  archCount: number;
  style: 'stone' | 'steel';
}

export interface LevelEnvironmentProps {
  props: LandscapeProp[];
  rivers: RiverWaterfall[];
  tunnels: TunnelLandmark[];
  bridges: ScenicBridge[];
}

const envCache = new Map<number, LevelEnvironmentProps>();

function hasGroundBand(
  segments: TerrainSegment[],
  x: number,
  halfSpan = 34
): boolean {
  return (
    getTerrainHeightAt(segments, x - halfSpan) !== null &&
    getTerrainHeightAt(segments, x) !== null &&
    getTerrainHeightAt(segments, x + halfSpan) !== null
  );
}

export function getEnvironmentForLevel(level: LevelConfig): LevelEnvironmentProps {
  const cached = envCache.get(level.id);
  if (cached) return cached;

  const props: LandscapeProp[] = [];
  const rivers: RiverWaterfall[] = [];
  const tunnels: TunnelLandmark[] = [];
  const bridges: ScenicBridge[] = [];
  const boards = getRoadsideBoardsForLevel(level);
  let seq = 1;

  const isOverRamp = (x1: number, x2: number) =>
    level.ramps.some((r) => {
      const rx1 = Math.min(r.p1.x, r.p2.x) - 90;
      const rx2 = Math.max(r.p1.x, r.p2.x) + 90;
      return x2 >= rx1 && x1 <= rx2;
    });

  // 1. Place 1–2 dramatic 3D Mountain Tunnels on clean non-ramp, non-board hillside stretches
  const tunnelWidth = 290;
  const tunnelCandidates = [0.09, 0.24, 0.38, 0.60, 0.74, 0.89];

  for (let ti = 0; ti < tunnelCandidates.length && tunnels.length < 2; ti++) {
    const baseX = Math.round(
      level.startX + (level.finishX - level.startX) * tunnelCandidates[ti]
    );
    for (let off = 0; off <= 560; off += 50) {
      const xs = off === 0 ? [baseX] : [baseX + off, baseX - off];
      let placed = false;
      for (const cx of xs) {
        const x1 = cx - tunnelWidth * 0.5;
        const x2 = cx + tunnelWidth * 0.5;
        if (x1 < level.startX + 210 || x2 > level.finishX - 210) continue;
        if (tunnels.some((t) => Math.abs((t.x1 + t.x2) * 0.5 - cx) < 1600)) continue;
        if (boards.some((b) => b.x >= x1 - 140 && b.x <= x2 + 140)) continue;
        if (level.obstacles.some((o) => o.baseX >= x1 - 120 && o.baseX <= x2 + 120)) continue;
        if (isOverRamp(x1, x2)) continue;
        if (!hasGroundBand(level.terrainSegments, cx, tunnelWidth * 0.5 + 35)) continue;

        const y1 = getTerrainHeightAt(level.terrainSegments, x1);
        const y2 = getTerrainHeightAt(level.terrainSegments, x2);
        const yMid = getTerrainHeightAt(level.terrainSegments, cx);
        if (y1 === null || y2 === null || yMid === null) continue;
        if (Math.abs(y2 - y1) > 105) continue;

        tunnels.push({
          id: `l${level.id}-tun-${tunnels.length + 1}`,
          x1,
          x2,
          y1,
          y2,
          archHeight: 235,
        });
        placed = true;
        break;
      }
      if (placed) break;
    }
  }

  const isInsideTunnel = (x: number, pad = 95) =>
    tunnels.some((t) => x >= t.x1 - pad && x <= t.x2 + pad);

  const isClearX = (x: number, minBoardGap = 135) => {
    if (x > level.startX - 180 && x < level.startX + 200) return false;
    if (x > level.finishX - 150 && x < level.finishX + 220) return false;
    if (boards.some((b) => Math.abs(x - b.x) < minBoardGap)) return false;
    if (level.obstacles.some((o) => Math.abs(x - o.baseX) < 110)) return false;
    if (isInsideTunnel(x, 85)) return false;
    return hasGroundBand(level.terrainSegments, x);
  };

  // 2. Lush trackside forests (single trees + 2-tree woodland clusters) & faceted 3D boulders
  const treeStep = level.palette.timeOfDay === 'evening' ? 350 : 290;
  for (let x = level.startX + 290; x < level.finishX - 230; x += treeStep) {
    const jitter = ((seq * 67) % 80) - 40;
    const px = x + jitter;
    if (!isClearX(px)) continue;
    const gy = getTerrainHeightAt(level.terrainSegments, px);
    if (gy === null) continue;

    const isPine =
      level.id === 1 || level.id === 2 || level.id === 5 || seq % 2 === 0;
    props.push({
      id: `l${level.id}-tr-${seq}`,
      kind: isPine ? 'pine' : 'canopy_tree',
      x: px,
      y: gy - 18,
      scale: 0.92 + ((seq * 19) % 34) / 100,
      variant: seq,
    });

    // Companion forest tree on clear slopes to build genuine woodland groups
    const compX = px + (seq % 2 === 0 ? 64 : -64);
    if (seq % 3 !== 0 && isClearX(compX, 130)) {
      const cgy = getTerrainHeightAt(level.terrainSegments, compX);
      if (cgy !== null) {
        props.push({
          id: `l${level.id}-trc-${seq}`,
          kind: isPine && seq % 2 === 0 ? 'pine' : 'canopy_tree',
          x: compX,
          y: cgy - 22,
          scale: 0.72 + ((seq * 23) % 24) / 100,
          variant: seq + 7,
        });
      }
    }

    // Occasional faceted 3D boulder near forest base
    if (seq % 2 === 1 && isClearX(px + 96, 125)) {
      const rgy = getTerrainHeightAt(level.terrainSegments, px + 96);
      if (rgy !== null) {
        props.push({
          id: `l${level.id}-rk-${seq}`,
          kind: 'rock',
          x: px + 96,
          y: rgy - 16,
          scale: 0.85 + ((seq * 13) % 32) / 100,
          variant: seq,
        });
      }
    }
    seq++;
  }

  // 3. Night racing trackside glowing neon-green lamps on Night levels
  if (level.palette.timeOfDay === 'night') {
    for (let x = level.startX + 250; x < level.finishX - 180; x += 480) {
      if (!isClearX(x, 125)) continue;
      const gy = getTerrainHeightAt(level.terrainSegments, x);
      if (gy === null) continue;
      props.push({
        id: `l${level.id}-nl-${seq++}`,
        kind: 'night_lamp',
        x,
        y: gy - 18,
        scale: 1,
        variant: seq,
      });
    }
  }

  // 4. Deep blue rivers & waterfalls in canyon gaps (Levels 2–6) + scenic river/bridge valley on Level 1
  for (let i = 0; i < level.terrainSegments.length - 1; i++) {
    const leftPts = level.terrainSegments[i].points;
    const rightPts = level.terrainSegments[i + 1].points;
    if (!leftPts.length || !rightPts.length) continue;

    const gapStart = leftPts[leftPts.length - 1];
    const gapEnd = rightPts[0];
    const waterY = Math.max(gapStart.y, gapEnd.y) + 178;
    const isLeftFall = i % 2 === 0;
    const fallX = isLeftFall ? gapStart.x + 18 : gapEnd.x - 18;
    const fallTopY = (isLeftFall ? gapStart.y : gapEnd.y) + 22;

    rivers.push({
      id: `l${level.id}-rv-${i + 1}`,
      x1: gapStart.x - 52,
      x2: gapEnd.x + 52,
      waterY,
      fallX,
      fallTopY,
      fallWidth: 38,
      secondaryFallX: isLeftFall ? gapEnd.x - 24 : gapStart.x + 24,
      secondaryFallTopY: (isLeftFall ? gapEnd.y : gapStart.y) + 34,
    });

    // Background steel/stone scenic bridge arch behind each canyon river chasm
    bridges.push({
      id: `l${level.id}-br-${i + 1}`,
      x1: gapStart.x - 36,
      x2: gapEnd.x + 36,
      deckY: Math.min(gapStart.y, gapEnd.y) + 46,
      archCount: 2,
      style: level.palette.timeOfDay === 'night' || level.id >= 4 ? 'steel' : 'stone',
    });
  }

  // Add a scenic background stone arch bridge on Level 1 too (no gaps on Level 1 terrain)
  if (rivers.length === 0) {
    const midX = Math.round((level.startX + level.finishX) * 0.56);
    const midY = getTerrainHeightAt(level.terrainSegments, midX) ?? 420;
    bridges.push({
      id: `l${level.id}-br-valley`,
      x1: midX - 240,
      x2: midX + 240,
      deckY: midY + 42,
      archCount: 3,
      style: 'stone',
    });
  }

  const out = { props, rivers, tunnels, bridges };
  envCache.set(level.id, out);
  return out;
}
