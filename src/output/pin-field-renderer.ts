/**
 * Pin-field renderer — manages the instanced pin grid, shell enclosure,
 * and edge-line overlay using Three.js.
 *
 * All geometry constants and rebuild logic live here.
 */

import * as THREE from "three";

// --- Geometry constants ---
const PIN_W = 10;
const PIN_H = 200;
const GAP = 2;
const STEP = PIN_W + GAP;
export const MAX_P = 180;
const JITTER_FREQ = 400;
const WALL = 10;
const SHELL_GAP = GAP;
const BASE_H = 200;
const BASE_TOP = 0;
const TEX_W = 1024;

// --- Shared geometry ---
const pinGeom = new THREE.BoxGeometry(PIN_W, PIN_H, PIN_W);
const edgeGeom = new THREE.EdgesGeometry(pinGeom);
const edgePositions = edgeGeom.attributes.position.array as Float32Array;
const edgeVertCount = edgePositions.length / 3;

const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.0 });
const shellMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0.0 });
const edgeMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0 });

const edgeShaderMat = new THREE.ShaderMaterial({
  transparent: true,
  uniforms: {
    offsets: { value: null },
    opacity: { value: 0.06 },
    gridSize: { value: 32 },
    step: { value: STEP },
    halfGrid: { value: 0 },
    pinH: { value: PIN_H },
    texW: { value: TEX_W },
  },
  vertexShader: `
    attribute float pinIdx;
    uniform sampler2D offsets;
    uniform float gridSize, step, halfGrid, pinH, texW;
    void main() {
      int idx = int(pinIdx);
      float ix = mod(pinIdx, gridSize);
      float iz = floor(pinIdx / gridSize);
      ivec2 tc = ivec2(idx % int(texW), idx / int(texW));
      float h = texelFetch(offsets, tc, 0).r;
      vec3 p = position;
      p.x += -halfGrid + ix * step;
      p.z += -halfGrid + iz * step;
      p.y += h;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
  `,
  fragmentShader: `uniform float opacity; void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, opacity); }`,
});

const dummy = new THREE.Object3D();

/** Mutable state for the pin field. */
export interface PinField {
  grid: number;
  total: number;
  half: number;
  pins: THREE.InstancedMesh;
  edgeLines: THREE.LineSegments;
  shellGroup: THREE.Group;
  current: Float32Array;
  prevFrame: Float32Array;
  heightData: Float32Array;
  heightTex: THREE.DataTexture;
  jitterPhase: Float32Array;
  jitterFreq: Float32Array;
}

