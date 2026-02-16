/**
 * Three.js scene setup — camera, lights, controls, renderer.
 *
 * Owns the core 3D infrastructure but not the pin-field geometry.
 */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export interface SceneContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  container: HTMLElement;
}

/** The current auto-rotation mode. */
export type RotateMode = "auto" | "on" | "off";

let rotateMode: RotateMode = "auto";

export function getRotateMode(): RotateMode {
  return rotateMode;
}

export function setRotateMode(mode: RotateMode, controls: OrbitControls): void {
  rotateMode = mode;
  if (mode === "on") controls.autoRotate = true;
  else if (mode === "off") controls.autoRotate = false;
  else controls.autoRotate = true; // auto starts rotating
}

export function createScene(container: HTMLElement): SceneContext {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(devicePixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(40, 1, 1, 5000);
  camera.position.set(600, 900, 600);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.autoRotate = true;

  // Stop auto-rotate on user interaction (in "auto" mode)
  renderer.domElement.addEventListener("pointerdown", () => {
    if (rotateMode === "auto") controls.autoRotate = false;
  });
  renderer.domElement.addEventListener("wheel", () => {
    if (rotateMode === "auto") controls.autoRotate = false;
  });

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 1));
  const d1 = new THREE.DirectionalLight(0xffffff, 2.0);
  d1.position.set(-300, 600, -400);
  scene.add(d1);
  const d2 = new THREE.DirectionalLight(0xffffff, 1.0);
  d2.position.set(300, 400, 200);
  scene.add(d2);

  return { renderer, scene, camera, controls, container };
}

export function resize(ctx: SceneContext): void {
  const w = ctx.container.clientWidth;
  const h = ctx.container.clientHeight;
  ctx.camera.aspect = w / h;
  ctx.camera.updateProjectionMatrix();
  ctx.renderer.setSize(w, h);
}
