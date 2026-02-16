/** Pure math helper functions used across the application. */

export const TAU = Math.PI * 2;

/** Clamp value to [0, 1] range. */
export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Clamp value to [lo, hi] range. */
export function clamp(v: number, lo = 0, hi = 1): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Linear interpolation between a and b by t. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Hermite smoothstep — maps [0,1] → [0,1] with smooth ease. */
export function smoothstep(t: number): number {
  t = clamp01(t);
  return t * t * (3 - 2 * t);
}

/** Fractional part of v. */
export function fract(v: number): number {
  return v - Math.floor(v);
}
