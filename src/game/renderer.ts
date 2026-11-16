import { GameAssets } from './assets';
import { getRoadsideBoardsForLevel, RoadsideBoard } from './boards';
import {
  getEnvironmentForLevel,
  LandscapeProp,
  RiverWaterfall,
  ScenicBridge,
  TunnelLandmark,
} from './environment';
import {
  WHEEL_BASE_HALF,
  WHEEL_OFFSET_Y,
  WHEEL_RADIUS,
  WorldSim,
} from './physics';
import { getTerrainHeightAt } from './levels';
import { BiomePalette, MovingObstacle, RampPlatform } from './types';

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

export interface CameraFraming {
  isMobilePortrait: boolean;
  isShortLandscape: boolean;
  baseScale: number;
  pivotX: number;
  pivotY: number;
  restLookAhead: number;
  maxSpeedLookAheadBoost: number;
  targetYOffset: number;
}

export function getCameraFraming(
  viewportW: number,
  viewportH: number
): CameraFraming {
  const safeW = Math.max(300, viewportW);
  const safeH = Math.max(280, viewportH);
  const isMobilePortrait = safeW < 640 && safeH >= safeW;
  const isShortLandscape = safeH < 500 && safeW > safeH;

  if (isMobilePortrait) {
    // 65-75% of previous mobile bike/mascot size (~0.50-0.63 zoom)
    // Shows complete bike & mascot uncropped + ~73% ahead for upcoming road & ramps
    const baseScale = Math.max(0.50, Math.min(0.63, safeW / 685));
    const pivotX = safeW * 0.46;
    const pivotY = safeH * 0.48;
    const minBikeScreenX = Math.max(134 * baseScale + 14, safeW * 0.25);
    const restLookAhead = Math.max(95, (pivotX - minBikeScreenX) / baseScale);
    return {
      isMobilePortrait: true,
      isShortLandscape: false,
      baseScale,
      pivotX,
      pivotY,
      restLookAhead,
      maxSpeedLookAheadBoost: 30,
      targetYOffset: 16,
    };
  }

  if (isShortLandscape) {
    const baseScale = Math.max(0.50, Math.min(0.76, safeH / 640));
    const pivotX = safeW * 0.45;
    const pivotY = safeH * 0.40;
    const minBikeScreenX = Math.max(134 * baseScale + 22, safeW * 0.24);
    const restLookAhead = Math.max(135, (pivotX - minBikeScreenX) / baseScale);
    return {
      isMobilePortrait: false,
      isShortLandscape: true,
      baseScale,
      pivotX,
      pivotY,
      restLookAhead,
      maxSpeedLookAheadBoost: 95,
      targetYOffset: 6,
    };
  }

  if (safeW < 960) {
    const baseScale = Math.max(0.76, Math.min(0.98, safeW / 900));
    return {
      isMobilePortrait: false,
      isShortLandscape: false,
      baseScale,
      pivotX: safeW * 0.46,
      pivotY: safeH * 0.50,
      restLookAhead: 175,
      maxSpeedLookAheadBoost: 120,
      targetYOffset: 20,
    };
  }

  const baseScale = Math.max(0.94, Math.min(1.12, safeW / 1220));
  return {
    isMobilePortrait: false,
    isShortLandscape: false,
    baseScale,
    pivotX: safeW * 0.46,
    pivotY: safeH * 0.51,
    restLookAhead: 195,
    maxSpeedLookAheadBoost: 145,
    targetYOffset: 22,
  };
}

export function createInitialCamera(sim: WorldSim): CameraState {
  const viewW = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const viewH = typeof window !== 'undefined' ? window.innerHeight : 720;
  const framing = getCameraFraming(viewW, viewH);
  return {
    x: sim.bike.x + framing.restLookAhead,
    y: sim.bike.y - framing.targetYOffset,
    zoom: framing.baseScale,
  };
}

export function updateCamera(
  cam: CameraState,
  sim: WorldSim,
  viewportW: number,
  viewportH: number,
  dt: number
) {
  const { bike } = sim;
  const speed = Math.hypot(bike.vx, bike.vy);
  const framing = getCameraFraming(viewportW, viewportH);

  const airZoomOut =
    bike.airTime > 0.25 ? Math.min(0.11, bike.airTime * 0.07) : 0;
  const speedZoomOut = Math.min(0.055, (speed / 1000) * 0.05);
  const targetZoom = framing.baseScale * (1 - airZoomOut - speedZoomOut);

  // Place player left-of-center so upcoming road, coins & ramps remain clearly visible ahead
  const speedBoost = Math.min(
    framing.maxSpeedLookAheadBoost,
    Math.max(0, bike.vx) * (framing.isMobilePortrait ? 0.06 : 0.22)
  );
  const worldLookAhead = framing.restLookAhead + speedBoost;

  const targetX = bike.x + worldLookAhead;
  const targetY = bike.y - framing.targetYOffset;

  const smooth = 1 - Math.exp(-7.2 * dt);
  cam.x += (targetX - cam.x) * smooth;
  cam.y += (targetY - cam.y) * smooth;
  cam.zoom += (targetZoom - cam.zoom) * (1 - Math.exp(-4.5 * dt));
}

