/**
 * Pattern compiler — converts Pattern AST nodes into executable PatternFn closures.
 */

import { clamp01, smoothstep } from "../utils/math-helpers.ts";
import { perlin2 } from "../utils/perlin-noise.ts";
import type { PatternFn } from "./ast.ts";
import { Pattern } from "./ast.ts";

/**
 * Resolve a value that may be a Pattern, a function, or a constant
 * into a PatternFn.
 */
export function resolveArg(v: unknown): PatternFn {
  if (v instanceof Pattern) return compile(v);
  if (typeof v === "function") return v as PatternFn;
  const c = v as number;
  return () => c;
}

/** Default seconds-per-cycle for sequence timing. */
export const DEFAULT_SECONDS_PER_CYCLE = 1;

export interface CompileContext {
  secondsPerCycle: number;
}

const defaultContext: CompileContext = {
  secondsPerCycle: DEFAULT_SECONDS_PER_CYCLE,
};

interface CompiledNode {
  fn: PatternFn;
  duration: number;
}

function resolveArgWithContext(v: unknown, ctx: CompileContext): PatternFn {
  if (v instanceof Pattern) return compile(v, ctx);
  if (typeof v === "function") return v as PatternFn;
  const c = v as number;
  return () => c;
}

/** Compile a Pattern AST node into an executable PatternFn. */
export function compile(pat: Pattern, ctx: Partial<CompileContext> = {}): PatternFn {
  const fullCtx: CompileContext = {
    ...defaultContext,
    ...ctx,
  };
  return compileNode(pat, fullCtx).fn;
}

