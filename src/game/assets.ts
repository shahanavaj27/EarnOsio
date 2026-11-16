export interface GameAssets {
  loaded: boolean;
  frogCanvas: HTMLCanvasElement | null;
  frogHeadCanvas: HTMLCanvasElement | null;
  frogDataUrl: string | null;
  coinCanvas: HTMLCanvasElement | null;
  specialCoinCanvas: HTMLCanvasElement | null;
  rawFrogImg: HTMLImageElement | null;
  rawCoinImg: HTMLImageElement | null;
}

export const FROG_IMAGE_PATH = '/assets/aistudio/Screenshot_2026_1116_011730_bda364fe.png';
export const COIN_IMAGE_PATH = '/assets/aistudio/A5dkFJ4s_2cd98e72.jpg';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

function cropCanvasToOpaque(src: HTMLCanvasElement): HTMLCanvasElement {
  const w = src.width;
  const h = src.height;
  const ctx = src.getContext('2d');
  if (!ctx) return src;
  const data = ctx.getImageData(0, 0, w, h).data;

  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 20) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const cropW = Math.max(1, maxX - minX + 1);
  const cropH = Math.max(1, maxY - minY + 1);
  const out = document.createElement('canvas');
  out.width = cropW;
  out.height = cropH;
  const oCtx = out.getContext('2d');
  if (oCtx) {
    oCtx.drawImage(src, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
  }
  return out;
}

/**
 * Removes the uniform dark-gray outer screenshot backdrop around the EarnOS Frog
 * mascot using an edge-seeded BFS flood fill, and also isolates a clean head-only
 * sprite above the shirt collar for the articulated motorcycle rider rig.
 */
function createCleanFrogCanvases(img: HTMLImageElement): {
  canvas: HTMLCanvasElement;
  headCanvas: HTMLCanvasElement;
  dataUrl: string;
} {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  const work = document.createElement('canvas');
  work.width = w;
  work.height = h;
  const ctx = work.getContext('2d');
  if (!ctx) {
    return { canvas: work, headCanvas: work, dataUrl: FROG_IMAGE_PATH };
  }

  ctx.drawImage(img, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Sample background color from top-right corner (safe background area)
  const sampleIdx = (w - 4) * 4;
  const bgR = data[sampleIdx];
  const bgG = data[sampleIdx + 1];
  const bgB = data[sampleIdx + 2];

  const isBgColor = (idx: number, tol: number): boolean => {
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    if (maxC > 82 || maxC - minC > 22) return false;
    const dr = r - bgR;
    const dg = g - bgG;
    const db = b - bgB;
    return Math.sqrt(dr * dr + dg * dg + db * db) <= tol;
  };

  const visited = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;

  const pushIfBg = (x: number, y: number) => {
    const p = y * w + x;
    if (visited[p]) return;
    if (isBgColor(p * 4, 30)) {
      visited[p] = 1;
      queue[tail++] = p;
    }
  };

  for (let x = 0; x < w; x++) {
    pushIfBg(x, 0);
    pushIfBg(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    pushIfBg(0, y);
    pushIfBg(w - 1, y);
  }

  while (head < tail) {
    const p = queue[head++];
    const x = p % w;
    const y = (p - x) / w;
    data[p * 4 + 3] = 0;

    if (x > 0) pushIfBg(x - 1, y);
    if (x < w - 1) pushIfBg(x + 1, y);
    if (y > 0) pushIfBg(x, y - 1);
    if (y < h - 1) pushIfBg(x, y + 1);
  }

  // 2-pass outer halo cleanup to remove dark background-blended fringes along cheeks & jaw
  for (let pass = 0; pass < 2; pass++) {
    const toClear: number[] = [];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const p = y * w + x;
        const idx = p * 4;
        if (data[idx + 3] === 0) continue;
        const hasTransparentNeighbor =
          data[(p - 1) * 4 + 3] === 0 ||
          data[(p + 1) * 4 + 3] === 0 ||
          data[(p - w) * 4 + 3] === 0 ||
          data[(p + w) * 4 + 3] === 0;
        if (!hasTransparentNeighbor) continue;

        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        // Clear dark achromatic/muddy fringe pixels blended with the dark backdrop
        if (maxC < 74 && maxC - minC < 24) {
          toClear.push(idx);
        }
      }
    }
    for (const idx of toClear) {
      data[idx + 3] = 0;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  const fullCropped = cropCanvasToOpaque(work);

  // Create clean head-only sprite by walking upward from the shirt/heart region
  // until hitting pure green frog skin or warm frog lip, leaving zero black patches
  const headWork = document.createElement('canvas');
  headWork.width = w;
  headWork.height = h;
  const hCtx = headWork.getContext('2d');
  if (hCtx) {
    hCtx.putImageData(imgData, 0, 0);
    const hImg = hCtx.getImageData(0, 0, w, h);
    const hd = hImg.data;

    const scanStartY = Math.min(h - 1, Math.round(h * 0.61));
    const scanMinY = Math.round(h * 0.41);

    for (let x = 0; x < w; x++) {
      let cutY = scanMinY;
      for (let y = scanStartY; y >= scanMinY; y--) {
        const idx = (y * w + x) * 4;
        if (hd[idx + 3] < 40) continue;
        const r = hd[idx];
        const g = hd[idx + 1];
        const b = hd[idx + 2];

        const isGreenSkin = g >= 68 && g - r >= 12 && g - b >= 12;
        const isWarmLip = r >= 120 && r - b >= 26;
        if (isGreenSkin || isWarmLip) {
          cutY = y + 1;
          break;
        }
      }

      for (let y = cutY; y < h; y++) {
        hd[(y * w + x) * 4 + 3] = 0;
      }
    }
    hCtx.putImageData(hImg, 0, 0);
  }

  const headCropped = cropCanvasToOpaque(headWork);

  return {
    canvas: fullCropped,
    headCanvas: headCropped,
    dataUrl: fullCropped.toDataURL('image/png'),
  };
}

/**
 * Pre-renders a crisp circular EarnOS coin token using the exact uploaded
 * EarnOS white-on-black logo image.
 */
function createCoinSpriteCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const size = 192;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 6;

  // Outer silver-white metallic coin bevel
  const rimGrad = ctx.createLinearGradient(0, 0, size, size);
  rimGrad.addColorStop(0, '#FFFFFF');
  rimGrad.addColorStop(0.5, '#E2E8F0');
  rimGrad.addColorStop(1, '#64748B');

  ctx.beginPath();
  ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
  ctx.fillStyle = rimGrad;
  ctx.fill();

  // Inner black coin face clipped cleanly to a circle with the exact EarnOS logo
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r - 5, 0, Math.PI * 2);
  ctx.clip();

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, size, size);

  // Draw the uploaded EarnOS logo centered inside the round coin
  const inset = 10;
  ctx.drawImage(img, inset, inset, size - inset * 2, size - inset * 2);
  ctx.restore();

  // Crisp inner highlight ring
  ctx.beginPath();
  ctx.arc(cx, cy, r - 5, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.48)';
  ctx.lineWidth = 3;
  ctx.stroke();

  return canvas;
}

