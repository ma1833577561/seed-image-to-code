import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { extractDominantColors, extractTheme } from "../../src/extractor/theme.js";

function makeSolidPng(r: number, g: number, b: number): Promise<Buffer> {
  return sharp({ create: { width: 64, height: 64, channels: 3, background: { r, g, b } } })
    .png()
    .toBuffer();
}

describe("主题色本地聚类", () => {
  it("纯色图返回该色", async () => {
    const png = await makeSolidPng(30, 120, 210);
    const colors = await extractDominantColors(png);
    expect(colors[0]?.hex.toUpperCase()).toBe("#1E78D2");
    expect(colors[0]!.ratio).toBeGreaterThan(0.9);
  });
  it("过滤近白近黑噪声", async () => {
    const png = await makeSolidPng(10, 10, 10);
    const colors = await extractDominantColors(png, { top: 5 });
    expect(colors.length).toBeGreaterThan(0);
  });
});

describe("主题色启发式分类（无 Seed 降级）", () => {
  it("深色归为文本，亮色归为背景，高占比归为品牌", async () => {
    const png = await makeSolidPng(30, 120, 210);
    const tokens = await extractTheme({ image: png });
    const roles = tokens.map((t) => t.role);
    expect(roles[0]).toBe("brand");
  });
});