function compileNode(pat: Pattern, ctx: CompileContext): CompiledNode {
  const { _type: type, _args: a } = pat;
  const { sin, cos, abs, sqrt, floor, PI, max, round } = Math;
  const spc = ctx.secondsPerCycle;

  function transitionDuration(toDur: number): number {
    return Math.min(0.8, toDur * 0.4);
  }

  function unwrapTime(p: Pattern): { inner: Pattern; duration: number | null } {
    if (p._type === "time") {
      return { inner: p._args.source as Pattern, duration: p._args.seconds as number };
    }
    return { inner: p, duration: null };
  }

  switch (type) {
    case "flat": {
      const h = a.h as number;
      return { fn: () => h, duration: spc };
    }
    case "wave": {
      const fx = (a.fx as number) ?? 1;
      const fz = (a.fz as number) ?? 1;
      return {
        fn: (x, z) => (sin(x * fx * PI * 2) * 0.5 + 0.5) * (cos(z * fz * PI * 2) * 0.5 + 0.5),
        duration: spc,
      };
    }
    case "ripple": {
      const cx = (a.cx as number) ?? 0.5;
      const cz = (a.cz as number) ?? 0.5;
      const freq = (a.freq as number) ?? 3;
      return {
        fn: (x, z) => {
          const d = sqrt((x - cx) ** 2 + (z - cz) ** 2);
          return sin(d * freq * PI * 2) * 0.5 + 0.5;
        },
        duration: spc,
      };
    }
    case "checker": {
      const sz = (a.size as number) ?? 5;
      return { fn: (x, z) => ((floor(x * sz) + floor(z * sz)) % 2 === 0 ? 0.9 : 0.1), duration: spc };
    }
    case "gridlines": {
      const sp = (a.spacing as number) ?? 5;
      return {
        fn: (x, z, _t, n) => {
          const ix = round(x * (n - 1));
          const iz = round(z * (n - 1));
          return ix % sp === 0 || iz % sp === 0 ? 1 : 0.05;
        },
        duration: spc,
      };
    }
    case "pyramid":
      return { fn: (x, z) => 1 - max(abs(x - 0.5), abs(z - 0.5)) * 2, duration: spc };
    case "noise": {
      const sc = (a.scale as number) ?? 4;
      return { fn: (x, z, t) => perlin2(x * sc + t * 0.3, z * sc + t * 0.2), duration: spc };
    }
    case "map":
      return { fn: a.fn as PatternFn, duration: spc };
    case "sleep":
      return { fn: () => 0, duration: (a.duration as number) ?? Infinity };
    case "seq": {
      const items = a.patterns as Pattern[];

      interface Segment {
        s: number;
        e: number;
        type: "p" | "h" | "x";
        fn?: PatternFn;
        from?: PatternFn;
        to?: PatternFn;
      }

      interface PlannedItem {
        type: "p" | "h";
        fn: PatternFn;
        duration: number;
      }

      const planned: PlannedItem[] = [];

      for (const item of items) {
        const { inner, duration: explicitDur } = unwrapTime(item);
        if (inner._type === "sleep") {
          const sleepDur = explicitDur ?? ((inner._args.duration as number) ?? Infinity);
          planned.push({ type: "h", fn: () => 0, duration: sleepDur });
          if (!isFinite(sleepDur)) break;
          continue;
        }

        const compiled = compileNode(inner, ctx);
        const targetDur = explicitDur ?? compiled.duration;
        let fn = compiled.fn;
        if (
          explicitDur !== null &&
          Number.isFinite(explicitDur) &&
          explicitDur > 0 &&
          Number.isFinite(compiled.duration) &&
          compiled.duration > 0
        ) {
          const scale = compiled.duration / explicitDur;
          const srcFn = compiled.fn;
          fn = (x, z, t, n) => srcFn(x, z, t * scale, n);
        }
        planned.push({
          type: "p",
          fn,
          duration: targetDur,
        });
      }

      const segs: Segment[] = [];
      let cursor = 0;
      let lastFn: PatternFn | null = null;
      let firstFn: PatternFn | null = null;
      let firstPatternDur = spc;
      let hasInfHold = false;

      for (const plan of planned) {
        if (plan.type === "h") {
          if (!isFinite(plan.duration)) {
            segs.push({ s: cursor, e: Infinity, type: "h", fn: lastFn ?? undefined });
            hasInfHold = true;
            break;
          }
          if (lastFn) {
            segs.push({ s: cursor, e: cursor + plan.duration, type: "h", fn: lastFn });
            cursor += plan.duration;
          }
        } else {
          const segDur = plan.duration;
          const fn = plan.fn;
          if (firstFn === null) {
            firstFn = fn;
            firstPatternDur = segDur;
          }
          if (lastFn !== null) {
            const tt = transitionDuration(segDur);
            segs.push({ s: cursor, e: cursor + tt, type: "x", from: lastFn, to: fn });
            cursor += tt;
          }
          segs.push({ s: cursor, e: cursor + segDur, type: "p", fn });
          cursor += segDur;
          lastFn = fn;
        }
      }

      if (!hasInfHold && firstFn && lastFn && firstFn !== lastFn) {
        const tt = transitionDuration(firstPatternDur);
        segs.push({ s: cursor, e: cursor + tt, type: "x", from: lastFn, to: firstFn });
        cursor += tt;
      }

      const totalDur = hasInfHold ? Infinity : cursor;

      const fn: PatternFn = (x, z, t, n) => {
        const lt = isFinite(totalDur) && totalDur > 0 ? t % totalDur : t;
        for (const seg of segs) {
          if (lt < seg.e || !isFinite(seg.e)) {
            if (seg.type === "p" || seg.type === "h") {
              return seg.fn ? seg.fn(x, z, lt - seg.s, n) : 0;
            }
            if (seg.type === "x") {
              const bl = smoothstep((lt - seg.s) / (seg.e - seg.s));
              const localT = lt - seg.s;
              return (seg.from?.(x, z, localT, n) ?? 0) * (1 - bl) + (seg.to?.(x, z, localT, n) ?? 0) * bl;
            }
          }
        }
        return lastFn ? lastFn(x, z, 0, n) : 0;
      };

      return { fn, duration: totalDur };
    }
    case "rotate": {
      const srcNode = compileNode(a.source as Pattern, ctx);
      const srcFn = srcNode.fn;
      const angFn = resolveArgWithContext(a.angle, ctx);
      return {
        fn: (x, z, t, n) => {
          const ang = angFn(x, z, t, n);
          const cx2 = x - 0.5;
          const cz2 = z - 0.5;
          return srcFn(cx2 * cos(ang) - cz2 * sin(ang) + 0.5, cx2 * sin(ang) + cz2 * cos(ang) + 0.5, t, n);
        },
        duration: srcNode.duration,
      };
    }
    case "scale": {
      const srcNode = compileNode(a.source as Pattern, ctx);
      const srcFn = srcNode.fn;
      const sx = a.sx as number;
      const sz = (a.sz as number) ?? sx;
      return {
        fn: (x, z, t, n) => srcFn((x - 0.5) / sx + 0.5, (z - 0.5) / sz + 0.5, t, n),
        duration: srcNode.duration,
      };
    }
    case "offset": {
      const srcNode = compileNode(a.source as Pattern, ctx);
      const srcFn = srcNode.fn;
      const oxFn = resolveArgWithContext(a.ox ?? 0, ctx);
      const ozFn = resolveArgWithContext(a.oz ?? 0, ctx);
      return {
        fn: (x, z, t, n) => srcFn(x - oxFn(x, z, t, n), z - ozFn(x, z, t, n), t, n),
        duration: srcNode.duration,
      };
    }
    case "slow": {
      const srcNode = compileNode(a.source as Pattern, ctx);
      const srcFn = srcNode.fn;
      const f = a.factor as number;
      return {
        fn: (x, z, t, n) => srcFn(x, z, t / f, n),
        duration: srcNode.duration * f,
      };
    }
    case "fast": {
      const srcNode = compileNode(a.source as Pattern, ctx);
      const srcFn = srcNode.fn;
      const f = a.factor as number;
      return {
        fn: (x, z, t, n) => srcFn(x, z, t * f, n),
        duration: srcNode.duration / f,
      };
    }
    case "ease": {
      const srcNode = compileNode(a.source as Pattern, ctx);
      const srcFn = srcNode.fn;
      return { fn: (x, z, t, n) => smoothstep(srcFn(x, z, t, n)), duration: srcNode.duration };
    }
    case "inv": {
      const srcNode = compileNode(a.source as Pattern, ctx);
      const srcFn = srcNode.fn;
      return { fn: (x, z, t, n) => 1 - srcFn(x, z, t, n), duration: srcNode.duration };
    }
    case "blend": {
      const aNode = compileNode(a.a as Pattern, ctx);
      const bNode = compileNode(a.b as Pattern, ctx);
      const aFn = aNode.fn;
      const bFn = bNode.fn;
      const mFn = resolveArgWithContext(a.mix, ctx);
      return {
        fn: (x, z, t, n) => {
          const m = mFn(x, z, t, n);
          return aFn(x, z, t, n) * (1 - m) + bFn(x, z, t, n) * m;
        },
        duration: Math.max(aNode.duration, bNode.duration),
      };
    }
    case "add": {
      const aNode = compileNode(a.a as Pattern, ctx);
      const bNode = compileNode(a.b as Pattern, ctx);
      const aFn = aNode.fn;
      const bFn = bNode.fn;
      return {
        fn: (x, z, t, n) => clamp01(aFn(x, z, t, n) + bFn(x, z, t, n)),
        duration: Math.max(aNode.duration, bNode.duration),
      };
    }
    case "mul": {
      const aNode = compileNode(a.a as Pattern, ctx);
      const bNode = compileNode(a.b as Pattern, ctx);
      const aFn = aNode.fn;
      const bFn = bNode.fn;
      return {
        fn: (x, z, t, n) => aFn(x, z, t, n) * bFn(x, z, t, n),
        duration: Math.max(aNode.duration, bNode.duration),
      };
    }
    case "time": {
      const srcNode = compileNode(a.source as Pattern, ctx);
      const srcFn = srcNode.fn;
      const seconds = a.seconds as number;
      const source = a.source as Pattern;
      if (
        source._type === "seq" &&
        Number.isFinite(seconds) &&
        seconds > 0 &&
        Number.isFinite(srcNode.duration) &&
        srcNode.duration > 0
      ) {
        const scale = srcNode.duration / seconds;
        return {
          fn: (x, z, t, n) => srcFn(x, z, t * scale, n),
          duration: seconds,
        };
      }
      return {
        fn: (x, z, t, n) => srcFn(x, z, t, n),
        duration: seconds,
      };
    }
    default:
      return { fn: () => 0, duration: spc };
  }
}