/**
 * Pre-renders the special 10-point EarnOS bonus coin with a rich golden outer
 * border and the exact uploaded white EarnOS symbol centered inside.
 */
function createSpecialCoinSpriteCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const size = 224;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 8;

  // Golden outer bevel border
  const goldGrad = ctx.createLinearGradient(0, 0, size, size);
  goldGrad.addColorStop(0, '#FEF08A');
  goldGrad.addColorStop(0.35, '#FACC15');
  goldGrad.addColorStop(0.7, '#EAB308');
  goldGrad.addColorStop(1, '#A16207');

  ctx.beginPath();
  ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
  ctx.fillStyle = goldGrad;
  ctx.fill();

  // Subtle neon-green accent hairline inside the gold rim
  ctx.beginPath();
  ctx.arc(cx, cy, r - 4, 0, Math.PI * 2);
  ctx.strokeStyle = '#4ADE80';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // Inner black coin face clipped cleanly to a circle with the exact EarnOS logo
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r - 8, 0, Math.PI * 2);
  ctx.clip();

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, size, size);

  const inset = 16;
  ctx.drawImage(img, inset, inset, size - inset * 2, size - inset * 2);
  ctx.restore();

  // Crisp bright golden inner edge shine
  ctx.beginPath();
  ctx.arc(cx, cy, r - 7, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(253, 224, 71, 0.75)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  return canvas;
}

let cachedAssets: GameAssets | null = null;
let loadPromise: Promise<GameAssets> | null = null;

export function loadGameAssets(): Promise<GameAssets> {
  if (cachedAssets?.loaded) {
    return Promise.resolve(cachedAssets);
  }
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = Promise.all([
    loadImage(FROG_IMAGE_PATH),
    loadImage(COIN_IMAGE_PATH),
  ])
    .then(([frogImg, coinImg]) => {
      const frogResult = createCleanFrogCanvases(frogImg);
      const coinCanvas = createCoinSpriteCanvas(coinImg);
      const specialCoinCanvas = createSpecialCoinSpriteCanvas(coinImg);
      cachedAssets = {
        loaded: true,
        frogCanvas: frogResult.canvas,
        frogHeadCanvas: frogResult.headCanvas,
        frogDataUrl: frogResult.dataUrl,
        coinCanvas,
        specialCoinCanvas,
        rawFrogImg: frogImg,
        rawCoinImg: coinImg,
      };
      return cachedAssets;
    })
    .catch(() => {
      cachedAssets = {
        loaded: true,
        frogCanvas: null,
        frogHeadCanvas: null,
        frogDataUrl: FROG_IMAGE_PATH,
        coinCanvas: null,
        specialCoinCanvas: null,
        rawFrogImg: null,
        rawCoinImg: null,
      };
      return cachedAssets;
    });

  return loadPromise;
}