/** Build (or rebuild) the pin field for a given grid size. */
export function buildPinField(scene: THREE.Scene, n: number, existing?: PinField): PinField {
  // Dispose old objects
  if (existing) {
    scene.remove(existing.pins);
    existing.pins.dispose();
    scene.remove(existing.edgeLines);
    existing.edgeLines.geometry.dispose();
    existing.shellGroup.traverse((c) => {
      if ((c as THREE.Mesh).geometry) (c as THREE.Mesh).geometry.dispose();
    });
    scene.remove(existing.shellGroup);
  }

  const grid = n;
  const total = grid * grid;
  const half = ((grid - 1) * STEP) / 2;
  const pinFieldW = (grid - 1) * STEP + PIN_W;
  const inner = pinFieldW + 2 * SHELL_GAP;
  const outer = inner + 2 * WALL;

  // --- Pins ---
  const pins = new THREE.InstancedMesh(pinGeom, whiteMat, total);
  scene.add(pins);

  // --- Edge lines ---
  const mergedPos = new Float32Array(total * edgePositions.length);
  const pinIndex = new Float32Array(total * edgeVertCount);
  for (let i = 0; i < total; i++) {
    mergedPos.set(edgePositions, i * edgePositions.length);
    pinIndex.fill(i, i * edgeVertCount, (i + 1) * edgeVertCount);
  }
  const mergedEdgeGeom = new THREE.BufferGeometry();
  mergedEdgeGeom.setAttribute("position", new THREE.BufferAttribute(mergedPos, 3));
  mergedEdgeGeom.setAttribute("pinIdx", new THREE.BufferAttribute(pinIndex, 1));

  // Height texture
  const texH = Math.ceil(total / TEX_W);
  const heightData = new Float32Array(TEX_W * texH * 4);
  const heightTex = new THREE.DataTexture(heightData, TEX_W, texH, THREE.RGBAFormat, THREE.FloatType);

  // Update shader uniforms
  edgeShaderMat.uniforms.offsets.value = heightTex;
  edgeShaderMat.uniforms.gridSize.value = grid;
  edgeShaderMat.uniforms.halfGrid.value = half;

  const edgeLines = new THREE.LineSegments(mergedEdgeGeom, edgeShaderMat);
  scene.add(edgeLines);

  // --- Shell ---
  const shellGroup = new THREE.Group();
  function addWall(w: number, h: number, d: number, px: number, py: number, pz: number) {
    const g = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(g, shellMat);
    m.position.set(px, py, pz);
    shellGroup.add(m);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), edgeMat);
    e.position.set(px, py, pz);
    shellGroup.add(e);
  }

  const bottomGeom = new THREE.BoxGeometry(outer, WALL, outer);
  const bottom = new THREE.Mesh(bottomGeom, shellMat);
  bottom.position.y = BASE_TOP - BASE_H + WALL / 2;
  shellGroup.add(bottom);
  const bottomEdge = new THREE.LineSegments(new THREE.EdgesGeometry(bottomGeom), edgeMat);
  bottomEdge.position.copy(bottom.position);
  shellGroup.add(bottomEdge);

  const wallH = BASE_H - WALL;
  const wallCY = BASE_TOP - BASE_H + WALL + wallH / 2;
  addWall(outer, wallH, WALL, 0, wallCY, inner / 2 + WALL / 2);
  addWall(outer, wallH, WALL, 0, wallCY, -(inner / 2 + WALL / 2));
  addWall(WALL, wallH, inner, -(inner / 2 + WALL / 2), wallCY, 0);
  addWall(WALL, wallH, inner, inner / 2 + WALL / 2, wallCY, 0);
  scene.add(shellGroup);

  // --- Arrays ---
  const current = new Float32Array(total);
  const prevFrame = new Float32Array(total);
  const jitterPhase = new Float32Array(total);
  const jitterFreq = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    jitterPhase[i] = Math.random() * Math.PI * 2;
    jitterFreq[i] = 8 + Math.random() * JITTER_FREQ;
  }

  // Initialize pins at bottom
  for (let i = 0; i < total; i++) {
    const x = -half + (i % grid) * STEP;
    const zz = -half + ((i / grid) | 0) * STEP;
    const centerY = BASE_TOP + 0 - PIN_H / 2;
    dummy.position.set(x, centerY, zz);
    dummy.updateMatrix();
    pins.setMatrixAt(i, dummy.matrix);
    heightData[i * 4] = centerY;
  }
  pins.instanceMatrix.needsUpdate = true;
  heightTex.needsUpdate = true;

  return { grid, total, half, pins, edgeLines, shellGroup, current, prevFrame, heightData, heightTex, jitterPhase, jitterFreq };
}

/** Update pin positions for the current frame. Returns movement intensity. */
export function updatePins(
  field: PinField,
  globalTime: number,
  patternFn: ((x: number, z: number, t: number, n: number) => number) | null,
  patternTime: number,
  started: boolean,
): number {
  const { grid, total, half, current, prevFrame, jitterPhase, jitterFreq, pins, heightData, heightTex } = field;
  const JITTER_AMP_LOCAL = 0.6;

  prevFrame.set(current);

  if (patternFn && started) {
    for (let i = 0; i < total; i++) {
      const ix = i % grid;
      const iz = (i / grid) | 0;
      const x = ix / (grid - 1);
      const z = iz / (grid - 1);
      let h = patternFn(x, z, patternTime, grid);
      h = Math.max(0, Math.min(1, h || 0));
      const target = h * MAX_P;
      const jit = Math.sin(globalTime * jitterFreq[i] + jitterPhase[i]) * JITTER_AMP_LOCAL;
      current[i] = Math.max(-JITTER_AMP_LOCAL, Math.min(MAX_P + JITTER_AMP_LOCAL, target + jit));
    }
  }

  let intensity = 0;
  for (let i = 0; i < total; i++) {
    const x = -half + (i % grid) * STEP;
    const zz = -half + ((i / grid) | 0) * STEP;
    const centerY = BASE_TOP + current[i] - PIN_H / 2;
    dummy.position.set(x, centerY, zz);
    dummy.updateMatrix();
    pins.setMatrixAt(i, dummy.matrix);
    heightData[i * 4] = centerY;
    intensity += Math.abs(current[i] - prevFrame[i]);
  }
  intensity /= total;
  pins.instanceMatrix.needsUpdate = true;
  heightTex.needsUpdate = true;

  return intensity;
}
