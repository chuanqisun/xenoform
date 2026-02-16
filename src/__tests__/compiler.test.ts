import { beforeEach, describe, expect, it } from "vitest";
import { Pattern } from "../language/ast.ts";
import { compile, resolveArg } from "../language/compiler.ts";

describe("compiler", () => {
  beforeEach(() => Pattern.clear());

  describe("resolveArg", () => {
    it("wraps a constant into a function", () => {
      const fn = resolveArg(0.5);
      expect(fn(0, 0, 0, 32)).toBe(0.5);
    });

    it("passes through a function", () => {
      const orig = (x: number) => x * 2;
      const fn = resolveArg(orig);
      expect(fn(0.3, 0, 0, 32)).toBeCloseTo(0.6);
    });

    it("compiles a Pattern arg", () => {
      const pat = new Pattern("flat", { h: 0.7 });
      const fn = resolveArg(pat);
      expect(fn(0, 0, 0, 32)).toBeCloseTo(0.7);
    });
  });

  describe("flat", () => {
    it("returns constant height", () => {
      const fn = compile(new Pattern("flat", { h: 0.3 }));
      expect(fn(0, 0, 0, 32)).toBeCloseTo(0.3);
      expect(fn(1, 1, 10, 32)).toBeCloseTo(0.3);
    });
  });

  describe("wave", () => {
    it("returns 0 at corners, peaks at center", () => {
      const fn = compile(new Pattern("wave", { fx: 1, fz: 1 }));
      // At x=0.25 (sin peak), z=0 (cos=1) → 1 * 1 = 1
      expect(fn(0.25, 0, 0, 32)).toBeCloseTo(1);
      // At x=0, z=0 → sin(0)=0 mapped to 0.5, cos(0)=1 mapped to 1 → 0.5
      expect(fn(0, 0, 0, 32)).toBeCloseTo(0.5);
    });
  });

  describe("checker", () => {
    it("alternates between 0.9 and 0.1", () => {
      const fn = compile(new Pattern("checker", { size: 2 }));
      const v1 = fn(0.1, 0.1, 0, 32);
      const v2 = fn(0.6, 0.1, 0, 32);
      expect([0.1, 0.9]).toContain(v1);
      expect([0.1, 0.9]).toContain(v2);
      expect(v1).not.toBe(v2);
    });
  });

  describe("pyramid", () => {
    it("peaks at center", () => {
      const fn = compile(new Pattern("pyramid", {}));
      expect(fn(0.5, 0.5, 0, 32)).toBeCloseTo(1);
    });
    it("low at edges", () => {
      const fn = compile(new Pattern("pyramid", {}));
      expect(fn(0, 0, 0, 32)).toBeCloseTo(0);
    });
  });

  describe("inv", () => {
    it("inverts a flat value", () => {
      const flat = new Pattern("flat", { h: 0.3 });
      const fn = compile(new Pattern("inv", { source: flat }));
      expect(fn(0, 0, 0, 32)).toBeCloseTo(0.7);
    });
  });

  describe("ease", () => {
    it("applies smoothstep to output", () => {
      const flat = new Pattern("flat", { h: 0.5 });
      const fn = compile(new Pattern("ease", { source: flat }));
      expect(fn(0, 0, 0, 32)).toBeCloseTo(0.5);
    });
  });

  describe("blend", () => {
    it("blends two patterns at 50%", () => {
      const a = new Pattern("flat", { h: 0 });
      const b = new Pattern("flat", { h: 1 });
      const fn = compile(new Pattern("blend", { a, b, mix: 0.5 }));
      expect(fn(0, 0, 0, 32)).toBeCloseTo(0.5);
    });
  });

  describe("add", () => {
    it("adds and clamps to [0,1]", () => {
      const a = new Pattern("flat", { h: 0.6 });
      const b = new Pattern("flat", { h: 0.7 });
      const fn = compile(new Pattern("add", { a, b }));
      expect(fn(0, 0, 0, 32)).toBe(1); // clamped
    });
  });

  describe("mul", () => {
    it("multiplies two patterns", () => {
      const a = new Pattern("flat", { h: 0.5 });
      const b = new Pattern("flat", { h: 0.6 });
      const fn = compile(new Pattern("mul", { a, b }));
      expect(fn(0, 0, 0, 32)).toBeCloseTo(0.3);
    });
  });

  describe("scale", () => {
    it("scales the coordinate space", () => {
      const src = new Pattern("pyramid", {});
      const fn = compile(new Pattern("scale", { source: src, sx: 2 }));
      // Center should still be 1
      expect(fn(0.5, 0.5, 0, 32)).toBeCloseTo(1);
    });
  });

  describe("slow / fast", () => {
    it("slow divides time", () => {
      const mapPat = new Pattern("map", { fn: (_x: number, _z: number, t: number) => t });
      const fn = compile(new Pattern("slow", { source: mapPat, factor: 2 }));
      expect(fn(0, 0, 4, 32)).toBeCloseTo(2);
    });
    it("fast multiplies time", () => {
      const mapPat = new Pattern("map", { fn: (_x: number, _z: number, t: number) => t });
      const fn = compile(new Pattern("fast", { source: mapPat, factor: 3 }));
      expect(fn(0, 0, 2, 32)).toBeCloseTo(6);
    });
  });

  describe("map", () => {
    it("uses a user-provided function", () => {
      const fn = compile(new Pattern("map", { fn: (x: number, z: number) => x + z }));
      expect(fn(0.3, 0.4, 0, 32)).toBeCloseTo(0.7);
    });
  });

  describe("noise", () => {
    it("returns values in [0,1]", () => {
      const fn = compile(new Pattern("noise", { scale: 4 }));
      for (let i = 0; i < 20; i++) {
        const v = fn(Math.random(), Math.random(), Math.random() * 10, 32);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("seq", () => {
    it("compiles without error", () => {
      const p1 = new Pattern("flat", { h: 0 });
      const p2 = new Pattern("flat", { h: 1 });
      const fn = compile(new Pattern("seq", { patterns: [p1, p2] }));
      expect(typeof fn).toBe("function");
    });

    it("returns values for different times", () => {
      const p1 = new Pattern("flat", { h: 0.2 });
      const p2 = new Pattern("flat", { h: 0.8 });
      const fn = compile(new Pattern("seq", { patterns: [p1, p2] }));
      // At t=0, should be in first pattern
      expect(fn(0, 0, 0, 32)).toBeCloseTo(0.2);
    });

    it("auto-subdivides time evenly among patterns", () => {
      const p1 = new Pattern("flat", { h: 0.2 });
      const p2 = new Pattern("flat", { h: 0.8 });
      // With secondsPerCycle=1 by default:
      // p1: [0,1], crossfade: [1,1.4], p2: [1.4,2.4], wrap xfade: [2.4,2.8]
      const fn = compile(new Pattern("seq", { patterns: [p1, p2] }));
      expect(fn(0, 0, 1, 32)).toBeCloseTo(0.2); // firmly in p1
      expect(fn(0, 0, 5, 32)).toBeCloseTo(0.8); // firmly in p2
    });

    it("uses configured seconds-per-cycle", () => {
      const p1 = new Pattern("flat", { h: 0.1 });
      const p2 = new Pattern("flat", { h: 0.9 });
      const fn = compile(new Pattern("seq", { patterns: [p1, p2] }), { secondsPerCycle: 2 });
      // p1: [0,2], xfade [2,2.8], p2: [2.8,4.8]
      expect(fn(0, 0, 1.5, 32)).toBeCloseTo(0.1);
      expect(fn(0, 0, 3.2, 32)).toBeCloseTo(0.9);
    });

    it(".time() overrides default duration in seq", () => {
      const p1 = new Pattern("flat", { h: 0.2 });
      const p1Timed = new Pattern("time", { source: p1, seconds: 10 });
      const p2 = new Pattern("flat", { h: 0.8 });
      const fn = compile(new Pattern("seq", { patterns: [p1Timed, p2] }));
      // At t=0, in first pattern (10s duration)
      expect(fn(0, 0, 0, 32)).toBeCloseTo(0.2);
      // At t=5, still in first pattern (well within 10s)
      expect(fn(0, 0, 5, 32)).toBeCloseTo(0.2);
      // At t=9, still in first pattern
      expect(fn(0, 0, 9, 32)).toBeCloseTo(0.2);
    });

    it("nested seq subdivides parent allocation", () => {
      const a = new Pattern("flat", { h: 0.1 });
      const b = new Pattern("flat", { h: 0.5 });
      const c = new Pattern("flat", { h: 0.9 });
      const innerSeq = new Pattern("seq", { patterns: [b, c] });
      // nested seq extends duration instead of subdividing parent duration
      const fn = compile(new Pattern("seq", { patterns: [a, innerSeq] }));
      // At t=0, should be in pattern a
      expect(fn(0, 0, 0, 32)).toBeCloseTo(0.1);
    });

    it("wrap transition has the same duration rule as internal transitions", () => {
      const p1 = new Pattern("flat", { h: 0 });
      const p2 = new Pattern("flat", { h: 1 });
      const fn = compile(new Pattern("seq", { patterns: [p1, p2] }));
      // total duration is 2.8; just after wrap starts we should be in blend, not hard jump
      const v = fn(0, 0, 2.5, 32);
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThan(1);
    });

    it("top-level seq().time() compresses timeline instead of being ignored", () => {
      const p1 = new Pattern("flat", { h: 0 });
      const p2 = new Pattern("flat", { h: 1 });
      const seq = new Pattern("seq", { patterns: [p1, p2] });
      const fn = compile(new Pattern("time", { source: seq, seconds: 1.4 }));
      // Base seq second pattern starts at t=1.4; compressing 2.8s -> 1.4s should reach it by t=0.7.
      expect(fn(0, 0, 1.0, 32)).toBeCloseTo(1);
    });

    it("nested seq .time() compresses inner timeline instead of cropping", () => {
      const a = new Pattern("flat", { h: 0.25 });
      const b = new Pattern("flat", { h: 0.75 });
      const inner = new Pattern("time", {
        source: new Pattern("seq", { patterns: [a, b] }),
        seconds: 1.4,
      });
      const outer = new Pattern("seq", { patterns: [inner] });
      const fn = compile(outer);
      // If compressed, inner local t=1.0 maps to source t=2.0 (firmly in second pattern).
      // If cropped, inner local t=1.0 stays t=1.0 (still in first pattern).
      expect(fn(0, 0, 1.0, 32)).toBeCloseTo(0.75);
    });
  });

  describe("time", () => {
    it("is transparent outside of seq (passes through to source)", () => {
      const flat = new Pattern("flat", { h: 0.6 });
      const timed = new Pattern("time", { source: flat, seconds: 5 });
      const fn = compile(timed);
      expect(fn(0, 0, 0, 32)).toBeCloseTo(0.6);
      expect(fn(0.5, 0.5, 10, 32)).toBeCloseTo(0.6);
    });
  });
});
