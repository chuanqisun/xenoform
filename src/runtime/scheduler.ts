/**
 * Scheduler — owns the animation loop, timing, and coordinates
 * the pin-field renderer and audio engine each frame.
 */

import * as THREE from "three";
import type { PatternFn } from "../language/ast.ts";
import type { AudioEngine } from "../output/audio-engine.ts";
import { updateAudio } from "../output/audio-engine.ts";
import type { PinField } from "../output/pin-field-renderer.ts";
import { MAX_P, updatePins } from "../output/pin-field-renderer.ts";
import type { SceneContext } from "../output/scene-setup.ts";

export interface SchedulerState {
  activePattern: PatternFn | null;
  globalTime: number;
  programStartTime: number;
  started: boolean;
}

export function createSchedulerState(): SchedulerState {
  return { activePattern: null, globalTime: 0, programStartTime: 0, started: false };
}

/** Start the requestAnimationFrame loop. */
export function startLoop(sceneCtx: SceneContext, pinField: { current: PinField }, audio: { current: AudioEngine | null }, state: SchedulerState): void {
  const clock = new THREE.Clock();

  // Visibility handling
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (audio.current) {
        audio.current.masterGain.gain.setTargetAtTime(0, audio.current.ctx.currentTime, 0.1);
      }
    } else {
      clock.getDelta(); // discard elapsed time while hidden
      pinField.current.prevFrame.set(pinField.current.current);
      if (audio.current) {
        audio.current.masterGain.gain.setTargetAtTime(0.12, audio.current.ctx.currentTime, 0.3);
        if (audio.current.ctx.state === "suspended") audio.current.ctx.resume();
      }
    }
  });

  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.1);
    sceneCtx.controls.update();

    if (state.started) {
      state.globalTime += dt;
    }

    const patternTime = state.globalTime - state.programStartTime;
    const intensity = updatePins(pinField.current, state.globalTime, state.activePattern, patternTime, dt, state.started);

    if (audio.current) {
      updateAudio(audio.current, intensity, MAX_P);
    }

    sceneCtx.renderer.render(sceneCtx.scene, sceneCtx.camera);
  }

  loop();
}
