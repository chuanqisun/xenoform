import { describe, expect, it } from "vitest";
import { compressToURL, decompressFromURL } from "../utils/url-compression.ts";

describe("url-compression", () => {
  it("round-trips simple text", async () => {
    const original = "wave(1, 1).rotate(PI)";
    const compressed = await compressToURL(original);
    const decompressed = await decompressFromURL(compressed);
    expect(decompressed).toBe(original);
  });

  it("round-trips multiline code", async () => {
    const original = `seq(1,\n  flat(0),\n  wave(1, 1)\n)`;
    const compressed = await compressToURL(original);
    const decompressed = await decompressFromURL(compressed);
    expect(decompressed).toBe(original);
  });

  it("produces URL-safe characters", async () => {
    const compressed = await compressToURL("hello world");
    expect(compressed).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("round-trips empty string", async () => {
    const compressed = await compressToURL("");
    const decompressed = await decompressFromURL(compressed);
    expect(decompressed).toBe("");
  });
});
