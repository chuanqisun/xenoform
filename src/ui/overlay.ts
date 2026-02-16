/**
 * Overlay — the "Click to start" overlay that gates audio context creation.
 */

/** Initialize the start overlay. Returns a promise that resolves when clicked. */
export function initOverlay(): Promise<void> {
  return new Promise((resolve) => {
    const overlay = document.getElementById("start-overlay")!;
    overlay.addEventListener("click", () => {
      overlay.classList.add("hidden");
      resolve();
    });
  });
}
