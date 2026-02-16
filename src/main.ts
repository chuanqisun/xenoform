/**
 * Application entry point — wires together all decoupled modules.
 *
 * Layers:
 *   utils/      — pure helper functions
 *   language/   — Pattern AST & compiler
 *   library/    — built-in DSL APIs (factories, signals, config)
 *   runtime/    — interpreter & scheduler
 *   output/     — 3D rendering & audio
 *   ui/         — editor, panel, overlay
 */

import * as THREE from "three";
import "./style.css";

import { compressToURL } from "./utils/url-compression.ts";
import { createScene, resize, setRotateMode } from "./output/scene-setup.ts";
import { buildPinField } from "./output/pin-field-renderer.ts";
import type { PinField } from "./output/pin-field-renderer.ts";
import { createAudioEngine } from "./output/audio-engine.ts";
import type { AudioEngine } from "./output/audio-engine.ts";
import { runCode } from "./runtime/interpreter.ts";
import { createSchedulerState, startLoop } from "./runtime/scheduler.ts";
import { createEditor } from "./ui/editor.ts";
import { initPanel, setConsoleMessage, clearConsole } from "./ui/panel.ts";

// --- UI setup ---
initPanel();

// --- 3D scene ---
const container = document.getElementById("right")!;
const sceneCtx = createScene(container);

// --- Pin field (mutable ref so scheduler can see rebuilds) ---
const pinFieldRef: { current: PinField } = {
  current: buildPinField(sceneCtx.scene, 32),
};

// --- Audio (mutable ref, created on first interaction) ---
const audioRef: { current: AudioEngine | null } = { current: null };

// Resume audio on canvas interaction
sceneCtx.renderer.domElement.addEventListener("pointerdown", () => {
  if (audioRef.current && audioRef.current.ctx.state === "suspended") {
    audioRef.current.ctx.resume();
  }
});

// --- Scheduler state ---
const schedulerState = createSchedulerState();

// --- Run program handler ---
function handleRun(code: string) {
  clearConsole();
  const result = runCode(code);

  if (result.error) {
    setConsoleMessage(`✗ ${result.error}`);
    return;
  }

  // Apply config changes
  if (result.config.gridSize !== null && result.config.gridSize !== pinFieldRef.current.grid) {
    pinFieldRef.current = buildPinField(sceneCtx.scene, result.config.gridSize, pinFieldRef.current);
  }
  if (result.config.background !== null) {
    sceneCtx.scene.background = new THREE.Color(result.config.background);
  }
  if (result.config.rotateMode !== null) {
    setRotateMode(result.config.rotateMode, sceneCtx.controls);
  }

  if (result.pattern) {
    schedulerState.activePattern = result.pattern;
    schedulerState.programStartTime = schedulerState.globalTime;
    compressToURL(code).then((encoded) => {
      window.history.replaceState(null, "", "#" + encoded);
    });
  } else if (result.warning) {
    setConsoleMessage(`⚠ ${result.warning}`);
  }
}

// --- Editor ---
let getEditorCode: () => string;
const editorReady = createEditor(document.getElementById("editor-wrap")!, () => handleRun(getEditorCode()));
const editor = await editorReady;
getEditorCode = editor.getCode;

document.getElementById("run-btn")!.addEventListener("click", () => handleRun(getEditorCode()));

// --- Resize ---
resize(sceneCtx);
addEventListener("resize", () => resize(sceneCtx));

// --- Start overlay ---
document.getElementById("start-overlay")!.addEventListener("click", () => {
  if (!audioRef.current) {
    audioRef.current = createAudioEngine();
  } else if (audioRef.current.ctx.state === "suspended") {
    audioRef.current.ctx.resume();
  }
  document.getElementById("start-overlay")!.classList.add("hidden");
  schedulerState.started = true;
  handleRun(getEditorCode());
});

// --- Start render loop ---
startLoop(sceneCtx, pinFieldRef, audioRef, schedulerState);
