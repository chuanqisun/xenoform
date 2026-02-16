/**
 * Panel resize — drag the right edge of the left panel to resize it.
 *
 * On narrow viewports (< 768px) the panel snaps to full width and
 * the resize handle is hidden.
 */

const MIN_WIDTH = 280;
const MAX_WIDTH_RATIO = 0.8;
const MOBILE_BREAKPOINT = 768;

export interface PanelResizeState {
  /** Current panel width in pixels. */
  width: number;
  /** Whether a drag is in progress. */
  dragging: boolean;
  /** The X position where the drag started. */
  startX: number;
  /** The panel width when the drag started. */
  startWidth: number;
}

/** Create initial resize state with a given panel width. */
export function createResizeState(initialWidth: number): PanelResizeState {
  return { width: initialWidth, dragging: false, startX: 0, startWidth: initialWidth };
}

/** Clamp a panel width to valid bounds for the given viewport width. */
export function clampWidth(width: number, viewportWidth: number): number {
  const maxW = Math.floor(viewportWidth * MAX_WIDTH_RATIO);
  return Math.max(MIN_WIDTH, Math.min(maxW, width));
}

/** Return true when the viewport is narrow enough for mobile mode. */
export function isMobile(viewportWidth: number): boolean {
  return viewportWidth < MOBILE_BREAKPOINT;
}

/** Begin a drag operation. */
export function startDrag(state: PanelResizeState, clientX: number): void {
  state.dragging = true;
  state.startX = clientX;
  state.startWidth = state.width;
}

/** Update width during a drag. Returns the new clamped width. */
export function updateDrag(state: PanelResizeState, clientX: number, viewportWidth: number): number {
  if (!state.dragging) return state.width;
  const delta = clientX - state.startX;
  const newWidth = clampWidth(state.startWidth + delta, viewportWidth);
  state.width = newWidth;
  return newWidth;
}

/** End the drag operation. */
export function endDrag(state: PanelResizeState): void {
  state.dragging = false;
}

/**
 * Wire up DOM event listeners for the resize handle.
 * Returns a cleanup function that removes all listeners.
 */
export function initPanelResize(panel: HTMLElement, handle: HTMLElement): () => void {
  const state = createResizeState(panel.offsetWidth);

  function applyWidth(w: number) {
    panel.style.width = `${w}px`;
  }

  // --- pointer events on the handle ---
  function onPointerDown(e: PointerEvent) {
    if (isMobile(window.innerWidth)) return;
    e.preventDefault();
    startDrag(state, e.clientX);
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic events may lack a valid pointerId */
    }
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  function onPointerMove(e: PointerEvent) {
    if (!state.dragging) return;
    const w = updateDrag(state, e.clientX, window.innerWidth);
    applyWidth(w);
  }

  function onPointerUp() {
    if (!state.dragging) return;
    endDrag(state);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }

  // --- responsive: snap to full width on narrow viewports ---
  const mql = window.matchMedia(`(min-width: ${MOBILE_BREAKPOINT}px)`);
  function onMediaChange(e: MediaQueryListEvent | MediaQueryList) {
    if (e.matches) {
      // Desktop: restore saved width
      applyWidth(state.width);
      handle.style.display = "";
    } else {
      // Mobile: full width, hide handle
      panel.style.width = "";
      handle.style.display = "none";
    }
  }
  onMediaChange(mql);
  mql.addEventListener("change", onMediaChange);

  handle.addEventListener("pointerdown", onPointerDown);
  handle.addEventListener("pointermove", onPointerMove);
  handle.addEventListener("pointerup", onPointerUp);
  handle.addEventListener("pointercancel", onPointerUp);

  return () => {
    mql.removeEventListener("change", onMediaChange);
    handle.removeEventListener("pointerdown", onPointerDown);
    handle.removeEventListener("pointermove", onPointerMove);
    handle.removeEventListener("pointerup", onPointerUp);
    handle.removeEventListener("pointercancel", onPointerUp);
  };
}