export function renderGameFrame(
  ctx: CanvasRenderingContext2D,
  sim: WorldSim,
  cam: CameraState,
  assets: GameAssets,
  width: number,
  height: number,
  timeNow: number
) {
  const { level } = sim;
  const { palette } = level;
  const isNight = palette.timeOfDay === 'night';
  const isMorning = palette.timeOfDay === 'morning';
  const isEvening = palette.timeOfDay === 'evening';
  const camParallaxY = Math.max(-45, Math.min(45, (cam.y - 360) * 0.08));

  // 1. 3-Stop Time-of-Day Sky Dome (Morning Sunrise, Afternoon, Evening Sunset, Night)
  const skyGrad = ctx.createLinearGradient(0, 0, 0, height * 0.78);
  skyGrad.addColorStop(0, palette.skyTop);
  skyGrad.addColorStop(0.58, palette.skyBottom);
  skyGrad.addColorStop(1, palette.skyHorizon);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Night Milky Way Band & Twinkling Multi-Scale Stars (Night & Dusk)
  if (palette.starsAlpha > 0) {
    ctx.save();
    if (isNight) {
      const mwGrad = ctx.createLinearGradient(0, 0, width, height * 0.48);
      mwGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
      mwGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.08)');
      mwGrad.addColorStop(1, 'rgba(22, 199, 104, 0)');
      ctx.fillStyle = mwGrad;
      ctx.fillRect(0, 0, width, height * 0.52);
    }
    for (let i = 0; i < 64; i++) {
      const sx = (((i * 197 + 43) % 1000) / 1000) * width;
      const sy = (((i * 311 + 19) % 520) / 1000) * height;
      const twinkle = 0.52 + 0.48 * Math.sin(timeNow * 2.1 + i * 0.7);
      ctx.fillStyle = `rgba(255, 255, 255, ${palette.starsAlpha * twinkle * 0.85})`;
      const r = i % 7 === 0 ? 2.2 : i % 3 === 0 ? 1.5 : 1.0;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  const framing = getCameraFraming(width, height);
  const isMobilePortrait = framing.isMobilePortrait;
  const skyScale = isMobilePortrait ? Math.max(0.68, Math.min(0.86, width / 490)) : 1;

  // 3. Glowing Sun / Shaded 3D Moon, Atmospheric Rays & Two-Layer 3D Clouds
  const sunX = width * (isEvening ? 0.72 : 0.77) - cam.x * 0.008;
  const rawSunY =
    height * (isMorning ? 0.24 : isEvening ? 0.30 : isNight ? 0.18 : 0.19) -
    camParallaxY * 0.25;
  const sunY = isMobilePortrait ? Math.max(122, rawSunY) : rawSunY;

  if (isNight) {
    const horizonGlow = ctx.createLinearGradient(0, height * 0.36, 0, height);
    horizonGlow.addColorStop(0, 'rgba(0, 0, 0, 0)');
    horizonGlow.addColorStop(1, palette.sunGlow);
    ctx.fillStyle = horizonGlow;
    ctx.fillRect(0, height * 0.36, width, height * 0.64);

    const haloR = 185 * skyScale;
    const moonHalo = ctx.createRadialGradient(sunX, sunY, 16 * skyScale, sunX, sunY, haloR);
    moonHalo.addColorStop(0, palette.sunGlow);
    moonHalo.addColorStop(0.45, palette.sunGlow);
    moonHalo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = moonHalo;
    ctx.beginPath();
    ctx.arc(sunX, sunY, haloR, 0, Math.PI * 2);
    ctx.fill();

    const orbRadius = 34 * skyScale;
    const orbGrad = ctx.createRadialGradient(
      sunX - orbRadius * 0.28,
      sunY - orbRadius * 0.28,
      4,
      sunX,
      sunY,
      orbRadius
    );
    orbGrad.addColorStop(0, '#FFFFFF');
    orbGrad.addColorStop(0.58, palette.sunColor);
    orbGrad.addColorStop(1, '#94A3B8');
    ctx.fillStyle = orbGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, orbRadius, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Wide natural sunlight scatter spreading softly across the sky
    const skyLight = ctx.createRadialGradient(
      sunX,
      sunY,
      20,
      sunX,
      sunY,
      Math.max(width, height) * 0.62
    );
    skyLight.addColorStop(
      0,
      isEvening ? 'rgba(251, 146, 60, 0.30)' : 'rgba(254, 240, 138, 0.24)'
    );
    skyLight.addColorStop(
      0.38,
      isEvening
        ? 'rgba(249, 115, 22, 0.16)'
        : palette.timeOfDay === 'afternoon'
          ? 'rgba(251, 146, 60, 0.12)'
          : 'rgba(251, 191, 36, 0.12)'
    );
    skyLight.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = skyLight;
    ctx.fillRect(0, 0, width, height * 0.78);

    // Realistic tapered gradient sunlight rays
    ctx.save();
    const rayAngles = [-0.46, -0.22, 0.0, 0.23, 0.48];
    const rayLen = Math.max(width, height) * 0.95;
    for (let r = 0; r < rayAngles.length; r++) {
      const baseAngle = Math.PI * 0.66 + rayAngles[r];
      const halfSpread = r % 2 === 0 ? 0.055 : 0.038;
      const ex = sunX + Math.cos(baseAngle) * rayLen;
      const ey = sunY + Math.sin(baseAngle) * rayLen;
      const rayGrad = ctx.createLinearGradient(sunX, sunY, ex, ey);
      rayGrad.addColorStop(
        0,
        isEvening ? 'rgba(253, 186, 116, 0.28)' : 'rgba(254, 240, 138, 0.24)'
      );
      rayGrad.addColorStop(
        0.45,
        palette.timeOfDay === 'afternoon'
          ? 'rgba(251, 146, 60, 0.11)'
          : 'rgba(251, 191, 36, 0.09)'
      );
      rayGrad.addColorStop(1, 'rgba(251, 146, 60, 0)');
      ctx.fillStyle = rayGrad;
      ctx.beginPath();
      ctx.moveTo(sunX, sunY);
      ctx.lineTo(
        sunX + Math.cos(baseAngle - halfSpread) * rayLen,
        sunY + Math.sin(baseAngle - halfSpread) * rayLen
      );
      ctx.lineTo(
        sunX + Math.cos(baseAngle + halfSpread) * rayLen,
        sunY + Math.sin(baseAngle + halfSpread) * rayLen
      );
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Soft warm orange & golden outer corona around the Sun
    const coronaR = 230 * skyScale;
    const sunCorona = ctx.createRadialGradient(sunX, sunY, 24 * skyScale, sunX, sunY, coronaR);
    sunCorona.addColorStop(0, 'rgba(253, 224, 71, 0.62)');
    sunCorona.addColorStop(
      0.28,
      palette.timeOfDay === 'afternoon' || isEvening
        ? 'rgba(251, 146, 60, 0.34)'
        : 'rgba(251, 191, 36, 0.30)'
    );
    sunCorona.addColorStop(0.62, 'rgba(249, 115, 22, 0.12)');
    sunCorona.addColorStop(1, 'rgba(249, 115, 22, 0)');
    ctx.fillStyle = sunCorona;
    ctx.beginPath();
    ctx.arc(sunX, sunY, coronaR, 0, Math.PI * 2);
    ctx.fill();

    // Natural 3D glowing golden-yellow Sun sphere (no green outer ring)
    const orbRadius = 45 * skyScale;
    const orbGrad = ctx.createRadialGradient(
      sunX - orbRadius * 0.25,
      sunY - orbRadius * 0.25,
      4,
      sunX,
      sunY,
      orbRadius
    );
    orbGrad.addColorStop(0, '#FFFBEB');
    orbGrad.addColorStop(0.45, '#FDE047');
    orbGrad.addColorStop(0.84, '#F59E0B');
    orbGrad.addColorStop(1, 'rgba(249, 115, 22, 0.92)');
    ctx.fillStyle = orbGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, orbRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  if (isNight) {
    ctx.fillStyle = 'rgba(100, 116, 139, 0.30)';
    ctx.beginPath();
    ctx.arc(sunX - 10, sunY - 6, 6.5, 0, Math.PI * 2);
    ctx.arc(sunX + 9, sunY + 7, 8.5, 0, Math.PI * 2);
    ctx.arc(sunX + 6, sunY - 13, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3b. Far & Mid Volumetric 3D Shaded Clouds
  drawParallaxClouds3D(ctx, width, height, cam.x, camParallaxY, timeNow, palette);

  // 3c. Flying Birds in Morning & Evening Skies
  if (isMorning || isEvening) {
    drawFlyingBirds(ctx, width, height, cam.x, timeNow, isEvening);
  }

  // 4. Multi-Plane 3D Alpine Mountains, Valley Waterfalls, Arch Bridge & Forested Rolling Hills
  const bgScale = isMobilePortrait ? Math.max(0.64, Math.min(0.84, width / 560)) : 1;
  const horizonShift = isMobilePortrait ? -height * 0.08 : 0;

  drawParallaxMountains3D(
    ctx,
    width,
    height,
    cam.x * 0.05,
    height * 0.49 + horizonShift - camParallaxY * 0.35,
    125 * bgScale,
    290 * bgScale,
    palette.mountainLit,
    palette.mountainShade,
    isNight ? 'rgba(148, 163, 184, 0.22)' : 'rgba(255, 255, 255, 0.32)',
    !isEvening
  );

  // Mid rocky peaks with sunlit ridges & deeper canyon tone
  drawParallaxMountains3D(
    ctx,
    width,
    height,
    cam.x * 0.095 + 140,
    height * 0.56 + horizonShift - camParallaxY * 0.5,
    84 * bgScale,
    220 * bgScale,
    palette.farHill,
    palette.mountainShade,
    isNight ? 'rgba(74, 222, 128, 0.16)' : 'rgba(255, 255, 255, 0.18)',
    false
  );

  // Far Rolling Forested Hills (smooth emerald/sunset gradient — never #05080F black!)
  drawParallaxForestedHills3D(
    ctx,
    width,
    height,
    cam.x * 0.15,
    height * 0.60 + horizonShift - camParallaxY * 0.62,
    46 * bgScale,
    0.0038 / bgScale,
    palette.farHill,
    palette.hillBase,
    palette.foliageLit,
    palette.foliageShade,
    isEvening ? 'rgba(253, 186, 116, 0.30)' : 'rgba(255, 255, 255, 0.16)',
    0.75 * bgScale
  );

  // Deep Blue Valley River, Distant Cliff Waterfalls & Arched Background Bridge
  drawDistantValleyRiverAndFalls(
    ctx,
    width,
    height,
    cam.x * 0.18,
    height * 0.63 + horizonShift - camParallaxY * 0.68,
    sunX,
    timeNow,
    palette
  );

  // Luminous Valley Mist Ribbon (Morning & Evening)
  if (isMorning || isEvening) {
    const mistY = height * 0.59 + horizonShift - camParallaxY * 0.65;
    const mistGrad = ctx.createLinearGradient(0, mistY, 0, mistY + height * 0.16);
    mistGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    mistGrad.addColorStop(0.5, palette.mistColor);
    mistGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = mistGrad;
    ctx.fillRect(0, mistY, width, height * 0.16);
  }

  // Midground Rolling Forested Hills + Dense Tree Canopies
  drawParallaxForestedHills3D(
    ctx,
    width,
    height,
    cam.x * 0.25,
    height * 0.72 + horizonShift - camParallaxY * 0.85,
    38 * bgScale,
    0.0052 / bgScale,
    palette.midHill,
    palette.hillBase,
    palette.foliageLit,
    palette.foliageShade,
    palette.sunGlow,
    1.0 * bgScale
  );

  // 5. World Transform
  const { pivotX, pivotY } = framing;

  ctx.save();
  ctx.translate(pivotX, pivotY);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);

  const viewHalfW = (width / cam.zoom) * 0.82;
  const viewLeft = cam.x - viewHalfW;
  const viewRight = cam.x + viewHalfW;

  // 6. Start Gate, Scenic Bridges, Canyon Rivers & Waterfalls, Mountain Tunnels, Forests & 3 EarnOS Boards
  drawStartGate(
    ctx,
    level.startX,
    getTerrainHeightAt(level.terrainSegments, level.startX) ?? 420,
    palette.accent
  );

  const env = getEnvironmentForLevel(level);

  for (const bridge of env.bridges) {
    if (bridge.x2 < viewLeft - 220 || bridge.x1 > viewRight + 220) continue;
    drawScenicBridge3D(ctx, bridge, palette);
  }

  for (const river of env.rivers) {
    if (river.x2 < viewLeft - 160 || river.x1 > viewRight + 160) continue;
    drawRiverAndWaterfall3D(ctx, river, palette, timeNow);
  }

  for (const tunnel of env.tunnels) {
    if (tunnel.x2 < viewLeft - 240 || tunnel.x1 > viewRight + 240) continue;
    drawMountainTunnelBack3D(ctx, tunnel, palette, timeNow);
  }

  for (const prop of env.props) {
    if (prop.x < viewLeft - 200 || prop.x > viewRight + 200) continue;
    drawLandscapeProp3D(ctx, prop, palette, timeNow);
  }

  const roadsideBoards = getRoadsideBoardsForLevel(level);
  for (const board of roadsideBoards) {
    if (board.x < viewLeft - 180 || board.x > viewRight + 180) continue;
    drawRoadsideBoard(ctx, board, assets, timeNow);
  }

  // 7. 3D Extruded Racing Road, Curbs, Guardrails & Sculpted Rock Cliff Terrain
  const roadDepthX = -24;
  const roadDepthY = -22;
  for (const seg of level.terrainSegments) {
    const pts = seg.points;
    if (pts.length < 2) continue;
    if (pts[pts.length - 1].x < viewLeft || pts[0].x > viewRight) continue;

    // 7a. 2.5D Receding Asphalt Racing Surface Deck
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0].x + roadDepthX, pts[0].y + roadDepthY);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x + roadDepthX, pts[i].y + roadDepthY);
    }
    for (let i = pts.length - 1; i >= 0; i--) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.closePath();

    const deckGrad = ctx.createLinearGradient(0, 200, 0, 640);
    deckGrad.addColorStop(0, '#334155');
    deckGrad.addColorStop(0.45, '#1E293B');
    deckGrad.addColorStop(1, '#0F172A');
    ctx.fillStyle = deckGrad;
    ctx.fill();

    // Far-edge painted racing rumble curb strip (alternating bright/dark blocks)
    ctx.beginPath();
    ctx.moveTo(pts[0].x + roadDepthX, pts[0].y + roadDepthY);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x + roadDepthX, pts[i].y + roadDepthY);
    }
    ctx.strokeStyle = palette.groundCap;
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.setLineDash([22, 22]);
    ctx.beginPath();
    ctx.moveTo(pts[0].x + roadDepthX, pts[0].y + roadDepthY);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x + roadDepthX, pts[i].y + roadDepthY);
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Perspective dashed racing centerline
    ctx.globalAlpha = 0.52;
    ctx.setLineDash([30, 24]);
    ctx.beginPath();
    ctx.moveTo(pts[0].x + roadDepthX * 0.5, pts[0].y + roadDepthY * 0.5);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x + roadDepthX * 0.5, pts[i].y + roadDepthY * 0.5);
    }
    ctx.strokeStyle = '#F8FAFC';
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Subtle 3D roadside guardrail posts along far edge
    ctx.save();
    ctx.strokeStyle = isNight ? '#34D399' : '#CBD5E1';
    ctx.lineWidth = 3;
    for (let i = 0; i < pts.length; i += 4) {
      const gx = pts[i].x + roadDepthX;
      const gy = pts[i].y + roadDepthY;
      if (gx < viewLeft - 60 || gx > viewRight + 60) continue;
      ctx.fillStyle = '#475569';
      ctx.fillRect(gx - 2, gy - 16, 4, 16);
      if (i + 4 < pts.length) {
        const nx = pts[i + 4].x + roadDepthX;
        const ny = pts[i + 4].y + roadDepthY;
        ctx.beginPath();
        ctx.moveTo(gx, gy - 12);
        ctx.lineTo(nx, ny - 12);
        ctx.stroke();
      }
    }
    ctx.restore();

    // 7b. Sculpted 3D Cliff & Earth Cross-Section Polygon
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.lineTo(pts[pts.length - 1].x, 2200);
    ctx.lineTo(pts[0].x, 2200);
    ctx.closePath();

    const gGrad = ctx.createLinearGradient(0, 260, 0, 1080);
    gGrad.addColorStop(0, palette.cliffEarthTop);
    gGrad.addColorStop(0.55, palette.groundFillTop);
    gGrad.addColorStop(1, palette.cliffEarthBottom);
    ctx.fillStyle = gGrad;
    ctx.fill();

    // Sculpted 3D geologic strata ridges & cliff bevels
    ctx.clip();
    ctx.lineWidth = 3.5;
    for (let offset = 68; offset < 540; offset += 68) {
      ctx.strokeStyle =
        offset % 136 === 68
          ? 'rgba(255, 255, 255, 0.08)'
          : 'rgba(0, 0, 0, 0.28)';
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const px = pts[i].x;
        const py = pts[i].y + offset + Math.sin(px * 0.015 + offset) * 6;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();

    // 7c. Thick Roadbed Asphalt Shoulder + Biome Turf Overhang + Neon Track Cap
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Deep drop-shadow under roadbed lip
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y + 32);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y + 32);
    }
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.52)';
    ctx.lineWidth = 50;
    ctx.stroke();

    // Dark asphalt under-bed (42px thick)
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y + 22);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y + 22);
    }
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 42;
    ctx.stroke();

    // 2.5x Thick Biome / Neon Track Cap (26px thick)
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y + 10);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y + 10);
    }
    ctx.strokeStyle = palette.groundCap;
    ctx.lineWidth = 26;
    ctx.stroke();

    // Specular 3D top rim highlight (7px thick)
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.strokeStyle = palette.groundRim;
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.restore();
  }

  // 8. Wider, Thicker Stunt Ramps & 3D Elevated Bridges
  for (const ramp of level.ramps) {
    if (
      Math.max(ramp.p1.x, ramp.p2.x) < viewLeft - 140 ||
      Math.min(ramp.p1.x, ramp.p2.x) > viewRight + 140
    ) {
      continue;
    }
    drawRamp(ctx, ramp, timeNow, palette);
  }

  // 9. Checkered EarnOS Finish Line Arch
  const finishGroundY =
    getTerrainHeightAt(level.terrainSegments, level.finishX) ?? 420;
  drawFinishArch(ctx, level.finishX, finishGroundY, assets, timeNow);

  // 10. Collectible EarnOS Coins (Normal + Special 10-Point Bonus Coins)
  for (const coin of sim.coins) {
    if (coin.x < viewLeft - 120 || coin.x > viewRight + 120) continue;
    if (coin.collected && coin.collectAnim >= 1) continue;
    drawEarnOSCoin(
      ctx,
      coin.x,
      coin.y,
      coin.radius,
      coin.id,
      coin.collectAnim,
      Boolean(coin.isSpecial),
      assets,
      timeNow
    );
  }

  // 11. Moving Obstacles
  for (const obs of sim.obstacles) {
    if (obs.x < viewLeft - 120 || obs.x > viewRight + 120) continue;
    drawObstacle(ctx, obs, timeNow);
  }

  // 12. Particles
  for (const p of sim.particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    if (p.kind === 'confetti') {
      ctx.translate(p.x, p.y);
      ctx.rotate(p.life * 8);
      ctx.fillRect(-p.size * 0.6, -p.size * 0.3, p.size * 1.2, p.size * 0.6);
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 12b. Dynamic 3D Ground Shadow under Motorcycle
  const bikeGroundY = getTerrainHeightAt(level.terrainSegments, sim.bike.x);
  if (bikeGroundY !== null && !sim.bike.crashed) {
    const wheelBottomY = sim.bike.y + WHEEL_OFFSET_Y + WHEEL_RADIUS;
    const altitude = Math.max(0, bikeGroundY - wheelBottomY);
    if (altitude < 520) {
      const shadowFactor = Math.max(0.18, 1 - altitude / 520);
      ctx.save();
      ctx.translate(sim.bike.x, bikeGroundY - 6);
      ctx.fillStyle = `rgba(0, 0, 0, ${0.56 * shadowFactor})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, 128 * (0.65 + 0.35 * shadowFactor), 15 * shadowFactor, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // 13. 3D-Styled Motorcycle + Exact Original EarnOS Frog Mascot
  drawBikeAndMascot(ctx, sim, assets);

  // 14. Floating Stunt / +1 / +10 POINTS Popups
  for (const pop of sim.popups) {
    const progress = 1 - pop.life / pop.maxLife;
    const alpha = Math.min(1, (pop.life / pop.maxLife) * 1.45);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';

    if (pop.isSpecial) {
      const popScale =
        progress < 0.16
          ? 0.65 + (progress / 0.16) * 0.62
          : progress < 0.32
            ? 1.27 - ((progress - 0.16) / 0.16) * 0.18
            : 1.09;
      ctx.translate(pop.x, pop.y);
      ctx.scale(popScale, popScale);
      ctx.font = '900 42px "Outfit", sans-serif';
      ctx.shadowColor = '#16C768';
      ctx.shadowBlur = 18;
      ctx.lineWidth = 8;
      ctx.strokeStyle = 'rgba(11, 15, 20, 0.96)';
      ctx.strokeText(pop.text, 0, 0);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, 0, 0);
    } else {
      ctx.font = '900 30px "Outfit", sans-serif';
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(11, 15, 20, 0.9)';
      ctx.strokeText(pop.text, pop.x, pop.y);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x, pop.y);
    }
    ctx.restore();
  }

  ctx.restore();
}

function drawParallaxHills(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  offset: number,
  baseY: number,
  amp: number,
  freq: number,
  color: string,
  rimColor?: string
) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, height);
  const step = 36;
  const ridgePts: { x: number; y: number }[] = [];
  for (let x = 0; x <= width + step; x += step) {
    const wx = x + offset;
    const h =
      Math.sin(wx * freq) * amp +
      Math.sin(wx * freq * 2.1 + 1.3) * (amp * 0.42);
    const y = baseY + h;
    ridgePts.push({ x, y });
    ctx.lineTo(x, y);
  }
  ctx.lineTo(width, height);
  ctx.closePath();

  const hillGrad = ctx.createLinearGradient(0, baseY - amp, 0, height);
  hillGrad.addColorStop(0, color);
  hillGrad.addColorStop(1, '#05080F');
  ctx.fillStyle = hillGrad;
  ctx.fill();

  if (rimColor && ridgePts.length > 1) {
    ctx.beginPath();
    ctx.moveTo(ridgePts[0].x, ridgePts[0].y);
    for (let i = 1; i < ridgePts.length; i++) {
      ctx.lineTo(ridgePts[i].x, ridgePts[i].y);
    }
    ctx.strokeStyle = rimColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  ctx.restore();
}

function drawStartGate(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  accent: string
) {
  ctx.save();
  const postX = x - 110;
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(postX, groundY);
  ctx.lineTo(postX, groundY - 210);
  ctx.stroke();

  ctx.fillStyle = '#0F172A';
  ctx.strokeStyle = accent;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(postX - 8, groundY - 216, 134, 52, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#F8FAFC';
  ctx.font = '900 24px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('START', postX + 59, groundY - 181);
  ctx.restore();
}

function drawRamp(
  ctx: CanvasRenderingContext2D,
  ramp: RampPlatform,
  timeNow: number,
  palette: BiomePalette
) {
  const { p1, p2, thickness, style, boost } = ramp;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  const extrudeX = -14;
  const extrudeY = -16;

  ctx.save();

  // Elevated 3D Suspension Towers & Truss Bracing for Sky-Bridges
  if (style === 'bridge') {
    const towerXs = [p1.x + 28, p2.x - 28];
    const towerYs = [p1.y + (dy * 28) / len, p2.y - (dy * 28) / len];
    const towerTopY = Math.min(p1.y, p2.y) - 115;
    const midX = (p1.x + p2.x) * 0.5;
    const midY = (p1.y + p2.y) * 0.5;

    // Suspension cables
    ctx.strokeStyle = palette.timeOfDay === 'night' ? '#4ADE80' : '#94A3B8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(towerXs[0], towerTopY);
    ctx.quadraticCurveTo(midX, midY - 26, towerXs[1], towerTopY);
    ctx.stroke();

    // Vertical suspender cables
    ctx.lineWidth = 1.6;
    ctx.globalAlpha = 0.65;
    for (let s = 1; s < 8; s++) {
      const t = s / 8;
      const sx = towerXs[0] + (towerXs[1] - towerXs[0]) * t;
      const syDeck = towerYs[0] + (towerYs[1] - towerYs[0]) * t;
      const archSag = 4 * t * (1 - t);
      const syCable = towerTopY + archSag * (midY - 26 - towerTopY);
      ctx.beginPath();
      ctx.moveTo(sx, syCable);
      ctx.lineTo(sx, syDeck);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Twin Steel H-Towers
    for (let ti = 0; ti < 2; ti++) {
      const tx = towerXs[ti];
      const ty = towerYs[ti];
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(tx + extrudeX - 5, towerTopY - 8, 10, 380);
      ctx.fillStyle = '#475569';
      ctx.fillRect(tx - 6, towerTopY, 12, 390);
      ctx.fillStyle = palette.accent;
      ctx.fillRect(tx - 8, towerTopY - 4, 16, 7);
    }
  }

  // Heavy 3D steel/wood support struts with footings
  const strutCount = style === 'bridge' ? 4 : 2;
  for (let i = 0; i < strutCount; i++) {
    const t = 0.14 + (0.76 * i) / (strutCount - 1);
    const sx = p1.x + dx * t;
    const sy = p1.y + dy * t;

    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(sx + extrudeX, sy + extrudeY + 12);
    ctx.lineTo(sx + extrudeX, sy + 360);
    ctx.stroke();

    ctx.strokeStyle = style === 'wood' ? '#92400E' : '#475569';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(sx, sy + 12);
    ctx.lineTo(sx, sy + 360);
    ctx.stroke();

    if (i < strutCount - 1 && style !== 'wood') {
      const nt = 0.14 + (0.76 * (i + 1)) / (strutCount - 1);
      const nx = p1.x + dx * nt;
      const ny = p1.y + dy * nt;
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.42)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sx, sy + 24);
      ctx.lineTo(nx, ny + 96);
      ctx.moveTo(nx, ny + 24);
      ctx.lineTo(sx, sy + 96);
      ctx.stroke();
    }
  }

  // 2.5D Extruded Top Ramp Surface Deck
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p1.x + extrudeX, p1.y + extrudeY);
  ctx.lineTo(p2.x + extrudeX, p2.y + extrudeY);
  ctx.lineTo(p2.x, p2.y);
  ctx.closePath();
  ctx.fillStyle =
    style === 'wood'
      ? '#B45309'
      : style === 'bridge'
        ? '#0284C7'
        : boost
          ? '#059669'
          : '#475569';
  ctx.fill();

  ctx.translate(p1.x, p1.y);
  ctx.rotate(angle);

  // Thick 3D Lit Deck Front Face
  const faceGrad = ctx.createLinearGradient(0, 0, 0, thickness);
  if (style === 'wood') {
    faceGrad.addColorStop(0, '#F59E0B');
    faceGrad.addColorStop(0.3, '#B45309');
    faceGrad.addColorStop(1, '#451A03');
    ctx.fillStyle = faceGrad;
    ctx.fillRect(0, 0, len, thickness);
    ctx.fillStyle = '#FDE68A';
    ctx.fillRect(0, 0, len, 6);
    ctx.strokeStyle = 'rgba(69, 26, 3, 0.55)';
    ctx.lineWidth = 2;
    for (let px = 32; px < len - 16; px += 36) {
      ctx.beginPath();
      ctx.moveTo(px, 6);
      ctx.lineTo(px, thickness);
      ctx.stroke();
    }
  } else if (style === 'bridge') {
    faceGrad.addColorStop(0, '#7DD3FC');
    faceGrad.addColorStop(0.3, '#1E293B');
    faceGrad.addColorStop(1, '#090D14');
    ctx.fillStyle = faceGrad;
    ctx.fillRect(0, 0, len, thickness);
    ctx.fillStyle = palette.timeOfDay === 'night' ? '#4ADE80' : '#BAE6FD';
    ctx.fillRect(0, 0, len, 6);
  } else {
    faceGrad.addColorStop(0, boost ? '#34D399' : '#CBD5E1');
    faceGrad.addColorStop(0.32, '#1E293B');
    faceGrad.addColorStop(1, '#090D14');
    ctx.fillStyle = faceGrad;
    ctx.fillRect(0, 0, len, thickness);
    ctx.fillStyle = boost ? '#A7F3D0' : '#F1F5F9';
    ctx.fillRect(0, 0, len, 7);
  }

  // Animated 3D boost chevrons
  if (boost) {
    const shift = (timeNow * 130) % 52;
    ctx.strokeStyle = '#ECFDF5';
    ctx.lineWidth = 4.5;
    for (let cx = 28 + shift; cx < len - 24; cx += 52) {
      ctx.beginPath();
      ctx.moveTo(cx - 10, 12);
      ctx.lineTo(cx + 4, 20);
      ctx.lineTo(cx - 10, 28);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawFinishArch(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  assets: GameAssets,
  timeNow: number
) {
  ctx.save();

  const archW = 152;
  const archH = 290;

  ctx.fillStyle = '#0F172A';
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 3;
  ctx.fillRect(x - 18, groundY - archH, 22, archH + 20);
  ctx.fillRect(x + archW - 4, groundY - archH, 22, archH + 20);

  // Checkered vertical ribbon
  const cell = 18;
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 2; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? '#FFFFFF' : '#0B0F14';
      ctx.fillRect(
        x + 4 + col * cell,
        groundY - archH + 62 + row * cell,
        cell,
        cell
      );
    }
  }

  // Top Banner
  const bannerW = archW + 64;
  ctx.fillStyle = '#0B0F14';
  ctx.strokeStyle = '#16C768';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(x - 32, groundY - archH - 58, bannerW, 70, 14);
  ctx.fill();
  ctx.stroke();

  if (assets.coinCanvas) {
    ctx.drawImage(assets.coinCanvas, x - 18, groundY - archH - 46, 46, 46);
  }

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 28px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FINISH', x + 94, groundY - archH - 13);

  const pulse = 0.6 + 0.4 * Math.sin(timeNow * 5);
  ctx.fillStyle = `rgba(22, 199, 104, ${pulse * 0.35})`;
  ctx.beginPath();
  ctx.arc(x + archW * 0.5, groundY - archH - 70, 30, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawEarnOSCoin(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  id: number,
  collectAnim: number,
  isSpecial: boolean,
  assets: GameAssets,
  timeNow: number
) {
  ctx.save();
  const bob = Math.sin(timeNow * 3.4 + id * 0.9) * (isSpecial ? 9 : 7);
  const drawY = y + bob - collectAnim * (isSpecial ? 84 : 62);
  const scale = collectAnim > 0 ? 1 + collectAnim * (isSpecial ? 0.85 : 0.65) : 1;
  const alpha = collectAnim > 0 ? Math.max(0, 1 - collectAnim) : 1;
  // Gentle 3D spin while keeping the white EarnOS logo crisp and legible
  const rawCos = Math.cos(timeNow * 2.5 + id * 0.7);
  const spinX = 0.82 + 0.18 * Math.abs(rawCos);
  const depthShift = (1 - spinX) * 34 * (rawCos >= 0 ? -1 : 1);

  ctx.globalAlpha = alpha;
  ctx.translate(x, drawY);
  ctx.scale(scale, scale);

  if (isSpecial) {
    const pulse = 0.5 + 0.5 * Math.sin(timeNow * 6 + id);
    const glowR = radius * (1.85 + 0.18 * pulse);
    const neonHalo = ctx.createRadialGradient(0, 0, radius * 0.45, 0, 0, glowR);
    neonHalo.addColorStop(0, 'rgba(74, 222, 128, 0.72)');
    neonHalo.addColorStop(0.5, 'rgba(22, 199, 104, 0.44)');
    neonHalo.addColorStop(0.8, 'rgba(250, 204, 21, 0.18)');
    neonHalo.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = neonHalo;
    ctx.beginPath();
    ctx.arc(0, 0, glowR, 0, Math.PI * 2);
    ctx.fill();

    // Bright pulsing neon green outer glow ring
    ctx.beginPath();
    ctx.arc(0, 0, radius * (1.16 + 0.08 * pulse), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(74, 222, 128, ${0.55 + 0.35 * pulse})`;
    ctx.lineWidth = 4;
    ctx.stroke();

    // Orbiting sparkle motes around the special coin
    for (let i = 0; i < 4; i++) {
      const orbitA = timeNow * 2.6 + (i * Math.PI) / 2 + id;
      const ox = Math.cos(orbitA) * (radius * 1.32);
      const oy = Math.sin(orbitA) * (radius * 1.32);
      ctx.beginPath();
      ctx.arc(ox, oy, 3.6, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 === 0 ? '#4ADE80' : '#FDE047';
      ctx.fill();
    }

    // 3D Gold Extruded Coin Thickness Rim
    ctx.save();
    ctx.translate(depthShift - 3, 2);
    ctx.scale(spinX, 1);
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.03, 0, Math.PI * 2);
    ctx.fillStyle = '#B45309';
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.scale(spinX, 1);
    if (assets.specialCoinCanvas) {
      const d = radius * 2.2;
      ctx.drawImage(assets.specialCoinCanvas, -d / 2, -d / 2, d, d);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#000000';
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#FACC15';
      ctx.stroke();
    }
    // Glossy 3D coin highlight reflection
    const sheen = ctx.createLinearGradient(-radius, -radius, radius * 0.5, radius * 0.5);
    sheen.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
    sheen.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sheen;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.94, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else {
    // Subtle glow halo
    const halo = ctx.createRadialGradient(0, 0, radius * 0.4, 0, 0, radius * 1.55);
    halo.addColorStop(0, 'rgba(255, 255, 255, 0.28)');
    halo.addColorStop(0.6, 'rgba(22, 199, 104, 0.14)');
    halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.55, 0, Math.PI * 2);
    ctx.fill();

    // 3D Silver-Metallic Extruded Coin Edge
    ctx.save();
    ctx.translate(depthShift - 2, 1.5);
    ctx.scale(spinX, 1);
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.0, 0, Math.PI * 2);
    ctx.fillStyle = '#64748B';
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.scale(spinX, 1);
    if (assets.coinCanvas) {
      const d = radius * 2.15;
      ctx.drawImage(assets.coinCanvas, -d / 2, -d / 2, d, d);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#000000';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();
    }
    // Glossy 3D coin highlight reflection
    const sheen = ctx.createLinearGradient(-radius, -radius, radius * 0.4, radius * 0.4);
    sheen.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
    sheen.addColorStop(0.55, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sheen;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.92, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function drawObstacle(
  ctx: CanvasRenderingContext2D,
  obs: MovingObstacle,
  timeNow: number
) {
  ctx.save();
  ctx.translate(obs.x, obs.y);

  const glow = ctx.createRadialGradient(0, 0, 8, 0, 0, obs.radius * 1.9);
  glow.addColorStop(0, 'rgba(239, 68, 68, 0.42)');
  glow.addColorStop(1, 'rgba(239, 68, 68, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, obs.radius * 1.9, 0, Math.PI * 2);
  ctx.fill();

  if (obs.kind === 'saw') {
    // 3D depth backplate
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(-4, 4, obs.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(timeNow * 7);
    const teeth = 10;
    const metalGrad = ctx.createLinearGradient(-obs.radius, -obs.radius, obs.radius, obs.radius);
    metalGrad.addColorStop(0, '#FFFFFF');
    metalGrad.addColorStop(0.5, '#CBD5E1');
    metalGrad.addColorStop(1, '#475569');
    ctx.fillStyle = metalGrad;
    ctx.beginPath();
    for (let i = 0; i < teeth * 2; i++) {
      const a = (i * Math.PI) / teeth;
      const r = i % 2 === 0 ? obs.radius + 7 : obs.radius - 7;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();

    const coreGrad = ctx.createRadialGradient(-4, -4, 2, 0, 0, obs.radius * 0.46);
    coreGrad.addColorStop(0, '#FCA5A5');
    coreGrad.addColorStop(0.5, '#EF4444');
    coreGrad.addColorStop(1, '#7F1D1D');
    ctx.beginPath();
    ctx.arc(0, 0, obs.radius * 0.46, 0, Math.PI * 2);
    ctx.fillStyle = coreGrad;
    ctx.fill();
  } else if (obs.kind === 'crusher' || obs.kind === 'barrier') {
    const w = obs.width || 48;
    const h = obs.height || 86;
    // 3D beveled side shadow face
    ctx.fillStyle = '#090D14';
    ctx.beginPath();
    ctx.roundRect(-w / 2 - 8, -h / 2 - 6, w, h, 10);
    ctx.fill();

    const bodyGrad = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    bodyGrad.addColorStop(0, '#334155');
    bodyGrad.addColorStop(0.5, '#1E293B');
    bodyGrad.addColorStop(1, '#0F172A');
    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#EF4444';
    ctx.fillRect(-w / 2 + 6, -7, w - 12, 14);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(-w / 2 + 6, -7, w - 12, 4);
  } else {
    // 3D Spherical Drone with Specular Highlight
    const sphereGrad = ctx.createRadialGradient(
      -obs.radius * 0.3,
      -obs.radius * 0.3,
      4,
      0,
      0,
      obs.radius
    );
    sphereGrad.addColorStop(0, '#475569');
    sphereGrad.addColorStop(0.65, '#0F172A');
    sphereGrad.addColorStop(1, '#020617');
    ctx.fillStyle = sphereGrad;
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.arc(0, 0, obs.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const pulse = 0.6 + 0.4 * Math.sin(timeNow * 9);
    const eyeGrad = ctx.createRadialGradient(-3, -3, 2, 0, 0, obs.radius * 0.46);
    eyeGrad.addColorStop(0, '#FFFFFF');
    eyeGrad.addColorStop(0.4, `rgba(248, 113, 113, ${pulse})`);
    eyeGrad.addColorStop(1, '#991B1B');
    ctx.fillStyle = eyeGrad;
    ctx.beginPath();
    ctx.arc(0, 0, obs.radius * 0.46, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawWheel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  wheelAngle: number
) {
  ctx.save();
  ctx.translate(x, y);

  // 3D Tire Sidewall Depth Shadow + Inner Rim Shadow (non-rotating)
  ctx.beginPath();
  ctx.arc(-5, 3, radius * 1.0, 0, Math.PI * 2);
  ctx.fillStyle = '#020617';
  ctx.fill();

  ctx.rotate(wheelAngle);

  // Outer knobby 3D tire with directional rim highlight
  const tireGrad = ctx.createRadialGradient(-8, -8, radius * 0.35, 0, 0, radius);
  tireGrad.addColorStop(0, '#334155');
  tireGrad.addColorStop(0.65, '#0F172A');
  tireGrad.addColorStop(1, '#020617');
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = tireGrad;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#334155';
  ctx.stroke();

  // Chunky 3D off-road tire tread lugs
  ctx.fillStyle = '#475569';
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI * 2) / 16;
    ctx.save();
    ctx.rotate(a);
    ctx.fillRect(radius - 5, -4, 7, 8);
    ctx.restore();
  }

  // Drilled 3D brake rotor disc with metallic gradient
  const rotorGrad = ctx.createLinearGradient(-radius * 0.4, -radius * 0.4, radius * 0.4, radius * 0.4);
  rotorGrad.addColorStop(0, 'rgba(241, 245, 249, 0.55)');
  rotorGrad.addColorStop(0.5, 'rgba(100, 116, 139, 0.25)');
  rotorGrad.addColorStop(1, 'rgba(203, 213, 225, 0.45)');
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.44, 0, Math.PI * 2);
  ctx.fillStyle = rotorGrad;
  ctx.fill();
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Beveled 3D Metallic Rim
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.62, 0, Math.PI * 2);
  ctx.strokeStyle = '#F8FAFC';
  ctx.lineWidth = 6;
  ctx.stroke();

  // Inner EarnOS green anodized rim accent
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.55, 0, Math.PI * 2);
  ctx.strokeStyle = '#16C768';
  ctx.lineWidth = 2.8;
  ctx.stroke();

  // Spokes
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2.6;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * -radius * 0.58, Math.sin(a) * -radius * 0.58);
    ctx.lineTo(Math.cos(a) * radius * 0.58, Math.sin(a) * radius * 0.58);
    ctx.stroke();
  }

  // 3D Hub & specular axle bolt
  const hubGrad = ctx.createRadialGradient(-2, -2, 1, 0, 0, 10);
  hubGrad.addColorStop(0, '#A7F3D0');
  hubGrad.addColorStop(0.55, '#16C768');
  hubGrad.addColorStop(1, '#064E3B');
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fillStyle = hubGrad;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#0F172A';
  ctx.fill();

  ctx.restore();

  // Fixed Brake Caliper on Top-Rear Rotor
  ctx.save();
  ctx.translate(x - radius * 0.34, y - radius * 0.24);
  ctx.fillStyle = '#16C768';
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-6, -8, 12, 16, 4);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

interface Joint2D {
  x: number;
  y: number;
}

function solveTwoBoneIK(
  root: Joint2D,
  target: Joint2D,
  len1: number,
  len2: number,
  bendSign: 1 | -1
): Joint2D {
  const dx = target.x - root.x;
  const dy = target.y - root.y;
  const minD = Math.abs(len1 - len2) + 0.5;
  const maxD = len1 + len2 - 0.5;
  const dist = Math.max(minD, Math.min(maxD, Math.hypot(dx, dy)));
  const cosAngle = Math.max(
    -1,
    Math.min(1, (len1 * len1 + dist * dist - len2 * len2) / (2 * len1 * dist))
  );
  const baseAngle = Math.atan2(dy, dx);
  const angle = baseAngle + bendSign * Math.acos(cosAngle);
  return {
    x: root.x + Math.cos(angle) * len1,
    y: root.y + Math.sin(angle) * len1,
  };
}

function drawLimbSegment(
  ctx: CanvasRenderingContext2D,
  a: Joint2D,
  b: Joint2D,
  width: number,
  fill: string,
  outline = '#09131D'
) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = outline;
  ctx.lineWidth = width + 4;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();

  ctx.strokeStyle = fill;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function drawRiderArm(
  ctx: CanvasRenderingContext2D,
  shoulder: Joint2D,
  grip: Joint2D,
  isFar: boolean
) {
  const elbow = solveTwoBoneIK(shoulder, grip, 39, 38, 1);
  const wrist: Joint2D = {
    x: elbow.x + (grip.x - elbow.x) * 0.76,
    y: elbow.y + (grip.y - elbow.y) * 0.76,
  };

  const sleeveColor = isFar ? '#146CB0' : '#1F8ED6';
  const sleeveHighlight = '#5ABFF8';
  const skinColor = isFar ? '#529338' : '#69AB4D';
  const shirtOutline = '#114E7D';
  const skinOutline = '#2D5E1A';

  // Stout long-sleeve blue shirt arm (matching original mascot's blue sleeves)
  drawLimbSegment(ctx, shoulder, elbow, 17, sleeveColor, shirtOutline);
  drawLimbSegment(ctx, elbow, wrist, 15, sleeveColor, shirtOutline);

  if (!isFar) {
    ctx.strokeStyle = sleeveHighlight;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(shoulder.x + 2, shoulder.y - 4);
    ctx.lineTo(elbow.x + 1, elbow.y - 3);
    ctx.lineTo(wrist.x, wrist.y - 3);
    ctx.stroke();
  }

  // Green frog wrist & hand gripping handlebar
  drawLimbSegment(ctx, wrist, grip, 11, skinColor, skinOutline);

  ctx.save();
  ctx.translate(grip.x, grip.y);
  ctx.fillStyle = skinColor;
  ctx.strokeStyle = skinOutline;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.ellipse(0, -1, 9, 7, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Green frog finger curls wrapped around the handlebar grip
  ctx.strokeStyle = skinOutline;
  ctx.lineWidth = 1.6;
  for (let i = -3; i <= 3; i += 3) {
    ctx.beginPath();
    ctx.moveTo(i, -4);
    ctx.lineTo(i + 1, 3.5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRiderLeg(
  ctx: CanvasRenderingContext2D,
  hip: Joint2D,
  peg: Joint2D,
  isFar: boolean
) {
  const knee = solveTwoBoneIK(hip, peg, 34, 34, -1);
  const legColor = isFar ? '#529338' : '#69AB4D';
  const legHighlight = '#82C562';
  const outline = '#2D5E1A';

  // Natural green frog thigh & calf (no black pants or armor)
  drawLimbSegment(ctx, hip, knee, 19, legColor, outline);
  drawLimbSegment(ctx, knee, peg, 15, legColor, outline);

  if (!isFar) {
    ctx.strokeStyle = legHighlight;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hip.x + 4, hip.y - 3);
    ctx.lineTo(knee.x + 1, knee.y - 3);
    ctx.stroke();
  }

  // Natural green frog foot resting squarely on top of the steel footpeg
  ctx.save();
  ctx.translate(peg.x, peg.y);
  ctx.fillStyle = legColor;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-9, 1);
  ctx.quadraticCurveTo(-8, -9, 4, -8);
  ctx.quadraticCurveTo(18, -7, 20, -1);
  ctx.quadraticCurveTo(18, 3, -6, 3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Frog toe separation lines
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(13, -5);
  ctx.lineTo(17, -2);
  ctx.moveTo(11, -2);
  ctx.lineTo(16, 0);
  ctx.stroke();
  ctx.restore();
}

function drawBikeAndMascot(
  ctx: CanvasRenderingContext2D,
  sim: WorldSim,
  assets: GameAssets
) {
  const { bike } = sim;

  ctx.save();
  ctx.translate(bike.x, bike.y);
  ctx.rotate(bike.angle);

  const rearX = -WHEEL_BASE_HALF;
  const frontX = WHEEL_BASE_HALF;
  const rearY = WHEEL_OFFSET_Y - bike.rearCompression * 11;
  const frontY = WHEEL_OFFSET_Y - bike.frontCompression * 11;
  const chassisDipY = (bike.rearCompression + bike.frontCompression) * 4.5;

  // Rider joint anchors in bike space (stout Pepe frog proportions)
  const hipBase: Joint2D = {
    x: -33,
    y: -27 + chassisDipY + bike.riderBobY * 0.35,
  };
  const torsoLen = 40;
  const shoulderBase: Joint2D = {
    x: hipBase.x + Math.sin(bike.riderLean) * torsoLen,
    y: hipBase.y - Math.cos(bike.riderLean) * torsoLen + bike.riderBobY * 0.55,
  };

  const gripNear: Joint2D = { x: 39, y: -62 + chassisDipY };
  const gripFar: Joint2D = { x: 47, y: -66 + chassisDipY };
  const pegNear: Joint2D = { x: -16, y: 24 + chassisDipY };
  const pegFar: Joint2D = { x: -9, y: 20 + chassisDipY };

  // 1. Far-Side Rider Arm & Leg (behind bike frame for realistic 3D riding depth)
  drawRiderArm(
    ctx,
    { x: shoulderBase.x + 8, y: shoulderBase.y - 2 },
    gripFar,
    true
  );
  drawRiderLeg(ctx, { x: hipBase.x + 6, y: hipBase.y - 2 }, pegFar, true);

  // Far Handlebar stub
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(30, -58 + chassisDipY);
  ctx.lineTo(gripFar.x, gripFar.y);
  ctx.stroke();

  // 2. Rear & Front Wheels
  drawWheel(ctx, rearX, rearY, WHEEL_RADIUS, bike.wheelAngle);
  drawWheel(ctx, frontX, frontY, WHEEL_RADIUS, bike.wheelAngle);

  // 3. Heavy Alloy Swingarm & Drive Chain
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(rearX, rearY - 12);
  ctx.lineTo(-20, 6 + chassisDipY);
  ctx.moveTo(rearX, rearY + 12);
  ctx.lineTo(-20, 22 + chassisDipY);
  ctx.stroke();

  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(rearX, rearY);
  ctx.lineTo(-18, 14 + chassisDipY);
  ctx.stroke();

  // Rear Mono-Shock Absorber with animated 3D coil spring compression
  const shockStart = { x: rearX + 28, y: rearY - 8 };
  const shockEnd = { x: -34, y: -20 + chassisDipY };
  const sdx = shockEnd.x - shockStart.x;
  const sdy = shockEnd.y - shockStart.y;
  const sLen = Math.hypot(sdx, sdy);
  const sUx = sdx / sLen;
  const sUy = sdy / sLen;
  const sPx = -sUy;
  const sPy = sUx;

  // Inner damper piston rod
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(shockStart.x, shockStart.y);
  ctx.lineTo(shockEnd.x, shockEnd.y);
  ctx.stroke();

  // Animated green coil spring
  ctx.strokeStyle = '#16C768';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  const coils = 6;
  for (let c = 0; c <= coils * 2; c++) {
    const t = 0.16 + (c / (coils * 2)) * 0.68;
    const amp = c % 2 === 0 ? 5.5 : -5.5;
    const cx = shockStart.x + sdx * t + sPx * amp;
    const cy = shockStart.y + sdy * t + sPy * amp;
    if (c === 0) ctx.moveTo(cx, cy);
    else ctx.lineTo(cx, cy);
  }
  ctx.stroke();

  // 4. Upside-Down Front Suspension Fork + Telescoping Gold Stanchion & Outer Slider
  ctx.strokeStyle = '#FBBF24';
  ctx.lineWidth = 7.5;
  ctx.beginPath();
  ctx.moveTo(frontX, frontY);
  ctx.lineTo(frontX - 18, -20 + chassisDipY);
  ctx.stroke();

  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 11.5;
  ctx.beginPath();
  ctx.moveTo(frontX - 16, -16 + chassisDipY);
  ctx.lineTo(34, -46 + chassisDipY);
  ctx.stroke();
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(frontX - 13, -18 + chassisDipY);
  ctx.lineTo(37, -48 + chassisDipY);
  ctx.stroke();

  // 5. Chrome Exhaust Header & Racing Silencer Muffler
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.moveTo(-10, 14 + chassisDipY);
  ctx.lineTo(-64, 4 + chassisDipY);
  ctx.lineTo(-92, -8 + chassisDipY);
  ctx.stroke();

  ctx.fillStyle = '#0F172A';
  ctx.strokeStyle = '#16C768';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(-96, -15 + chassisDipY, 34, 15, 5);
  ctx.fill();
  ctx.stroke();

  // Boost flame when active
  if (bike.boostTimer > 0) {
    ctx.fillStyle = '#34D399';
    ctx.beginPath();
    ctx.moveTo(-96, -12 + chassisDipY);
    ctx.lineTo(-148 - Math.random() * 28, -7 + chassisDipY);
    ctx.lineTo(-96, -2 + chassisDipY);
    ctx.closePath();
    ctx.fill();
  }

  // 6. Detailed Engine Block & Cooling Fins
  ctx.fillStyle = '#1E293B';
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(-34, -12 + chassisDipY, 58, 38, 10);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  for (let fy = -4; fy <= 10; fy += 6) {
    ctx.beginPath();
    ctx.moveTo(-24, fy + chassisDipY);
    ctx.lineTo(14, fy + chassisDipY);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(-6, 16 + chassisDipY, 11, 0, Math.PI * 2);
  ctx.fillStyle = '#334155';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-6, 16 + chassisDipY, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#16C768';
  ctx.fill();

  // Frame tubular trellis
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-34, -14 + chassisDipY);
  ctx.lineTo(26, -26 + chassisDipY);
  ctx.lineTo(16, 14 + chassisDipY);
  ctx.stroke();

  // 7. 3D Sculpted Motocross Bodywork, Seat, Tank, Fenders & Reverse Light
  const bodyGreenGrad = ctx.createLinearGradient(0, -48 + chassisDipY, 0, 0 + chassisDipY);
  bodyGreenGrad.addColorStop(0, '#6EE7B7');
  bodyGreenGrad.addColorStop(0.35, '#16C768');
  bodyGreenGrad.addColorStop(1, '#065F46');
  ctx.fillStyle = bodyGreenGrad;
  ctx.beginPath();
  ctx.moveTo(-92, -20 + chassisDipY);
  ctx.quadraticCurveTo(-56, -40 + chassisDipY, -20, -24 + chassisDipY);
  ctx.lineTo(-30, -10 + chassisDipY);
  ctx.lineTo(-86, -10 + chassisDipY);
  ctx.closePath();
  ctx.fill();

  // Rear Taillight / Active Reverse Backup Glow
  if (bike.isReversing) {
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = '#F8FAFC';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.roundRect(-95, -22 + chassisDipY, 8, 9, 3);
    ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.roundRect(-94, -21 + chassisDipY, 6, 7, 2);
    ctx.fill();
  }

  // Ribbed 3D saddle with top sheen
  const seatGrad = ctx.createLinearGradient(0, -30 + chassisDipY, 0, -10 + chassisDipY);
  seatGrad.addColorStop(0, '#334155');
  seatGrad.addColorStop(0.35, '#0F172A');
  seatGrad.addColorStop(1, '#020617');
  ctx.fillStyle = seatGrad;
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-58, -29 + chassisDipY, 56, 18, 8);
  ctx.fill();
  ctx.stroke();

  // 3D Sculpted Fuel Tank & Front Side Shroud
  ctx.fillStyle = bodyGreenGrad;
  ctx.beginPath();
  ctx.moveTo(-6, -27 + chassisDipY);
  ctx.lineTo(44, -44 + chassisDipY);
  ctx.lineTo(64, -18 + chassisDipY);
  ctx.lineTo(14, -4 + chassisDipY);
  ctx.closePath();
  ctx.fill();

  // Crisp White Racing Stripe on Tank
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(8, -24 + chassisDipY);
  ctx.lineTo(44, -34 + chassisDipY);
  ctx.stroke();

  // Front Mudguard Fender with 3D top specular highlight
  ctx.fillStyle = bodyGreenGrad;
  ctx.beginPath();
  ctx.moveTo(46, -24 + chassisDipY);
  ctx.quadraticCurveTo(80, -34 + chassisDipY, 102, -10 + chassisDipY);
  ctx.lineTo(90, -5 + chassisDipY);
  ctx.quadraticCurveTo(70, -22 + chassisDipY, 46, -14 + chassisDipY);
  ctx.closePath();
  ctx.fill();

  // Front Headlight Cowl + subtle forward beam cone
  ctx.fillStyle = 'rgba(224, 242, 254, 0.10)';
  ctx.beginPath();
  ctx.moveTo(58, -42 + chassisDipY);
  ctx.lineTo(220, -78 + chassisDipY);
  ctx.lineTo(220, 6 + chassisDipY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.roundRect(42, -52 + chassisDipY, 16, 22, 5);
  ctx.fill();
  ctx.fillStyle = '#E0F2FE';
  ctx.fillRect(54, -48 + chassisDipY, 5, 13);

  // Near Handlebar Stem & Grip
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 6.5;
  ctx.beginPath();
  ctx.moveTo(34, -46 + chassisDipY);
  ctx.lineTo(26, -60 + chassisDipY);
  ctx.lineTo(gripNear.x, gripNear.y);
  ctx.stroke();

  // Steel Footpeg Mount & Peg
  ctx.fillStyle = '#CBD5E1';
  ctx.fillRect(pegNear.x - 8, pegNear.y - 2, 18, 5);

  // 8. Stout, Plump Frog Torso in Exact Bright Blue Shirt (`#1F8ED6` / `#5ABFF8`)
  ctx.save();
  ctx.translate(hipBase.x, hipBase.y);
  ctx.rotate(bike.riderLean);

  const shirtGrad = ctx.createLinearGradient(-28, -torsoLen, 28, 6);
  shirtGrad.addColorStop(0, '#146CB0');
  shirtGrad.addColorStop(0.45, '#1F8ED6');
  shirtGrad.addColorStop(1, '#5ABFF8');

  ctx.fillStyle = shirtGrad;
  ctx.strokeStyle = '#114E7D';
  ctx.lineWidth = 3;
  ctx.beginPath();
  // Round plump frog torso (wider belly & broad rounded shoulders)
  ctx.moveTo(-24, 2);
  ctx.quadraticCurveTo(-29, -torsoLen * 0.55, -18, -torsoLen - 4);
  ctx.quadraticCurveTo(0, -torsoLen - 12, 20, -torsoLen - 2);
  ctx.quadraticCurveTo(31, -torsoLen * 0.45, 25, 2);
  ctx.quadraticCurveTo(0, 11, -24, 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Soft blue fold shading matching uploaded illustration style
  ctx.fillStyle = 'rgba(17, 78, 125, 0.28)';
  ctx.beginPath();
  ctx.ellipse(-13, -torsoLen * 0.42, 9, torsoLen * 0.36, -0.1, 0, Math.PI * 2);
  ctx.fill();

  // Smooth bright-green frog neck connecting jaw cleanly into the blue shirt collar
  const neckGrad = ctx.createLinearGradient(-16, -torsoLen - 18, 22, -torsoLen + 4);
  neckGrad.addColorStop(0, '#55963B');
  neckGrad.addColorStop(0.55, '#69AB4D');
  neckGrad.addColorStop(1, '#82C562');
  ctx.fillStyle = neckGrad;
  ctx.strokeStyle = '#2D5E1A';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-16, -torsoLen - 2);
  ctx.quadraticCurveTo(-18, -torsoLen - 16, -4, -torsoLen - 20);
  ctx.lineTo(18, -torsoLen - 18);
  ctx.quadraticCurveTo(22, -torsoLen - 6, 17, -torsoLen + 1);
  ctx.quadraticCurveTo(0, -torsoLen + 7, -16, -torsoLen - 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Clean blue shirt collar line around the green neck
  ctx.strokeStyle = '#114E7D';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(-17, -torsoLen - 2);
  ctx.quadraticCurveTo(0, -torsoLen + 8, 18, -torsoLen);
  ctx.stroke();
  ctx.restore();

  // 9. Near-Side Green Frog Leg & Foot Planted on Footpeg
  drawRiderLeg(ctx, hipBase, pegNear, false);

  // 10. Exact Original Uploaded EarnOS Frog Head (Preserving Face, Eyes, Mouth & Colors)
  const headImg = assets.frogHeadCanvas || assets.frogCanvas;
  if (headImg) {
    const neckX = shoulderBase.x + Math.sin(bike.riderLean) * 2;
    const neckY = shoulderBase.y - Math.cos(bike.riderLean) * 2;
    const headW = 108;
    const aspect = headImg.height / headImg.width;
    const headH = headW * aspect;

    ctx.save();
    ctx.translate(neckX + 4, neckY + 11);
    ctx.rotate(bike.riderLean * 0.42 + bike.headTilt);
    ctx.drawImage(headImg, -headW * 0.46, -headH * 0.84, headW, headH);
    ctx.restore();
  }

  // 11. Near-Side Blue Sleeve Arm & Green Frog Hand Gripping Handlebar
  drawRiderArm(
    ctx,
    { x: shoulderBase.x - 4, y: shoulderBase.y + 6 },
    gripNear,
    false
  );

  ctx.restore();
}

function drawOfficialEarnOSLogoBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  assets: GameAssets,
  glowColor = '#4ADE80'
) {
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = glowColor;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, Math.max(5, size * 0.14));
  ctx.fill();
  ctx.clip();

  if (assets.rawCoinImg) {
    const pad = size * 0.06;
    ctx.drawImage(
      assets.rawCoinImg,
      x + pad,
      y + pad,
      size - pad * 2,
      size - pad * 2
    );
  }
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = glowColor;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, Math.max(5, size * 0.14));
  ctx.stroke();
  ctx.restore();
}

function drawRoadsideBoard(
  ctx: CanvasRenderingContext2D,
  board: RoadsideBoard,
  assets: GameAssets,
  timeNow: number
) {
  const pulse = 0.8 + 0.2 * Math.sin(timeNow * 3 + board.variant);
  const bw = board.width;
  const bh = board.height;
  const legH = 44;
  const boardTopY = -legH - bh;

  ctx.save();
  ctx.translate(board.x, board.y);
  ctx.rotate(board.slope);

  // Compact dark post planted naturally beside the road edge
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.lineTo(0, -legH + 4);
  ctx.stroke();

  // 3D extruded cabinet side/back depth
  ctx.fillStyle = '#042F1E';
  ctx.beginPath();
  ctx.roundRect(-bw * 0.5 - 5, boardTopY - 5, bw, bh, 9);
  ctx.fill();

  // Small dark sign cabinet with neon green EarnOS border & subtle glow
  ctx.fillStyle = '#090E16';
  ctx.strokeStyle = '#16C768';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#16C768';
  ctx.shadowBlur = 10 * pulse;
  ctx.beginPath();
  ctx.roundRect(-bw * 0.5, boardTopY, bw, bh, 9);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Neon green EarnOS accent bar along top edge
  ctx.fillStyle = '#4ADE80';
  ctx.fillRect(-bw * 0.5 + 10, boardTopY + 4, bw - 20, 3);

  // Original uploaded EarnOS logo untouched
  const logoSize = 40;
  drawOfficialEarnOSLogoBox(
    ctx,
    -bw * 0.5 + 10,
    boardTopY + (bh - logoSize) * 0.5 + 2,
    logoSize,
    assets,
    '#4ADE80'
  );

  // Crisp EarnOS branding text
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 21px "Outfit", sans-serif';
  ctx.fillText('EarnOS', -bw * 0.5 + 58, boardTopY + 37);

  ctx.fillStyle = '#4ADE80';
  ctx.fillRect(-bw * 0.5 + 58, boardTopY + 44, 68, 3);

  ctx.restore();
}

function drawParallaxClouds3D(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  camX: number,
  camParallaxY: number,
  timeNow: number,
  palette: BiomePalette
) {
  ctx.save();
  const isNight = palette.timeOfDay === 'night';
  const isMobilePortrait = width < 640 && height >= width;
  const cloudScale = isMobilePortrait ? Math.max(0.68, Math.min(0.84, width / 500)) : 1;
  const wrapW = width + 380;
  for (let i = 0; i < 7; i++) {
    const rawX = i * 290 + timeNow * (6 + (i % 3) * 2.5) - camX * (0.025 + (i % 2) * 0.015);
    const cx = (((rawX % wrapW) + wrapW) % wrapW) - 190;
    const rawCy = height * (0.12 + (i % 3) * 0.065) - camParallaxY * 0.2;
    const cy = isMobilePortrait ? Math.max(106 + (i % 3) * 26, rawCy) : rawCy;
    const s = (0.68 + (i % 3) * 0.24) * cloudScale;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);

    // Cloud shaded underside for 3D puffiness
    ctx.fillStyle = isNight ? 'rgba(15, 23, 42, 0.55)' : 'rgba(148, 163, 184, 0.28)';
    ctx.beginPath();
    ctx.ellipse(2, 12, 66, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sunlit / moonlit top volumetric cloud puffs
    ctx.fillStyle = palette.cloudColor;
    ctx.beginPath();
    ctx.ellipse(0, 6, 64, 18, 0, 0, Math.PI * 2);
    ctx.ellipse(-30, 1, 35, 22, 0, 0, Math.PI * 2);
    ctx.ellipse(24, 0, 40, 24, 0, 0, Math.PI * 2);
    ctx.ellipse(-4, -12, 32, 25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawFlyingBirds(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  camX: number,
  timeNow: number,
  isEvening: boolean
) {
  ctx.save();
  ctx.strokeStyle = isEvening ? 'rgba(67, 20, 7, 0.78)' : 'rgba(15, 23, 42, 0.58)';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  const wrapW = width + 240;

  for (let i = 0; i < 6; i++) {
    const bx =
      ((((i * 235 + timeNow * (26 + i * 3) - camX * 0.04) % wrapW) + wrapW) % wrapW) -
      120;
    const by = height * (0.15 + (i % 3) * 0.055) + Math.sin(timeNow * 2.2 + i) * 6;
    const wing = Math.sin(timeNow * 7.5 + i * 1.4) * 5;
    ctx.beginPath();
    ctx.moveTo(bx - 9, by + wing);
    ctx.quadraticCurveTo(bx - 4, by - 4, bx, by);
    ctx.quadraticCurveTo(bx + 4, by - 4, bx + 9, by + wing);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParallaxMountains3D(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  offset: number,
  baseY: number,
  peakAmp: number,
  segW: number,
  litColor: string,
  shadeColor: string,
  ridgeHighlight: string,
  withSnowCaps: boolean
) {
  ctx.save();
  const startIdx = Math.floor(offset / segW) - 1;
  const endIdx = startIdx + Math.ceil(width / segW) + 3;

  for (let idx = startIdx; idx <= endIdx; idx++) {
    const x1 = idx * segW - offset;
    const x3 = (idx + 1) * segW - offset;
    const hVar = 0.54 + 0.46 * Math.abs(Math.sin(idx * 1.93 + 0.7));
    const peakH = peakAmp * hVar;
    const xPeak = x1 + segW * (0.40 + 0.18 * Math.sin(idx * 2.4));
    const yPeak = baseY - peakH;

    // Left sunlit mountain facet
    ctx.fillStyle = litColor;
    ctx.beginPath();
    ctx.moveTo(x1, height);
    ctx.lineTo(x1, baseY + 14);
    ctx.lineTo(xPeak, yPeak);
    ctx.lineTo(xPeak + 14, baseY + 24);
    ctx.lineTo(xPeak, height);
    ctx.closePath();
    ctx.fill();

    // Right shadowed mountain facet
    ctx.fillStyle = shadeColor;
    ctx.beginPath();
    ctx.moveTo(xPeak, height);
    ctx.lineTo(xPeak, yPeak);
    ctx.lineTo(x3, baseY + 14);
    ctx.lineTo(x3, height);
    ctx.closePath();
    ctx.fill();

    // Snow/sunlight cap near summit on alpine ranges
    if (withSnowCaps && peakH > peakAmp * 0.7) {
      const capY = yPeak + peakH * 0.30;
      const tL = (capY - yPeak) / (baseY + 14 - yPeak);
      const capX1 = xPeak + (x1 - xPeak) * tL;
      const capX2 = xPeak + (x3 - xPeak) * tL;

      ctx.fillStyle = 'rgba(248, 250, 252, 0.72)';
      ctx.beginPath();
      ctx.moveTo(xPeak, yPeak);
      ctx.lineTo(capX1, capY);
      ctx.lineTo(xPeak - 6, capY + 8);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(186, 230, 253, 0.42)';
      ctx.beginPath();
      ctx.moveTo(xPeak, yPeak);
      ctx.lineTo(xPeak - 6, capY + 8);
      ctx.lineTo(capX2, capY);
      ctx.closePath();
      ctx.fill();
    }

    // Crisp sunlit ridge edge
    ctx.strokeStyle = ridgeHighlight;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(x1, baseY + 14);
    ctx.lineTo(xPeak, yPeak);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParallaxForestedHills3D(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  offset: number,
  baseY: number,
  amp: number,
  freq: number,
  topColor: string,
  valleyColor: string,
  foliageLit: string,
  foliageShade: string,
  rimColor: string,
  treeDensityScale: number
) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, height);
  const step = 32;
  const ridgePts: { x: number; y: number }[] = [];
  for (let x = 0; x <= width + step; x += step) {
    const wx = x + offset;
    const h =
      Math.sin(wx * freq) * amp +
      Math.sin(wx * freq * 2.1 + 1.3) * (amp * 0.42);
    const y = baseY + h;
    ridgePts.push({ x, y });
    ctx.lineTo(x, y);
  }
  ctx.lineTo(width, height);
  ctx.closePath();

  const hillGrad = ctx.createLinearGradient(0, baseY - amp, 0, height);
  hillGrad.addColorStop(0, topColor);
  hillGrad.addColorStop(0.58, valleyColor);
  hillGrad.addColorStop(1, valleyColor);
  ctx.fillStyle = hillGrad;
  ctx.fill();

  // Forest canopy silhouettes along hill crests (fast polygon pines & leafy crowns)
  const treeSpacing = 38 / treeDensityScale;
  const startTree = Math.floor(offset / treeSpacing);
  const endTree = startTree + Math.ceil(width / treeSpacing) + 2;
  for (let ti = startTree; ti <= endTree; ti++) {
    const wx = ti * treeSpacing;
    const sx = wx - offset;
    const hy =
      baseY +
      Math.sin(wx * freq) * amp +
      Math.sin(wx * freq * 2.1 + 1.3) * (amp * 0.42);
    const th = (18 + (Math.abs(Math.sin(ti * 3.17)) * 16)) * treeDensityScale;
    const tw = th * 0.46;

    ctx.fillStyle = ti % 3 === 0 ? foliageLit : foliageShade;
    if (ti % 4 === 0) {
      ctx.beginPath();
      ctx.arc(sx, hy - th * 0.42, tw * 0.95, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(sx, hy - th);
      ctx.lineTo(sx - tw, hy + 4);
      ctx.lineTo(sx + tw, hy + 4);
      ctx.closePath();
      ctx.fill();
    }
  }

  if (ridgePts.length > 1) {
    ctx.beginPath();
    ctx.moveTo(ridgePts[0].x, ridgePts[0].y);
    for (let i = 1; i < ridgePts.length; i++) {
      ctx.lineTo(ridgePts[i].x, ridgePts[i].y);
    }
    ctx.strokeStyle = rimColor;
    ctx.lineWidth = 2.4;
    ctx.stroke();
  }
  ctx.restore();
}

function drawDistantValleyRiverAndFalls(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  offset: number,
  riverY: number,
  sunX: number,
  timeNow: number,
  palette: BiomePalette
) {
  const riverH = height * 0.14;
  ctx.save();

  // Distant Mountain Cliff Waterfall feeding the deep blue valley river
  const fallPeriod = 760;
  const startFall = Math.floor(offset / fallPeriod);
  const endFall = startFall + Math.ceil(width / fallPeriod) + 1;
  for (let fi = startFall; fi <= endFall; fi++) {
    const fx = fi * fallPeriod + 240 - offset;
    const fTop = riverY - 82;
    const fw = 24;
    const fGrad = ctx.createLinearGradient(fx - fw * 0.5, 0, fx + fw * 0.5, 0);
    fGrad.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
    fGrad.addColorStop(0.5, palette.waterTop);
    fGrad.addColorStop(1, 'rgba(255, 255, 255, 0.72)');
    ctx.fillStyle = fGrad;
    ctx.fillRect(fx - fw * 0.5, fTop, fw, 86);

    // Distant arch viaduct bridge crossing beside valley waterfall
    const bx = fx + 150;
    ctx.fillStyle = palette.timeOfDay === 'night' ? '#1E293B' : '#475569';
    ctx.fillRect(bx - 90, riverY - 26, 180, 12);
    for (let a = -1; a <= 1; a++) {
      ctx.fillRect(bx + a * 58 - 7, riverY - 20, 14, 28);
    }
    if (palette.timeOfDay === 'night') {
      ctx.fillStyle = '#4ADE80';
      ctx.fillRect(bx - 88, riverY - 28, 176, 2.5);
    }
  }

  // Deep Blue Valley River body
  const rGrad = ctx.createLinearGradient(0, riverY, 0, riverY + riverH);
  rGrad.addColorStop(0, palette.waterTop);
  rGrad.addColorStop(0.45, palette.waterDeep);
  rGrad.addColorStop(1, palette.hillBase);
  ctx.fillStyle = rGrad;
  ctx.fillRect(0, riverY, width, riverH);

  // Crisp water shoreline sheen
  ctx.fillStyle = 'rgba(255, 255, 255, 0.26)';
  ctx.fillRect(0, riverY, width, 2.5);

  // Shimmering sun/moon vertical reflection bars across deep blue river
  ctx.fillStyle = palette.sunColor;
  for (let i = 0; i < 7; i++) {
    const ry = riverY + 6 + i * 8;
    const rw = 64 - i * 6 + Math.sin(timeNow * 3 + i) * 12;
    const rx = sunX - rw * 0.5 + Math.sin(timeNow * 2 + i * 1.3) * 9;
    ctx.globalAlpha = 0.28 - i * 0.028;
    ctx.fillRect(rx, ry, Math.max(14, rw), 3);
  }
  ctx.restore();
}

function drawScenicBridge3D(
  ctx: CanvasRenderingContext2D,
  bridge: ScenicBridge,
  palette: BiomePalette
) {
  const { x1, x2, deckY, archCount, style } = bridge;
  const w = x2 - x1;
  if (w <= 0) return;

  ctx.save();
  const isSteel = style === 'steel';
  const deckColor = isSteel ? '#1E293B' : '#475569';
  const trimColor = isSteel && palette.timeOfDay === 'night' ? '#4ADE80' : '#94A3B8';

  // Bridge piers descending deep into the canyon / valley
  const spanW = w / archCount;
  ctx.fillStyle = isSteel ? '#0F172A' : '#334155';
  for (let i = 0; i <= archCount; i++) {
    const px = x1 + i * spanW;
    ctx.fillRect(px - 12, deckY + 10, 24, 340);
  }

  // Curved bridge arch ribs beneath the span
  ctx.strokeStyle = isSteel ? '#334155' : '#64748B';
  ctx.lineWidth = 10;
  for (let i = 0; i < archCount; i++) {
    const ax1 = x1 + i * spanW + 10;
    const ax2 = x1 + (i + 1) * spanW - 10;
    const mid = (ax1 + ax2) * 0.5;
    ctx.beginPath();
    ctx.moveTo(ax1, deckY + 95);
    ctx.quadraticCurveTo(mid, deckY - 12, ax2, deckY + 95);
    ctx.stroke();
  }

  // 3D top deck + railing
  ctx.fillStyle = deckColor;
  ctx.fillRect(x1 - 12, deckY, w + 24, 22);
  ctx.fillStyle = trimColor;
  ctx.fillRect(x1 - 12, deckY - 4, w + 24, 5);
  ctx.restore();
}

function drawMountainTunnelBack3D(
  ctx: CanvasRenderingContext2D,
  tunnel: TunnelLandmark,
  palette: BiomePalette,
  timeNow: number
) {
  const { x1, x2, y1, y2, archHeight } = tunnel;
  const midX = (x1 + x2) * 0.5;
  const baseY = Math.max(y1, y2) + 18;
  const topY = Math.min(y1, y2) - archHeight;
  const isNight = palette.timeOfDay === 'night';

  ctx.save();
  // Sculpted 3D Mountain Massif rising behind the tunnel
  ctx.fillStyle = palette.mountainLit;
  ctx.beginPath();
  ctx.moveTo(x1 - 95, baseY + 60);
  ctx.lineTo(x1 - 24, topY - 45);
  ctx.lineTo(midX - 18, topY - 110);
  ctx.lineTo(midX + 18, baseY + 60);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = palette.mountainShade;
  ctx.beginPath();
  ctx.moveTo(midX - 18, topY - 110);
  ctx.lineTo(x2 + 26, topY - 40);
  ctx.lineTo(x2 + 95, baseY + 60);
  ctx.lineTo(midX - 18, baseY + 60);
  ctx.closePath();
  ctx.fill();

  // Dark recessed 3D tunnel cavern interior behind road & bike (rider stays 100% visible!)
  ctx.fillStyle = '#070B12';
  ctx.beginPath();
  ctx.moveTo(x1 + 14, baseY);
  ctx.lineTo(x1 + 14, topY + 64);
  ctx.quadraticCurveTo(midX, topY - 16, x2 - 14, topY + 64);
  ctx.lineTo(x2 - 14, baseY);
  ctx.closePath();
  ctx.fill();

  // 3D perspective concrete vault arch ribs inside tunnel
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 7;
  for (let i = 1; i <= 4; i++) {
    const rx1 = x1 + ((x2 - x1) * i) / 5;
    ctx.beginPath();
    ctx.moveTo(rx1, baseY);
    ctx.lineTo(rx1, topY + 34);
    ctx.stroke();
  }

  // Glowing tunnel ceiling lights (warm amber in day/sunset, neon green at night)
  const lightColor = isNight ? '#4ADE80' : '#FDE047';
  const pulse = 0.8 + 0.2 * Math.sin(timeNow * 4);
  for (let i = 0; i < 4; i++) {
    const lx = x1 + 48 + i * ((x2 - x1 - 96) / 3);
    const ly = topY + 38;
    ctx.fillStyle = lightColor;
    ctx.fillRect(lx - 18, ly, 36, 6);

    const glow = ctx.createLinearGradient(lx, ly + 6, lx, ly + 110);
    glow.addColorStop(
      0,
      isNight ? `rgba(74, 222, 128, ${0.24 * pulse})` : 'rgba(253, 224, 71, 0.18)'
    );
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.moveTo(lx - 16, ly + 6);
    ctx.lineTo(lx + 16, ly + 6);
    ctx.lineTo(lx + 42, ly + 110);
    ctx.lineTo(lx - 42, ly + 110);
    ctx.closePath();
    ctx.fill();
  }

  // Stone entry & exit portal columns + top keystone lintel rim
  ctx.fillStyle = '#334155';
  ctx.fillRect(x1 - 8, topY + 46, 28, baseY - (topY + 46));
  ctx.fillRect(x2 - 20, topY + 46, 28, baseY - (topY + 46));

  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(x1 + 6, topY + 62);
  ctx.quadraticCurveTo(midX, topY - 22, x2 - 6, topY + 62);
  ctx.stroke();

  ctx.strokeStyle = isNight ? '#16C768' : '#CBD5E1';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x1 + 6, topY + 55);
  ctx.quadraticCurveTo(midX, topY - 29, x2 - 6, topY + 55);
  ctx.stroke();

  ctx.restore();
}

function drawRiverAndWaterfall3D(
  ctx: CanvasRenderingContext2D,
  river: RiverWaterfall,
  palette: BiomePalette,
  timeNow: number
) {
  const { x1, x2, waterY, fallX, fallTopY, fallWidth, secondaryFallX, secondaryFallTopY } = river;
  const w = x2 - x1;
  if (w <= 0) return;

  ctx.save();
  // Deep Blue Canyon River water body
  const rGrad = ctx.createLinearGradient(0, waterY, 0, waterY + 560);
  rGrad.addColorStop(0, palette.waterTop);
  rGrad.addColorStop(0.28, palette.waterDeep);
  rGrad.addColorStop(1, '#020617');
  ctx.fillStyle = rGrad;
  ctx.fillRect(x1, waterY, w, 580);

  // Wet cliff rock ledges framing the river banks
  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.arc(x1 + 26, waterY + 6, 36, Math.PI, 0);
  ctx.arc(x2 - 26, waterY + 8, 34, Math.PI, 0);
  ctx.fill();

  // Sunlight / Moonlight reflection highlights on deep blue water surface
  ctx.fillStyle = palette.sunColor;
  ctx.globalAlpha = palette.timeOfDay === 'night' ? 0.36 : 0.44;
  for (let i = 0; i < 4; i++) {
    const rw = 52 - i * 8;
    const rx = (x1 + x2) * 0.5 - rw * 0.5 + Math.sin(timeNow * 2.8 + i) * 10;
    ctx.fillRect(rx, waterY + 12 + i * 16, rw, 4);
  }
  ctx.globalAlpha = 1;

  const drawStream = (fx: number, fTop: number, fw: number) => {
    const fallH = Math.max(40, waterY - fTop + 10);
    const fallGrad = ctx.createLinearGradient(fx - fw * 0.5, 0, fx + fw * 0.5, 0);
    fallGrad.addColorStop(0, 'rgba(255, 255, 255, 0.30)');
    fallGrad.addColorStop(0.5, palette.waterTop);
    fallGrad.addColorStop(1, 'rgba(255, 255, 255, 0.70)');
    ctx.fillStyle = fallGrad;
    ctx.fillRect(fx - fw * 0.5, fTop, fw, fallH);

    // Animated falling water streaks
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.76)';
    ctx.lineWidth = 2.6;
    const shift = (timeNow * 170) % 44;
    for (let sx = -fw * 0.32; sx <= fw * 0.32; sx += 9) {
      for (let sy = fTop + shift; sy < waterY - 8; sy += 44) {
        ctx.beginPath();
        ctx.moveTo(fx + sx, sy);
        ctx.lineTo(fx + sx, Math.min(waterY, sy + 22));
        ctx.stroke();
      }
    }

    // White foaming splash cloud at waterfall base
    ctx.fillStyle = 'rgba(255, 255, 255, 0.70)';
    for (let m = -1; m <= 1; m++) {
      const pulse = 1 + 0.14 * Math.sin(timeNow * 5 + m);
      ctx.beginPath();
      ctx.ellipse(fx + m * 14, waterY + 2, 17 * pulse, 9 * pulse, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  drawStream(fallX, fallTopY, fallWidth);
  if (secondaryFallX !== undefined && secondaryFallTopY !== undefined) {
    drawStream(secondaryFallX, secondaryFallTopY, fallWidth * 0.62);
  }

  // Animated wave crest across river surface
  ctx.beginPath();
  ctx.moveTo(x1, waterY);
  for (let wx = x1; wx <= x2; wx += 26) {
    ctx.lineTo(wx, waterY + Math.sin(wx * 0.045 + timeNow * 3.2) * 3.5);
  }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.restore();
}

function drawLandscapeProp3D(
  ctx: CanvasRenderingContext2D,
  prop: LandscapeProp,
  palette: BiomePalette,
  timeNow: number
) {
  ctx.save();
  ctx.translate(prop.x, prop.y);
  ctx.scale(prop.scale, prop.scale);

  if (prop.kind === 'pine') {
    // Ground contact shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
    ctx.beginPath();
    ctx.ellipse(9, 2, 38, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Detailed bark trunk (lit/shaded halves)
    ctx.fillStyle = '#451A03';
    ctx.fillRect(-8, -40, 16, 42);
    ctx.fillStyle = '#78350F';
    ctx.fillRect(-8, -40, 7, 42);

    // 4 stacked 3D conical pine bough tiers
    const tiers = [
      { yBot: -28, h: 48, halfW: 44 },
      { yBot: -56, h: 46, halfW: 36 },
      { yBot: -84, h: 44, halfW: 28 },
      { yBot: -110, h: 38, halfW: 19 },
    ];
    for (const t of tiers) {
      ctx.fillStyle = palette.foliageLit;
      ctx.beginPath();
      ctx.moveTo(0, t.yBot - t.h);
      ctx.lineTo(-t.halfW, t.yBot);
      ctx.lineTo(0, t.yBot + 5);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = palette.foliageShade;
      ctx.beginPath();
      ctx.moveTo(0, t.yBot - t.h);
      ctx.lineTo(0, t.yBot + 5);
      ctx.lineTo(t.halfW, t.yBot);
      ctx.closePath();
      ctx.fill();
    }
  } else if (prop.kind === 'canopy_tree') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
    ctx.beginPath();
    ctx.ellipse(9, 2, 40, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Trunk + main forks
    ctx.fillStyle = '#451A03';
    ctx.fillRect(-9, -62, 18, 64);
    ctx.fillStyle = '#78350F';
    ctx.fillRect(-9, -62, 8, 64);

    // 3D shaded multi-cluster foliage crown
    ctx.fillStyle = palette.foliageShade;
    ctx.beginPath();
    ctx.arc(14, -72, 34, 0, Math.PI * 2);
    ctx.arc(-16, -68, 30, 0, Math.PI * 2);
    ctx.arc(0, -64, 28, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = palette.foliageLit;
    ctx.beginPath();
    ctx.arc(-8, -88, 32, 0, Math.PI * 2);
    ctx.arc(16, -84, 24, 0, Math.PI * 2);
    ctx.arc(-22, -78, 20, 0, Math.PI * 2);
    ctx.fill();
  } else if (prop.kind === 'rock') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(6, 2, 30, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Faceted 3D boulder (lit left slope + darker right facet)
    ctx.fillStyle = palette.mountainLit;
    ctx.beginPath();
    ctx.moveTo(-26, 2);
    ctx.lineTo(-16, -24);
    ctx.lineTo(4, -28);
    ctx.lineTo(2, 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = palette.mountainShade;
    ctx.beginPath();
    ctx.moveTo(4, -28);
    ctx.lineTo(26, -14);
    ctx.lineTo(28, 2);
    ctx.lineTo(2, 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = palette.foliageLit;
    ctx.beginPath();
    ctx.ellipse(-6, -23, 10, 4, -0.2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Night glowing EarnOS trackside lamp
    const glowPulse = 0.85 + 0.15 * Math.sin(timeNow * 4 + prop.variant);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.lineTo(0, -152);
    ctx.quadraticCurveTo(0, -172, 24, -172);
    ctx.stroke();

    ctx.fillStyle = '#4ADE80';
    ctx.beginPath();
    ctx.roundRect(14, -176, 20, 7, 3);
    ctx.fill();

    const cone = ctx.createLinearGradient(24, -170, 24, 16);
    cone.addColorStop(0, `rgba(74, 222, 128, ${0.32 * glowPulse})`);
    cone.addColorStop(1, 'rgba(22, 199, 104, 0)');
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(16, -170);
    ctx.lineTo(32, -170);
    ctx.lineTo(76, 18);
    ctx.lineTo(-28, 18);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

