/**
 * Pattern AST — the core data structure for the shape-display DSL.
 *
 * A Pattern node represents a lazy description of a height-field function.
 * Patterns are composed via chaining methods (`.rotate()`, `.blend()`, etc.)
 * and later compiled into executable `PatternFn` closures by the compiler.
 */

/** Signature for a compiled pattern function: (x, z, t, n) => height ∈ [0,1] */
export type PatternFn = (x: number, z: number, t: number, n: number) => number;

/** All recognized pattern node types. */
export type PatternType =
  | "flat"
  | "wave"
  | "ripple"
  | "checker"
  | "gridlines"
  | "pyramid"
  | "noise"
  | "map"
  | "sleep"
  | "seq"
  | "rotate"
  | "scale"
  | "offset"
  | "slow"
  | "fast"
  | "ease"
  | "inv"
  | "blend"
  | "add"
  | "mul";

/** Pattern arguments — kept as a loose record so each type can carry its own data. */
export type PatternArgs = Record<string, unknown>;

/**
 * A Pattern AST node.
 *
 * Instances form a DAG (via `source`, `a`, `b`, `patterns` in args).
 * A static registry tracks "root" patterns — those not consumed as children.
 */
export class Pattern {
  static _registry = new Set<Pattern>();

  readonly _type: PatternType;
  readonly _args: PatternArgs;

  constructor(type: PatternType, args: PatternArgs) {
    this._type = type;
    this._args = args;

    // Track this as a potential root
    Pattern._registry.add(this);

    // Any Pattern referenced as a child is not a root
    for (const val of Object.values(args)) {
      if (val instanceof Pattern) {
        Pattern._registry.delete(val);
      } else if (Array.isArray(val)) {
        for (const v of val) {
          if (v instanceof Pattern) Pattern._registry.delete(v);
        }
      }
    }
  }

  // --- Chainable transform methods ---

  rotate(angle: number | PatternFn | Pattern): Pattern {
    return new Pattern("rotate", { source: this, angle });
  }

  scale(sx: number, sz?: number): Pattern {
    return new Pattern("scale", { source: this, sx, sz });
  }

  offset(ox?: number | PatternFn | Pattern, oz?: number | PatternFn | Pattern): Pattern {
    return new Pattern("offset", { source: this, ox, oz });
  }

  slow(factor: number): Pattern {
    return new Pattern("slow", { source: this, factor });
  }

  fast(factor: number): Pattern {
    return new Pattern("fast", { source: this, factor });
  }

  ease(): Pattern {
    return new Pattern("ease", { source: this });
  }

  inv(): Pattern {
    return new Pattern("inv", { source: this });
  }

  blend(other: Pattern, mix: number | PatternFn | Pattern = 0.5): Pattern {
    return new Pattern("blend", { a: this, b: other, mix });
  }

  add(other: Pattern): Pattern {
    return new Pattern("add", { a: this, b: other });
  }

  mul(other: Pattern): Pattern {
    return new Pattern("mul", { a: this, b: other });
  }

  // --- Registry helpers ---

  /** Get all root patterns (those not consumed as children). */
  static getRoots(): Pattern[] {
    return [...Pattern._registry];
  }

  /** Clear the registry (call before each program run). */
  static clear(): void {
    Pattern._registry = new Set<Pattern>();
  }
}
