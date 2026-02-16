/**
 * Panel — left panel toggle, ref toggle, console output.
 */

/** Initialize the left panel toggle (show/hide). */
export function initPanel(): { openPanel: () => void; closePanel: () => void } {
  const leftPanel = document.getElementById("left")!;
  const menuToggle = document.getElementById("menu-toggle")!;

  function openPanel() {
    leftPanel.classList.add("open");
    menuToggle.classList.add("hidden");
  }

  function closePanel() {
    leftPanel.classList.remove("open");
    menuToggle.classList.remove("hidden");
  }

  // Auto-open on desktop
  if (window.matchMedia("(min-width: 768px)").matches) openPanel();

  menuToggle.addEventListener("click", openPanel);
  document.getElementById("hide-btn")!.addEventListener("click", closePanel);

  // Ref toggle
  const refBtn = document.getElementById("ref-btn")!;
  const apiRef = document.getElementById("api-ref")!;
  refBtn.addEventListener("click", () => {
    apiRef.classList.toggle("visible");
    refBtn.classList.toggle("active", apiRef.classList.contains("visible"));
  });

  return { openPanel, closePanel };
}

/** Write a message to the console element. */
export function setConsoleMessage(msg: string): void {
  const el = document.getElementById("console");
  if (el) el.textContent = msg;
}

/** Clear the console element. */
export function clearConsole(): void {
  const el = document.getElementById("console");
  if (el) el.textContent = "";
}
