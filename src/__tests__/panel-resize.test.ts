import { describe, expect, it } from "vitest";
import { clampWidth, createResizeState, endDrag, isMobile, startDrag, updateDrag } from "../ui/panel-resize.ts";

describe("panel-resize", () => {
  describe("isMobile", () => {
    it("returns true below 768px", () => {
      expect(isMobile(767)).toBe(true);
      expect(isMobile(500)).toBe(true);
    });

    it("returns false at 768px and above", () => {
      expect(isMobile(768)).toBe(false);
      expect(isMobile(1024)).toBe(false);
    });
  });

  describe("clampWidth", () => {
    it("clamps to minimum width (280px)", () => {
      expect(clampWidth(100, 1200)).toBe(280);
    });

    it("clamps to 80% of viewport", () => {
      expect(clampWidth(1000, 1000)).toBe(800);
    });

    it("passes through a valid width", () => {
      expect(clampWidth(420, 1200)).toBe(420);
    });

    it("handles narrow viewport where max < min", () => {
      // 80% of 300 = 240 < 280 → 280
      expect(clampWidth(400, 300)).toBe(280);
    });
  });

  describe("createResizeState", () => {
    it("initializes with the given width", () => {
      const state = createResizeState(420);
      expect(state.width).toBe(420);
      expect(state.dragging).toBe(false);
    });
  });

  describe("startDrag / updateDrag / endDrag", () => {
    it("tracks drag from start to end", () => {
      const state = createResizeState(420);
      startDrag(state, 420);
      expect(state.dragging).toBe(true);

      const w = updateDrag(state, 500, 1200);
      expect(w).toBe(500); // 420 + (500 - 420) = 500

      endDrag(state);
      expect(state.dragging).toBe(false);
      expect(state.width).toBe(500);
    });

    it("does not update when not dragging", () => {
      const state = createResizeState(420);
      const w = updateDrag(state, 600, 1200);
      expect(w).toBe(420);
    });

    it("clamps to min during drag", () => {
      const state = createResizeState(420);
      startDrag(state, 420);
      const w = updateDrag(state, 100, 1200); // delta = -320, target = 100
      expect(w).toBe(280);
    });

    it("clamps to max during drag", () => {
      const state = createResizeState(420);
      startDrag(state, 420);
      const w = updateDrag(state, 1200, 1200); // delta = 780, target = 1200
      expect(w).toBe(960); // 80% of 1200
    });

    it("handles leftward drag (shrink)", () => {
      const state = createResizeState(420);
      startDrag(state, 420);
      const w = updateDrag(state, 350, 1200); // delta = -70, target = 350
      expect(w).toBe(350);
    });
  });
});
