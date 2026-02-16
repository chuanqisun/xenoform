import { beforeEach, describe, expect, it } from "vitest";
import { Pattern } from "../language/ast.ts";
import { compile } from "../language/compiler.ts";
import { createPendingConfig, setbackground, setdim, setrotate, setspc } from "../library/config-api.ts";
import * as factories from "../library/pattern-factories.ts";
import { buildScope } from "../library/scope.ts";
import * as signals from "../library/signal-functions.ts";

describe("pattern-factories", () => {
  beforeEach(() => Pattern.clear());

  it("wave() creates a wave pattern", () => {
    const p = factories.wave(2, 3);
    expect(p._type).toBe("wave");
    expect(p._args.fx).toBe(2);
    expect(p._args.fz).toBe(3);
  });

  it("flat() creates a flat pattern with default h", () => {
    const p = factories.flat();
    expect(p._type).toBe("flat");
    expect(p._args.h).toBe(0.5);
  });

  it("seq() creates a seq pattern from varargs", () => {
    const p = factories.seq(factories.flat(0), factories.wave());
    expect(p._type).toBe("seq");
    expect((p._args.patterns as Pattern[]).length).toBe(2);
  });

  it("sleep() creates a sleep pattern", () => {
    const p = factories.sleep();
    expect(p._type).toBe("sleep");
    expect(p._args.duration).toBe(Infinity);
  });

  it("factory patterns can be compiled and evaluated", () => {
    const p = factories.pyramid();
    const fn = compile(p);
    expect(fn(0.5, 0.5, 0, 32)).toBeCloseTo(1);
  });
});

describe("signal-functions", () => {
  it("tween interpolates over time", () => {
    const fn = signals.tween(0, 10, 2);
    expect(fn(0, 0, 0, 32)).toBeCloseTo(0);
    expect(fn(0, 0, 2, 32)).toBeCloseTo(10);
    expect(fn(0, 0, 1, 32)).toBeGreaterThan(0);
    expect(fn(0, 0, 1, 32)).toBeLessThan(10);
  });

  it("tween with zero duration returns target", () => {
    const fn = signals.tween(0, 5, 0);
    expect(fn(0, 0, 0, 32)).toBe(5);
  });

  it("osc oscillates between lo and hi", () => {
    const fn = signals.osc(1, 0, 1);
    const values = Array.from({ length: 100 }, (_, i) => fn(0, 0, i * 0.01, 32));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(-0.01);
    expect(Math.max(...values)).toBeLessThanOrEqual(1.01);
  });

  it("saw ramps from lo to hi", () => {
    const fn = signals.saw(1, 0, 10);
    expect(fn(0, 0, 0, 32)).toBeCloseTo(0);
    expect(fn(0, 0, 0.5, 32)).toBeCloseTo(5);
  });

  it("pulse alternates between 0 and 1", () => {
    const fn = signals.pulse(1, 0.5);
    expect(fn(0, 0, 0.1, 32)).toBe(1);
    expect(fn(0, 0, 0.7, 32)).toBe(0);
  });
});

describe("config-api", () => {
  it("setdim clamps to [2, 64]", () => {
    const config = createPendingConfig();
    setdim(config, 100);
    expect(config.gridSize).toBe(64);
    setdim(config, 0);
    expect(config.gridSize).toBe(2);
    setdim(config, 16);
    expect(config.gridSize).toBe(16);
  });

  it("setbackground stores color string", () => {
    const config = createPendingConfig();
    setbackground(config, "#ff0000");
    expect(config.background).toBe("#ff0000");
  });

  it("setrotate accepts valid modes", () => {
    const config = createPendingConfig();
    setrotate(config, "on");
    expect(config.rotateMode).toBe("on");
    setrotate(config, "OFF");
    expect(config.rotateMode).toBe("off");
    setrotate(config, "Auto");
    expect(config.rotateMode).toBe("auto");
  });

  it("setrotate ignores invalid modes", () => {
    const config = createPendingConfig();
    setrotate(config, "invalid");
    expect(config.rotateMode).toBeNull();
  });

  it("setspc stores positive seconds-per-cycle", () => {
    const config = createPendingConfig();
    setspc(config, 2.5);
    expect(config.secondsPerCycle).toBe(2.5);
  });

  it("setspc ignores non-positive values", () => {
    const config = createPendingConfig();
    setspc(config, 0);
    expect(config.secondsPerCycle).toBeNull();
  });
});

describe("scope", () => {
  it("builds scope with matching names and values", () => {
    const config = createPendingConfig();
    const scope = buildScope(config);
    expect(scope.names.length).toBe(scope.values.length);
    expect(scope.names.length).toBeGreaterThan(40);
  });

  it("includes all pattern factories", () => {
    const config = createPendingConfig();
    const scope = buildScope(config);
    for (const name of ["wave", "ripple", "checker", "flat", "noise", "seq", "map"]) {
      expect(scope.names).toContain(name);
    }
  });

  it("includes math functions and constants", () => {
    const config = createPendingConfig();
    const scope = buildScope(config);
    expect(scope.names).toContain("sin");
    expect(scope.names).toContain("PI");
    expect(scope.names).toContain("TAU");
  });

  it("config setters write to provided config", () => {
    const config = createPendingConfig();
    const scope = buildScope(config);
    const setdimIdx = scope.names.indexOf("setdim");
    (scope.values[setdimIdx] as (n: number) => void)(16);
    expect(config.gridSize).toBe(16);

    const setspcIdx = scope.names.indexOf("setspc");
    (scope.values[setspcIdx] as (n: number) => void)(1.5);
    expect(config.secondsPerCycle).toBe(1.5);
  });
});
