/**
 * Interpreter — evaluates user code in a sandboxed scope
 * and extracts the resulting compiled pattern.
 */

import type { PatternFn } from "../language/ast.ts";
import { Pattern } from "../language/ast.ts";
import { compile } from "../language/compiler.ts";
import type { PendingConfig } from "../library/config-api.ts";
import { createPendingConfig } from "../library/config-api.ts";
import { buildScope } from "../library/scope.ts";

export interface RunResult {
  /** The compiled pattern function, or null if none was produced. */
  pattern: PatternFn | null;
  /** Pending configuration changes from the script. */
  config: PendingConfig;
  /** Error message, if execution failed. */
  error: string | null;
  /** Warning message (e.g. "no pattern created"). */
  warning: string | null;
}

/** Run user code and return the result without any side effects. */
export function runCode(code: string): RunResult {
  const config = createPendingConfig();
  try {
    Pattern.clear();
    const scope = buildScope(config);
    const fn = new Function(...scope.names, `"use strict";\n${code}`);
    fn(...scope.values);

    const roots = Pattern.getRoots();
    if (roots.length > 0) {
      const pattern = compile(roots[roots.length - 1], { secondsPerCycle: config.secondsPerCycle ?? 1 });
      return { pattern, config, error: null, warning: null };
    } else {
      return { pattern: null, config, error: null, warning: "No pattern created" };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { pattern: null, config, error: msg, warning: null };
  }
}
