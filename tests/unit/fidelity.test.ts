import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { pixelDiff } from "../../src/fidelity/pixel.js";

function makePng(width: number, height: number, bg: { r: number; g: number; b: number }): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: bg } }).png().toBuffer();
}

describe("像素 diff 评分", () => {
  it("完全相同图 → 100 分", async () => {
    const a = await makePng(100, 100, { r: 200, g: 100, b: 50 });
    const res = await pixelDiff(a, a, 100, 100);
    expect(res.score).toBe(100);
    expect(res.diffRatio).toBe(0);
  });
  it("完全不同色 → 低分", async () => {
    const a = await makePng(100, 100, { r: 255, g: 255, b: 255 });
    const b = await makePng(100, 100, { r: 0, g: 0, b: 0 });
    const res = await pixelDiff(a, b, 100, 100);
    expect(res.score).toBeLessThan(20);
  });
  it("不同尺寸自动等比缩放后比较", async () => {
    const a = await makePng(200, 100, { r: 30, g: 120, b: 210 });
    const b = await makePng(100, 50, { r: 30, g: 120, b: 210 });
    const res = await pixelDiff(a, b, 100, 50);
    expect(res.score).toBeGreaterThan(90);
  });
});
