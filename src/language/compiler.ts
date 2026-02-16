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

/** Compile a Pattern AST node into an executable PatternFn. */
export function compile(pat: Pattern): PatternFn {
  const { _type: type, _args: a } = pat;
  const { sin, cos, abs, sqrt, floor, PI, max, round } = Math;

  switch (type) {
    case "flat": {
      const h = a.h as number;
      return () => h;
    }
    case "wave": {
      const fx = (a.fx as number) ?? 1;
      const fz = (a.fz as number) ?? 1;
      return (x, z) => (sin(x * fx * PI * 2) * 0.5 + 0.5) * (cos(z * fz * PI * 2) * 0.5 + 0.5);
    }
    case "ripple": {
      const cx = (a.cx as number) ?? 0.5;
      const cz = (a.cz as number) ?? 0.5;
      const freq = (a.freq as number) ?? 3;
      return (x, z) => {
        const d = sqrt((x - cx) ** 2 + (z - cz) ** 2);
        return sin(d * freq * PI * 2) * 0.5 + 0.5;
      };
    }
    case "checker": {
      const sz = (a.size as number) ?? 5;
      return (x, z) => ((floor(x * sz) + floor(z * sz)) % 2 === 0 ? 0.9 : 0.1);
    }
    case "gridlines": {
      const sp = (a.spacing as number) ?? 5;
      return (x, z, _t, n) => {
        const ix = round(x * (n - 1));
        const iz = round(z * (n - 1));
        return ix % sp === 0 || iz % sp === 0 ? 1 : 0.05;
      };
    }
    case "pyramid":
      return (x, z) => 1 - max(abs(x - 0.5), abs(z - 0.5)) * 2;
    case "noise": {
      const sc = (a.scale as number) ?? 4;
      return (x, z, t) => perlin2(x * sc + t * 0.3, z * sc + t * 0.2);
    }
    case "map":
      return a.fn as PatternFn;
    case "sleep":
      return () => 0;
    case "seq": {
      const dur = a.dur as number;
      const items = a.patterns as Pattern[];
      const transTime = 0.8;

      interface Segment {
        s: number;
        e: number;
        type: "p" | "h" | "x";
        fn?: PatternFn;
        from?: PatternFn;
        to?: PatternFn;
      }

      const segs: Segment[] = [];
      let cursor = 0;
      let lastFn: PatternFn | null = null;
      let hasInfHold = false;

      for (const item of items) {
        if (item._type === "sleep") {
          const sd = item._args.duration as number;
          if (!isFinite(sd)) {
            segs.push({ s: cursor, e: Infinity, type: "h", fn: lastFn ?? undefined });
            hasInfHold = true;
            break;
          }
          if (lastFn) {
            segs.push({ s: cursor, e: cursor + sd, type: "h", fn: lastFn });
            cursor += sd;
          }
        } else {
          const fn = compile(item);
          if (lastFn !== null) {
            segs.push({ s: cursor, e: cursor + transTime, type: "x", from: lastFn, to: fn });
            cursor += transTime;
          }
          segs.push({ s: cursor, e: cursor + dur, type: "p", fn });
          cursor += dur;
          lastFn = fn;
        }
      }

      if (!hasInfHold && segs.length > 0) {
        const firstFn = segs.find((s) => s.type === "p")?.fn;
        if (firstFn && lastFn && firstFn !== lastFn) {
          segs.push({ s: cursor, e: cursor + transTime, type: "x", from: lastFn, to: firstFn });
          cursor += transTime;
        }
      }

      const totalDur = hasInfHold ? Infinity : cursor;

      return (x, z, t, n) => {
        const lt = isFinite(totalDur) ? t % totalDur : t;
        for (const seg of segs) {
          if (lt < seg.e || !isFinite(seg.e)) {
            if (seg.type === "p" || seg.type === "h") return seg.fn ? seg.fn(x, z, t, n) : 0;
            if (seg.type === "x") {
              const bl = smoothstep((lt - seg.s) / (seg.e - seg.s));
              return (seg.from?.(x, z, t, n) ?? 0) * (1 - bl) + (seg.to?.(x, z, t, n) ?? 0) * bl;
            }
          }
        }
        return lastFn ? lastFn(x, z, t, n) : 0;
      };
    }
    case "rotate": {
      const srcFn = compile(a.source as Pattern);
      const angFn = resolveArg(a.angle);
      return (x, z, t, n) => {
        const ang = angFn(x, z, t, n);
        const cx2 = x - 0.5;
        const cz2 = z - 0.5;
        return srcFn(cx2 * cos(ang) - cz2 * sin(ang) + 0.5, cx2 * sin(ang) + cz2 * cos(ang) + 0.5, t, n);
      };
    }
    case "scale": {
      const srcFn = compile(a.source as Pattern);
      const sx = a.sx as number;
      const sz = (a.sz as number) ?? sx;
      return (x, z, t, n) => srcFn((x - 0.5) / sx + 0.5, (z - 0.5) / sz + 0.5, t, n);
    }
    case "offset": {
      const srcFn = compile(a.source as Pattern);
      const oxFn = resolveArg(a.ox ?? 0);
      const ozFn = resolveArg(a.oz ?? 0);
      return (x, z, t, n) => srcFn(x - oxFn(x, z, t, n), z - ozFn(x, z, t, n), t, n);
    }
    case "slow": {
      const srcFn = compile(a.source as Pattern);
      const f = a.factor as number;
      return (x, z, t, n) => srcFn(x, z, t / f, n);
    }
    case "fast": {
      const srcFn = compile(a.source as Pattern);
      const f = a.factor as number;
      return (x, z, t, n) => srcFn(x, z, t * f, n);
    }
    case "ease": {
      const srcFn = compile(a.source as Pattern);
      return (x, z, t, n) => smoothstep(srcFn(x, z, t, n));
    }
    case "inv": {
      const srcFn = compile(a.source as Pattern);
      return (x, z, t, n) => 1 - srcFn(x, z, t, n);
    }
    case "blend": {
      const aFn = compile(a.a as Pattern);
      const bFn = compile(a.b as Pattern);
      const mFn = resolveArg(a.mix);
      return (x, z, t, n) => {
        const m = mFn(x, z, t, n);
        return aFn(x, z, t, n) * (1 - m) + bFn(x, z, t, n) * m;
      };
    }
    case "add": {
      const aFn = compile(a.a as Pattern);
      const bFn = compile(a.b as Pattern);
      return (x, z, t, n) => clamp01(aFn(x, z, t, n) + bFn(x, z, t, n));
    }
    case "mul": {
      const aFn = compile(a.a as Pattern);
      const bFn = compile(a.b as Pattern);
      return (x, z, t, n) => aFn(x, z, t, n) * bFn(x, z, t, n);
    }
    default:
      return () => 0;
  }
}
