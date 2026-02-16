import { describe, expect, it } from "vitest";
import { runCode } from "../runtime/interpreter.ts";

describe("interpreter", () => {
  it("compiles simple pattern code", () => {
    const result = runCode("flat(0.5)");
    expect(result.error).toBeNull();
    expect(result.warning).toBeNull();
    expect(result.pattern).not.toBeNull();
    expect(result.pattern!(0, 0, 0, 32)).toBeCloseTo(0.5);
  });

  it("returns warning when no pattern created", () => {
    const result = runCode("// just a comment");
    expect(result.error).toBeNull();
    expect(result.warning).toBe("No pattern created");
    expect(result.pattern).toBeNull();
  });

  it("returns error for invalid code", () => {
    const result = runCode("throw new Error('boom')");
    expect(result.error).toBe("boom");
    expect(result.pattern).toBeNull();
  });

  it("returns error for syntax errors", () => {
    const result = runCode("flat(0.5");
    expect(result.error).not.toBeNull();
  });

  it("picks the last root pattern", () => {
    const result = runCode("flat(0.2)\nflat(0.8)");
    expect(result.pattern).not.toBeNull();
    expect(result.pattern!(0, 0, 0, 32)).toBeCloseTo(0.8);
  });

  it("provides math builtins in scope", () => {
    const result = runCode("map((x, z, t) => sin(PI) * 0.5 + 0.5)");
    expect(result.pattern).not.toBeNull();
    // sin(PI) ≈ 0 → 0 * 0.5 + 0.5 = 0.5
    expect(result.pattern!(0, 0, 0, 32)).toBeCloseTo(0.5);
  });

  it("provides signal functions in scope", () => {
    const result = runCode("wave(1,1).rotate(tween(0, PI, 4))");
    expect(result.pattern).not.toBeNull();
    expect(result.error).toBeNull();
  });

  it("captures config changes", () => {
    const result = runCode("setdim(16)\nsetbackground('#ff0000')\nsetrotate('off')\nsetspc(2)\nflat(0.5)");
    expect(result.config.gridSize).toBe(16);
    expect(result.config.background).toBe("#ff0000");
    expect(result.config.rotateMode).toBe("off");
    expect(result.config.secondsPerCycle).toBe(2);
  });

  it("chaining works end-to-end", () => {
    const result = runCode("wave(1,1).rotate(PI).scale(2).inv().ease()");
    expect(result.pattern).not.toBeNull();
    expect(result.error).toBeNull();
    const v = result.pattern!(0.5, 0.5, 0, 32);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(1);
  });

  it("seq with sleep compiles", () => {
    const result = runCode("seq(flat(0), sleep(2), flat(1))");
    expect(result.pattern).not.toBeNull();
    expect(result.error).toBeNull();
  });
});
