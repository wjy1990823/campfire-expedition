import type { LookDef } from '../sim/types';

export const SPRITE_SIZE = 16;
const OUTLINE = '#1a1c2c';
const DARK = '#3b2a20';
const METAL = '#dfe6ee';
const WOOD = '#8a5a2b';

type Grid = (string | null)[][];

function grid(): Grid {
  return Array.from({ length: SPRITE_SIZE }, () => Array<string | null>(SPRITE_SIZE).fill(null));
}

function rect(g: Grid, x0: number, y0: number, x1: number, y1: number, c: string): void {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = c;
}

function px(g: Grid, x: number, y: number, c: string): void {
  g[y][x] = c;
}

function outline(g: Grid): void {
  const add: [number, number][] = [];
  for (let y = 0; y < SPRITE_SIZE; y++)
    for (let x = 0; x < SPRITE_SIZE; x++) {
      if (g[y][x]) continue;
      const n = [g[y - 1]?.[x], g[y + 1]?.[x], g[y]?.[x - 1], g[y]?.[x + 1]];
      if (n.some((c) => c && c !== OUTLINE)) add.push([x, y]);
    }
  for (const [x, y] of add) g[y][x] = OUTLINE;
}

function humanoid(l: LookDef): Grid {
  const g = grid();
  const skin = l.skin ?? '#f4c197';
  if (l.shield) {
    rect(g, 2, 7, 4, 12, l.secondary);
    rect(g, 3, 9, 3, 10, '#f7c948');
  } else {
    rect(g, 4, 8, 4, 10, l.primary);
  }
  if (l.robe) {
    rect(g, 5, 8, 10, 13, l.primary);
    rect(g, 5, 13, 10, 13, l.secondary);
    rect(g, 7, 8, 8, 12, l.secondary);
    rect(g, 5, 14, 6, 14, DARK);
    rect(g, 9, 14, 10, 14, DARK);
  } else {
    rect(g, 5, 8, 10, 11, l.primary);
    rect(g, 5, 11, 10, 11, l.secondary);
    rect(g, 5, 12, 6, 13, '#4a3a2a');
    rect(g, 8, 12, 9, 13, '#4a3a2a');
    rect(g, 5, 14, 6, 14, DARK);
    rect(g, 8, 14, 9, 14, DARK);
  }
  rect(g, 5, 3, 10, 7, skin);
  px(g, 9, 5, OUTLINE);
  switch (l.headgear) {
    case 'helmet':
      rect(g, 4, 2, 11, 3, l.primary);
      rect(g, 4, 4, 6, 6, l.primary);
      rect(g, 7, 1, 8, 1, l.secondary);
      break;
    case 'hair':
      rect(g, 4, 2, 10, 3, l.hair ?? DARK);
      rect(g, 4, 4, 5, 8, l.hair ?? DARK);
      break;
    case 'hat':
      rect(g, 3, 3, 12, 3, l.primary);
      rect(g, 5, 2, 10, 2, l.primary);
      rect(g, 6, 1, 8, 1, l.primary);
      px(g, 7, 2, l.secondary);
      rect(g, 4, 4, 5, 6, '#c0cbdc');
      break;
    case 'hood':
      rect(g, 4, 2, 11, 3, l.primary);
      rect(g, 4, 4, 5, 7, l.primary);
      break;
    case 'ears':
      px(g, 4, 4, skin);
      px(g, 3, 3, skin);
      px(g, 11, 4, skin);
      px(g, 12, 3, skin);
      rect(g, 5, 2, 10, 2, l.primary);
      px(g, 9, 5, '#f7e26b');
      break;
  }
  rect(g, 11, 8, 11, 9, l.primary);
  px(g, 11, 10, skin);
  switch (l.weapon) {
    case 'sword':
      rect(g, 12, 2, 12, 9, METAL);
      rect(g, 11, 10, 13, 10, '#c2853d');
      px(g, 12, 11, WOOD);
      break;
    case 'staff':
      rect(g, 12, 3, 12, 14, WOOD);
      rect(g, 12, 1, 12, 2, l.secondary);
      break;
    case 'mace':
      rect(g, 12, 7, 12, 12, WOOD);
      rect(g, 11, 4, 13, 6, '#f7c948');
      break;
    case 'bow':
      rect(g, 13, 4, 13, 12, WOOD);
      px(g, 12, 3, WOOD);
      px(g, 12, 13, WOOD);
      rect(g, 12, 5, 12, 11, '#c2c3c7');
      break;
    case 'dagger':
      rect(g, 12, 7, 12, 9, METAL);
      px(g, 12, 10, WOOD);
      break;
  }
  outline(g);
  return g;
}

