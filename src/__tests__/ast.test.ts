import { beforeEach, describe, expect, it } from "vitest";
import { Pattern } from "../language/ast.ts";

describe("Pattern AST", () => {
  beforeEach(() => {
    Pattern.clear();
  });

  it("creates a pattern node with type and args", () => {
    const p = new Pattern("flat", { h: 0.5 });
    expect(p._type).toBe("flat");
    expect(p._args.h).toBe(0.5);
  });

  it("tracks roots correctly — single pattern", () => {
    const p = new Pattern("wave", { fx: 1, fz: 1 });
    expect(Pattern.getRoots()).toEqual([p]);
  });

  it("removes children from root set when used as args", () => {
    const a = new Pattern("wave", { fx: 1, fz: 1 });
    const b = new Pattern("noise", { scale: 4 });
    const c = new Pattern("blend", { a, b, mix: 0.5 });
    const roots = Pattern.getRoots();
    expect(roots).toEqual([c]);
    expect(roots).not.toContain(a);
    expect(roots).not.toContain(b);
  });

  it("tracks array children in args (e.g. seq patterns)", () => {
    const p1 = new Pattern("flat", { h: 0 });
    const p2 = new Pattern("wave", { fx: 1, fz: 1 });
    const seq = new Pattern("seq", { patterns: [p1, p2] });
    expect(Pattern.getRoots()).toEqual([seq]);
  });

  it("clear() resets the registry", () => {
    new Pattern("flat", { h: 0.5 });
    expect(Pattern.getRoots().length).toBe(1);
    Pattern.clear();
    expect(Pattern.getRoots().length).toBe(0);
  });

  describe("chaining methods", () => {
    it("rotate() creates a rotate node", () => {
      const p = new Pattern("wave", { fx: 1, fz: 1 }).rotate(Math.PI);
      expect(p._type).toBe("rotate");
      expect(p._args.angle).toBe(Math.PI);
    });

    it("scale() creates a scale node", () => {
      const p = new Pattern("wave", { fx: 1, fz: 1 }).scale(2, 3);
      expect(p._type).toBe("scale");
      expect(p._args.sx).toBe(2);
      expect(p._args.sz).toBe(3);
    });

    it("blend() creates a blend node with default mix", () => {
      const a = new Pattern("wave", { fx: 1, fz: 1 });
      const b = new Pattern("noise", { scale: 4 });
      const c = a.blend(b);
      expect(c._type).toBe("blend");
      expect(c._args.mix).toBe(0.5);
    });

    it("inv() creates an inv node", () => {
      const p = new Pattern("flat", { h: 0.3 }).inv();
      expect(p._type).toBe("inv");
    });

    it("ease() creates an ease node", () => {
      const p = new Pattern("flat", { h: 0.3 }).ease();
      expect(p._type).toBe("ease");
    });

    it("add() creates an add node", () => {
      const a = new Pattern("flat", { h: 0.3 });
      const b = new Pattern("flat", { h: 0.5 });
      const c = a.add(b);
      expect(c._type).toBe("add");
    });

    it("mul() creates a mul node", () => {
      const a = new Pattern("flat", { h: 0.3 });
      const b = new Pattern("flat", { h: 0.5 });
      const c = a.mul(b);
      expect(c._type).toBe("mul");
    });

    it("slow/fast create time-warp nodes", () => {
      const p = new Pattern("wave", { fx: 1, fz: 1 });
      expect(p.slow(2)._type).toBe("slow");
      expect(p.fast(2)._type).toBe("fast");
    });

    it("time() creates a time duration node", () => {
      const p = new Pattern("wave", { fx: 1, fz: 1 }).time(5);
      expect(p._type).toBe("time");
      expect(p._args.seconds).toBe(5);
      expect(p._args.source).toBeInstanceOf(Pattern);
    });

    it("offset() creates an offset node", () => {
      const p = new Pattern("wave", { fx: 1, fz: 1 }).offset(0.1, 0.2);
      expect(p._type).toBe("offset");
      expect(p._args.ox).toBe(0.1);
      expect(p._args.oz).toBe(0.2);
    });
  });
});
