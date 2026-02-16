/**
 * Pattern factory functions — the built-in constructors available to user scripts.
 *
 * Each function creates a Pattern AST node that can be chained and compiled.
 */

import type { PatternFn } from "../language/ast.ts";
import { Pattern } from "../language/ast.ts";

export function wave(fx = 1, fz = 1): Pattern {
  return new Pattern("wave", { fx, fz });
}

export function ripple(cx = 0.5, cz = 0.5, freq = 3): Pattern {
  return new Pattern("ripple", { cx, cz, freq });
}

export function checker(size = 5): Pattern {
  return new Pattern("checker", { size });
}

export function gridlines(spacing = 5): Pattern {
  return new Pattern("gridlines", { spacing });
}

export function pyramid(): Pattern {
  return new Pattern("pyramid", {});
}

export function flat(h = 0.5): Pattern {
  return new Pattern("flat", { h });
}

export function noise(scale = 4): Pattern {
  return new Pattern("noise", { scale });
}

export function map(fn: PatternFn): Pattern {
  return new Pattern("map", { fn });
}

export function seq(...patterns: Pattern[]): Pattern {
  return new Pattern("seq", { patterns });
}

export function sleep(duration = Infinity): Pattern {
  return new Pattern("sleep", { duration });
}

export function blend(a: Pattern, b: Pattern, mix: number | PatternFn | Pattern = 0.5): Pattern {
  return new Pattern("blend", { a, b, mix });
}

export function add(a: Pattern, b: Pattern): Pattern {
  return new Pattern("add", { a, b });
}

export function mul(a: Pattern, b: Pattern): Pattern {
  return new Pattern("mul", { a, b });
}

export function inv(a: Pattern): Pattern {
  return new Pattern("inv", { source: a });
}

export function ease(a: Pattern): Pattern {
  return new Pattern("ease", { source: a });
}