function slime(l: LookDef): Grid {
  const g = grid();
  const rows: [number, number, number][] = [
    [6, 6, 9], [7, 4, 11], [8, 3, 12], [9, 2, 13], [10, 2, 13], [11, 2, 13], [12, 2, 13], [13, 2, 13], [14, 3, 12],
  ];
  for (const [y, a, b] of rows) rect(g, a, y, b, y, l.primary);
  rect(g, 5, 8, 6, 8, l.secondary);
  px(g, 4, 9, l.secondary);
  rect(g, 3, 13, 12, 13, l.secondary);
  rect(g, 8, 10, 8, 11, OUTLINE);
  rect(g, 11, 10, 11, 11, OUTLINE);
  outline(g);
  return g;
}

function beast(l: LookDef): Grid {
  const g = grid();
  rect(g, 3, 7, 11, 10, l.primary);
  rect(g, 4, 7, 10, 7, l.secondary);
  rect(g, 10, 5, 13, 8, l.primary);
  rect(g, 14, 7, 14, 8, l.primary);
  px(g, 14, 7, OUTLINE);
  px(g, 11, 4, l.secondary);
  px(g, 12, 4, l.primary);
  px(g, 12, 6, l.eye ?? '#f7e26b');
  rect(g, 3, 11, 3, 13, l.secondary);
  rect(g, 5, 11, 5, 13, l.secondary);
  rect(g, 9, 11, 9, 13, l.secondary);
  rect(g, 11, 11, 11, 13, l.secondary);
  px(g, 2, 7, l.primary);
  px(g, 1, 6, l.primary);
  px(g, 1, 5, l.secondary);
  outline(g);
  return g;
}

export function buildSprite(look: LookDef): HTMLCanvasElement {
  const g = look.kind === 'slime' ? slime(look) : look.kind === 'beast' ? beast(look) : humanoid(look);
  const c = document.createElement('canvas');
  c.width = c.height = SPRITE_SIZE;
  const ctx = c.getContext('2d')!;
  for (let y = 0; y < SPRITE_SIZE; y++)
    for (let x = 0; x < SPRITE_SIZE; x++) {
      const col = g[y][x];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }
  return c;
}

function seeded(seed: number): () => number {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/** Low-res parallax layers; drawn at 1px and scaled up by the scene. */
export function buildLayer(kind: 'far' | 'mid' | 'ground', color: string, dark: string, w = 120, h = 90): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const rnd = seeded(kind.length * 97 + w);
  if (kind === 'far') {
    ctx.fillStyle = color;
    let y = h * 0.45;
    for (let x = 0; x < w; x++) {
      const t = (x / w) * Math.PI * 2;
      y = h * 0.5 - Math.sin(t) * 10 - Math.sin(t * 3) * 4;
      ctx.fillRect(x, Math.round(y), 1, h);
    }
  } else if (kind === 'mid') {
    for (let i = 0; i < 9; i++) {
      const x0 = Math.floor((i / 9) * w + rnd() * 6);
      const th = 20 + Math.floor(rnd() * 22);
      const base = h - 4;
      for (let row = 0; row < th; row++) {
        const half = Math.floor((row / th) * 7) + 1;
        ctx.fillStyle = row % 6 === 5 ? dark : color;
        ctx.fillRect(x0 - half, base - th + row, half * 2 + 1, 1);
      }
      ctx.fillStyle = '#5d3a1f';
      ctx.fillRect(x0, base, 1, 4);
    }
  } else {
    ctx.fillStyle = dark;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, 3);
    for (let x = 0; x < w; x += 2) if (rnd() > 0.5) ctx.fillRect(x, 3, 1, 1);
    ctx.fillStyle = '#7a5230';
    for (let i = 0; i < w / 3; i++) ctx.fillRect(Math.floor(rnd() * w), 6 + Math.floor(rnd() * (h - 8)), 2, 1);
  }
  return c;
}
