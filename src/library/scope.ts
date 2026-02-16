/**
 * Scope — builds the name/value arrays injected into user scripts.
 *
 * The scope maps short names (e.g. "wave", "sin", "PI") to their
 * implementations, providing the complete DSL environment.
 */

import { TAU, clamp01, fract, lerp, smoothstep } from "../utils/math-helpers.ts";
import type { PendingConfig } from "./config-api.ts";
import { setbackground, setdim, setrotate } from "./config-api.ts";
import * as factories from "./pattern-factories.ts";
import * as signals from "./signal-functions.ts";

export interface Scope {
  names: string[];
  values: unknown[];
}

/** Build a scope that writes config changes into the provided PendingConfig. */
export function buildScope(config: PendingConfig): Scope {
  const names: string[] = [];
  const values: unknown[] = [];

  function add(name: string, value: unknown) {
    names.push(name);
    values.push(value);
  }

  // Pattern factories
  add("wave", factories.wave);
  add("ripple", factories.ripple);
  add("checker", factories.checker);
  add("gridlines", factories.gridlines);
  add("pyramid", factories.pyramid);
  add("flat", factories.flat);
  add("noise", factories.noise);
  add("map", factories.map);
  add("seq", factories.seq);
  add("sleep", factories.sleep);
  add("blend", factories.blend);
  add("add", factories.add);
  add("mul", factories.mul);
  add("inv", factories.inv);
  add("ease", factories.ease);

  // Signal functions
  add("tween", signals.tween);
  add("osc", signals.osc);
  add("saw", signals.saw);
  add("pulse", signals.pulse);

  // Config APIs (closures over the provided config)
  add("setdim", (n: number) => setdim(config, n));
  add("setbackground", (color: string) => setbackground(config, color));
  add("setrotate", (mode: string) => setrotate(config, mode));

  // Math builtins
  add("sin", Math.sin);
  add("cos", Math.cos);
  add("abs", Math.abs);
  add("sqrt", Math.sqrt);
  add("floor", Math.floor);
  add("ceil", Math.ceil);
  add("round", Math.round);
  add("min", Math.min);
  add("max", Math.max);
  add("exp", Math.exp);
  add("log", Math.log);
  add("log2", Math.log2);
  add("pow", Math.pow);
  add("atan2", Math.atan2);
  add("hypot", Math.hypot);
  add("sign", Math.sign);

  // Math constants & helpers
  add("PI", Math.PI);
  add("TAU", TAU);
  add("E", Math.E);
  add("clamp", clamp01);
  add("lerp", lerp);
  add("smoothstep", smoothstep);
  add("fract", fract);

  return { names, values };
}
