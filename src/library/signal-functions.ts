/**
 * Animation signal functions — time-varying values usable as Pattern arguments.
 *
 * These return PatternFn closures that produce values based on time.
 */

import type { PatternFn } from "../language/ast.ts";
import { smoothstep } from "../utils/math-helpers.ts";

/** Linear interpolation from `from` to `to` over `duration` seconds. */
export function tween(from: number, to: number, duration: number, easeFn?: (t: number) => number): PatternFn {
  const eFn = easeFn ?? smoothstep;
  return (_x, _z, t) => {
    if (duration <= 0) return to;
    const p = Math.min(t / duration, 1);
    return from + (to - from) * eFn(p);
  };
}

/** Sinusoidal oscillator between lo and hi at given frequency. */
export function osc(freq = 1, lo = 0, hi = 1): PatternFn {
  return (_x, _z, t) => {
    const v = Math.sin(t * freq * Math.PI * 2) * 0.5 + 0.5;
    return lo + (hi - lo) * v;
  };
}

/** Sawtooth wave between lo and hi at given frequency. */
export function saw(freq = 1, lo = 0, hi = 1): PatternFn {
  return (_x, _z, t) => {
    const v = (t * freq) % 1;
    return lo + (hi - lo) * v;
  };
}

/** Pulse wave (square wave with adjustable duty cycle). */
export function pulse(freq = 1, duty = 0.5): PatternFn {
  return (_x, _z, t) => ((t * freq) % 1 < duty ? 1 : 0);
}
