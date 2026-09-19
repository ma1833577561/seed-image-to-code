/**
 * Dry 全链路测试：Mock Seed + 真实渲染（Chromium）
 * 验证 pipeline：解析 → 主题色 → 首轮生成 → 渲染 → 评分 → 迭代/终止
 */

import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { ImageToCodePipeline } from "../../src/pipeline/index.js";
import { MockClient, type SeedClient } from "../../src/seed/client.js";
import type { GenerateResult } from "../../src/types.js";

async function makeSamplePng(): Promise<Buffer> {
  // 模拟“页面”图：浅色背景 + 顶部品牌色条（与 Mock HTML 渲染结果接近）
  const width = 400;
  const height = 300;
  const bg = await sharp({
    create: { width, height, channels: 3, background: { r: 245, g: 247, b: 250 } },
  })
    .png()
    .toBuffer();
  const strip = await sharp({
    create: { width, height: 56, channels: 3, background: { r: 30, g: 120, b: 210 } },
  })
    .png()
    .toBuffer();
  return sharp(bg).composite([{ input: strip, top: 0, left: 0 }]).png().toBuffer();
}

const HTML = `<!doctype html>
<html lang="zh">
<head><meta charset="utf-8"><title>dry</title>
<style>
:root { --brand:#1E78D2; --bg:#F5F7FA; --text:#1F2329; }
body { margin:0; font-family:sans-serif; background:var(--bg); color:var(--text); }
header { height:56px; background:var(--brand); }
.card { margin:16px; padding:16px; background:#fff; border-radius:8px; }
</style></head>
<body><header></header><main><div class="card"><h1>Hello</h1></div></main></body>
</html>`;

function makeMockSeed(): SeedClient {
  return new MockClient((req) => {
    const text = req.text;
    if (text.includes("UI 设计系统专家")) {
      return JSON.stringify({ tokens: [{ hex: "#1E78D2", role: "brand", name: "brand" }] });
    }
    if (text.includes("对比两张图")) {
      return JSON.stringify({
        layout: 90, color: 90, typography: 88, detail: 90,
        issues: ["卡片圆角偏大", "主色偏浅"],
      });
    }
    if (text.includes("修正")) {
      return JSON.stringify({ files: [{ path: "index.html", content: HTML }], entry: "index.html" });
    }
    return JSON.stringify({ files: [{ path: "index.html", content: HTML }], entry: "index.html" });
  });
}

describe("pipeline Dry 全链路（Mock Seed + 真实渲染）", () => {
  it("85% 档：首轮即达标，迭代 1 轮", async () => {
    const png = await makeSamplePng();
    const pipeline = new ImageToCodePipeline(makeMockSeed());
    const result: GenerateResult = await pipeline.run({
      asset: { type: "file", buffer: png, filename: "sample.png" },
      techStack: "native-html",
      targetFidelity: 85,
      viewport: { width: 400, height: 300 },
    });
    expect(result.files.length).toBeGreaterThan(0);
    expect(result.entry).toBe("index.html");
    expect(result.report.iterations.length).toBe(1);
    expect(result.report.finalScore).toBeGreaterThanOrEqual(85);
    expect(result.report.colorPalette.length).toBeGreaterThan(0);
  });

  it("99.99% 档：Mock 分数不足且问题清单稳定 → 提前终止且 ≤ 10 轮", async () => {
    const png = await makeSamplePng();
    const pipeline = new ImageToCodePipeline(makeMockSeed());
    const result = await pipeline.run({
      asset: { type: "file", buffer: png, filename: "sample.png" },
      techStack: "react-tsx",
      targetFidelity: 99.99,
      viewport: { width: 400, height: 300 },
    });
    expect(result.report.iterations.length).toBeLessThanOrEqual(10);
    expect(result.report.iterations.length).toBeGreaterThanOrEqual(2);
    expect(result.report.finalScore).toBeLessThan(99.99);
    expect(result.report.summary.some((s) => s.includes("未达到"))).toBe(true);
  });
});
