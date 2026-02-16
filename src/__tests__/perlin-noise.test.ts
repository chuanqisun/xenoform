import { describe, expect, it } from "vitest";
import { perlin2 } from "../utils/perlin-noise.ts";

describe("perlin-noise", () => {
  it("returns values in [0, 1] range", () => {
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * 20 - 10;
      const y = Math.random() * 20 - 10;
      const v = perlin2(x, y);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("is deterministic for same inputs", () => {
    const a = perlin2(1.5, 2.3);
    const b = perlin2(1.5, 2.3);
    expect(a).toBe(b);
  });

  it("varies across space", () => {
    const samples = new Set<number>();
    for (let i = 0; i < 10; i++) {
      samples.add(perlin2(i * 0.7, i * 0.3));
    }
    // Should not all be the same value
    expect(samples.size).toBeGreaterThan(1);
  });
});
