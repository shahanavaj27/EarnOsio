import { getTerrainHeightAt } from './levels';
import { LevelConfig, TerrainSegment } from './types';

export interface RoadsideBoard {
  id: string;
  x: number;
  y: number;
  slope: number;
  width: number;
  height: number;
  variant: number;
}

const boardCache = new Map<number, RoadsideBoard[]>();

function isPointOnTerrain(segments: TerrainSegment[], x: number): boolean {
  return getTerrainHeightAt(segments, x) !== null;
}

function getSlopeAt(segments: TerrainSegment[], x: number): number {
  const yL = getTerrainHeightAt(segments, x - 26);
  const yR = getTerrainHeightAt(segments, x + 26);
  if (yL === null || yR === null) return 0;
  return Math.max(-0.32, Math.min(0.32, Math.atan2(yR - yL, 52)));
}

export function getRoadsideBoardsForLevel(level: LevelConfig): RoadsideBoard[] {
  const cached = boardCache.get(level.id);
  if (cached) return cached;

  const boards: RoadsideBoard[] = [];
  const trackSpan = level.finishX - level.startX;
  const targetFractions = [0.14, 0.5, 0.84];

  const isValidSpot = (x: number) => {
    if (x > level.startX - 165 && x < level.startX + 195) return false;
    if (x > level.finishX - 135 && x < level.finishX + 205) return false;
    if (level.obstacles.some((o) => Math.abs(x - o.baseX) < 130)) return false;
    return (
      isPointOnTerrain(level.terrainSegments, x - 45) &&
      isPointOnTerrain(level.terrainSegments, x) &&
      isPointOnTerrain(level.terrainSegments, x + 45)
    );
  };

  targetFractions.forEach((frac, idx) => {
    const baseX = Math.round(level.startX + trackSpan * frac);
    let chosenX: number | null = null;

    for (let offset = 0; offset <= 650; offset += 40) {
      const candidates = offset === 0 ? [baseX] : [baseX + offset, baseX - offset];
      for (const cx of candidates) {
        if (isValidSpot(cx)) {
          chosenX = cx;
          break;
        }
      }
      if (chosenX !== null) break;
    }

    if (chosenX !== null) {
      const groundY = getTerrainHeightAt(level.terrainSegments, chosenX);
      if (groundY !== null) {
        boards.push({
          id: `l${level.id}-sb-${idx + 1}`,
          x: chosenX,
          y: groundY - 16,
          slope: getSlopeAt(level.terrainSegments, chosenX) * 0.25,
          width: 144,
          height: 64,
          variant: idx + 1,
        });
      }
    }
  });

  boardCache.set(level.id, boards);
  return boards;
}
