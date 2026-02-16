import { describe, expect, it } from "vitest";
import { TAU, clamp, clamp01, fract, lerp, smoothstep } from "../utils/math-helpers.ts";

describe("math-helpers", () => {
  describe("TAU", () => {
    it("equals 2π", () => {
      expect(TAU).toBeCloseTo(Math.PI * 2);
    });
  });

  describe("clamp01", () => {
    it("clamps below 0", () => expect(clamp01(-0.5)).toBe(0));
    it("clamps above 1", () => expect(clamp01(1.5)).toBe(1));
    it("passes through values in range", () => expect(clamp01(0.3)).toBeCloseTo(0.3));
  });

  describe("clamp", () => {
    it("uses default [0,1] range", () => {
      expect(clamp(-1)).toBe(0);
      expect(clamp(2)).toBe(1);
    });
    it("respects custom lo/hi", () => {
      expect(clamp(5, 2, 10)).toBe(5);
      expect(clamp(0, 2, 10)).toBe(2);
      expect(clamp(15, 2, 10)).toBe(10);
    });
  });

  describe("lerp", () => {
    it("returns a at t=0", () => expect(lerp(3, 7, 0)).toBe(3));
    it("returns b at t=1", () => expect(lerp(3, 7, 1)).toBe(7));
    it("returns midpoint at t=0.5", () => expect(lerp(0, 10, 0.5)).toBe(5));
  });

  describe("smoothstep", () => {
    it("returns 0 at t=0", () => expect(smoothstep(0)).toBe(0));
    it("returns 1 at t=1", () => expect(smoothstep(1)).toBe(1));
    it("returns 0.5 at t=0.5", () => expect(smoothstep(0.5)).toBeCloseTo(0.5));
    it("clamps below 0", () => expect(smoothstep(-1)).toBe(0));
    it("clamps above 1", () => expect(smoothstep(2)).toBe(1));
  });

  describe("fract", () => {
    it("extracts fractional part", () => expect(fract(3.7)).toBeCloseTo(0.7));
    it("returns 0 for integers", () => expect(fract(5)).toBeCloseTo(0));
    it("handles negative values", () => expect(fract(-0.3)).toBeCloseTo(0.7));
  });
});
