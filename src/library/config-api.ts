/**
 * Configuration API — side-effect functions that set pending state
 * to be applied by the runtime after script execution.
 */

export interface PendingConfig {
  gridSize: number | null;
  background: string | null;
  rotateMode: "on" | "off" | "auto" | null;
  secondsPerCycle: number | null;
}

/** Create a fresh config state (all null = no changes). */
export function createPendingConfig(): PendingConfig {
  return { gridSize: null, background: null, rotateMode: null, secondsPerCycle: null };
}

/** Set the grid dimension (clamped to 2–64). */
export function setdim(config: PendingConfig, n: number): void {
  config.gridSize = Math.max(2, Math.min(64, Math.round(n)));
}

/** Set the background color. */
export function setbackground(config: PendingConfig, color: string): void {
  config.background = color;
}

/** Set rotation mode: "on", "off", or "auto". */
export function setrotate(config: PendingConfig, mode: string): void {
  const m = String(mode).toLowerCase();
  if (m === "on" || m === "off" || m === "auto") {
    config.rotateMode = m;
  }
}

/** Set global seconds-per-cycle for sequence timing. */
export function setspc(config: PendingConfig, n: number): void {
  const v = Number(n);
  if (Number.isFinite(v) && v > 0) {
    config.secondsPerCycle = v;
  }
}
