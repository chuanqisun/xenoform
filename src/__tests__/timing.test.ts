import { beforeEach, describe, expect, it } from "vitest";
import { Pattern } from "../language/ast.ts";
import { compile, DEFAULT_SECONDS_PER_CYCLE } from "../language/compiler.ts";

/**
 * Timing-specific tests — verifies sequence crossfade timing, loop boundary
 * behaviour, sleep holds, and time compression to catch regressions.
 */
describe("compiler timing", () => {
  beforeEach(() => Pattern.clear());

  describe("crossfade timing", () => {
    it("crossfade between two patterns is at most 0.8s", () => {
      const p1 = new Pattern("flat", { h: 0 });
      const p2 = new Pattern("flat", { h: 1 });
      const fn = compile(new Pattern("seq", { patterns: [p1, p2] }));
      // At spc=1, p1: [0,1], crossfade: [1,1.4] (min(0.8, 1*0.4)=0.4), p2: [1.4,2.4]
      // At t=1.2, midway through crossfade, expect blended value
      const mid = fn(0, 0, 1.2, 32);
      expect(mid).toBeGreaterThan(0);
      expect(mid).toBeLessThan(1);
      // At t=1.5, past crossfade, expect second pattern value
      expect(fn(0, 0, 1.5, 32)).toBeCloseTo(1);
    });

    it("crossfade duration scales with target pattern duration", () => {
      // With a 0.5s pattern, crossfade = min(0.8, 0.5*0.4) = 0.2
      const p1 = new Pattern("flat", { h: 0 });
      const p2 = new Pattern("flat", { h: 1 });
      const fn = compile(new Pattern("seq", { patterns: [p1, p2] }), { secondsPerCycle: 0.5 });
      // p1: [0,0.5], crossfade: [0.5,0.7], p2: [0.7,1.2]
      expect(fn(0, 0, 0.6, 32)).toBeGreaterThan(0);
      expect(fn(0, 0, 0.6, 32)).toBeLessThan(1);
      expect(fn(0, 0, 0.8, 32)).toBeCloseTo(1);
    });

    it("crossfade caps at 0.8s for long durations", () => {
      // With spc=10, crossfade = min(0.8, 10*0.4) = 0.8
      const p1 = new Pattern("flat", { h: 0 });
      const p2 = new Pattern("flat", { h: 1 });
      const fn = compile(new Pattern("seq", { patterns: [p1, p2] }), { secondsPerCycle: 10 });
      // p1: [0,10], crossfade: [10,10.8], p2: [10.8,20.8]
      expect(fn(0, 0, 10.4, 32)).toBeGreaterThan(0);
      expect(fn(0, 0, 10.4, 32)).toBeLessThan(1);
      // Past crossfade: firmly in p2
      expect(fn(0, 0, 11, 32)).toBeCloseTo(1);
    });
  });

  describe("loop boundary", () => {
    it("loops back to first pattern after total duration", () => {
      const p1 = new Pattern("flat", { h: 0 });
      const p2 = new Pattern("flat", { h: 1 });
      const fn = compile(new Pattern("seq", { patterns: [p1, p2] }));
      // p1: [0,1], xfade: [1,1.4], p2: [1.4,2.4], wrap xfade: [2.4,2.8] => loopDur 2.8
      // After one full loop, should be back in p1
      expect(fn(0, 0, 3.0, 32)).toBeCloseTo(0);
    });

    it("wrap crossfade blends last into first at loop boundary", () => {
      const p1 = new Pattern("flat", { h: 0 });
      const p2 = new Pattern("flat", { h: 1 });
      const fn = compile(new Pattern("seq", { patterns: [p1, p2] }));
      // Just after entering wrap crossfade zone
      const v = fn(0, 0, 2.5, 32);
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThan(1);
    });

    it("single pattern seq has simple modulo loop (no crossfade)", () => {
      const p = new Pattern("flat", { h: 0.5 });
      const fn = compile(new Pattern("seq", { patterns: [p] }));
      // At any time, should return 0.5
      expect(fn(0, 0, 0, 32)).toBeCloseTo(0.5);
      expect(fn(0, 0, 100, 32)).toBeCloseTo(0.5);
    });
  });

  describe("sleep timing", () => {
    it("sleep holds previous pattern for specified duration", () => {
      const p1 = new Pattern("flat", { h: 0.3 });
      const p2 = new Pattern("flat", { h: 0.9 });
      const fn = compile(new Pattern("seq", { patterns: [p1, new Pattern("sleep", { duration: 5 }), p2] }));
      // p1: [0,1], hold: [1,6], xfade: [6,6.4], p2: [6.4,7.4]
      expect(fn(0, 0, 3, 32)).toBeCloseTo(0.3); // still in hold
      expect(fn(0, 0, 7, 32)).toBeCloseTo(0.9); // in p2
    });

    it("sleep(Infinity) stops sequence from looping", () => {
      const p1 = new Pattern("flat", { h: 0.4 });
      const fn = compile(new Pattern("seq", { patterns: [p1, new Pattern("sleep", { duration: Infinity })] }));
      // Should hold p1 forever
      expect(fn(0, 0, 0, 32)).toBeCloseTo(0.4);
      expect(fn(0, 0, 100, 32)).toBeCloseTo(0.4);
      expect(fn(0, 0, 10000, 32)).toBeCloseTo(0.4);
    });
  });

  describe("time compression", () => {
    it(".time() compresses a sequence timeline proportionally", () => {
      const p1 = new Pattern("flat", { h: 0.2 });
      const p2 = new Pattern("flat", { h: 0.8 });
      const inner = new Pattern("seq", { patterns: [p1, p2] });
      // Base seq duration = 2.4 (p1[0,1] + xfade[1,1.4] + p2[1.4,2.4])
      // Compressing to 1.2s means time runs 2x faster inside
      const fn = compile(new Pattern("time", { source: inner, seconds: 1.2 }));
      // At t=0, should be first pattern
      expect(fn(0, 0, 0, 32)).toBeCloseTo(0.2);
      // At t=1.0, should be firmly in second pattern (compressed)
      expect(fn(0, 0, 1.0, 32)).toBeCloseTo(0.8);
    });

    it(".slow() doubles the effective duration of a seq", () => {
      const p1 = new Pattern("flat", { h: 0.1 });
      const p2 = new Pattern("flat", { h: 0.9 });
      const inner = new Pattern("seq", { patterns: [p1, p2] });
      const fn = compile(new Pattern("slow", { source: inner, factor: 2 }));
      // First pattern should still play at t=1 (since time is halved)
      expect(fn(0, 0, 1, 32)).toBeCloseTo(0.1);
    });

    it(".fast() halves the effective duration of a seq", () => {
      const p1 = new Pattern("flat", { h: 0.1 });
      const p2 = new Pattern("flat", { h: 0.9 });
      const inner = new Pattern("seq", { patterns: [p1, p2] });
      const fn = compile(new Pattern("fast", { source: inner, factor: 2 }));
      // Second pattern should play at t=1 (since time is doubled)
      expect(fn(0, 0, 1, 32)).toBeCloseTo(0.9);
    });
  });

  describe("seconds-per-cycle default", () => {
    it("defaults to 1 second", () => {
      expect(DEFAULT_SECONDS_PER_CYCLE).toBe(1);
    });

    it("pattern duration matches spc", () => {
      // map pattern that returns t directly — if duration=1s, at t=0.5 we get 0.5
      const fn = compile(new Pattern("map", { fn: (_x: number, _z: number, t: number) => t }));
      expect(fn(0, 0, 0.5, 32)).toBeCloseTo(0.5);
    });
  });
});
