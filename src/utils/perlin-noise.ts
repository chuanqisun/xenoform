/** 2D Perlin noise implementation. */

const _perm = new Uint8Array(512);

// Initialize permutation table
const _p: number[] = [];
for (let i = 0; i < 256; i++) _p[i] = i;
for (let i = 255; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [_p[i], _p[j]] = [_p[j], _p[i]];
}
for (let i = 0; i < 512; i++) _perm[i] = _p[i & 255];

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function grad(h: number, x: number, y: number): number {
  const v = h & 3;
  return v === 0 ? x + y : v === 1 ? -x + y : v === 2 ? x - y : -x - y;
}

/** Sample 2D Perlin noise at (x, y). Returns value in [0, 1]. */
export function perlin2(x: number, y: number): number {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const u = fade(xf);
  const v = fade(yf);
  const aa = _perm[_perm[X] + Y];
  const ab = _perm[_perm[X] + Y + 1];
  const ba = _perm[_perm[X + 1] + Y];
  const bb = _perm[_perm[X + 1] + Y + 1];
  const x1 = grad(aa, xf, yf) * (1 - u) + grad(ba, xf - 1, yf) * u;
  const x2 = grad(ab, xf, yf - 1) * (1 - u) + grad(bb, xf - 1, yf - 1) * u;
  return (x1 * (1 - v) + x2 * v) * 0.5 + 0.5;
}
