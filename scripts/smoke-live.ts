/**
 * Live 冒烟测试：本地合成 UI 样例 × 真实 Seed 调用 × 完整流水线
 * 用于在官方目标页（volcengine.com 整页）因生成耗时而阻塞期间，
 * 验证真实模型下的「生成→渲染→评分→报告」端到端链路可用。
 * 运行：tsx scripts/smoke-live.ts
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { ImageToCodePipeline } from "../src/pipeline/index.js";
import { hasApiKey } from "../src/config.js";
import { renderFilesToScreenshot } from "../src/renderer/renderer.js";
import { closeBrowser } from "../src/parser/url.js";
import { closeRenderer } from "../src/renderer/renderer.js";
import { writeOutputFiles } from "../src/reporter/report.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

/** 生成一个带明确视觉结构的合成 UI 样例（浅色底 + 品牌色头图 + 卡片 + 图表条） */
async function makeSampleUi(width = 640, height = 480): Promise<Buffer> {
  const bg = await sharp({ create: { width, height, channels: 3, background: { r: 246, g: 248, b: 252 } } })
    .png()
    .toBuffer();
  const header = await sharp({ create: { width, height: 72, channels: 3, background: { r: 26, g: 96, b: 209 } } })
    .png()
    .toBuffer();
  const card = await sharp({ create: { width: 560, height: 200, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .png()
    .toBuffer();
  const bar = await sharp({ create: { width: 180, height: 24, channels: 3, background: { r: 84, g: 142, b: 245 } } })
    .png()
    .toBuffer();
  return sharp(bg)
    .composite([
      { input: header, top: 0, left: 0 },
      { input: card, top: 120, left: 40 },
      { input: bar, top: 300, left: 60 },
    ])
    .png()
    .toBuffer();
}

async function main(): Promise<void> {
  if (!hasApiKey()) {
    console.error("[blocked] ARK_API_KEY 未配置");
    process.exit(2);
  }
  const image = await makeSampleUi();
  const outDir = path.join(ROOT, "output", "smoke");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "input.png"), image);

  console.log("=== Live 冒烟：合成 UI 样例 → native-html，fidelity=85 ===");
  const pipeline = new ImageToCodePipeline();
  const t0 = Date.now();
  const result = await pipeline.run({
    asset: { type: "file", buffer: image, filename: "sample-ui.png" },
    techStack: "native-html",
    targetFidelity: 85,
    viewport: { width: 640, height: 480 },
  });
  console.log(`生成+评分耗时：${Date.now() - t0}ms｜综合还原度：${result.report.finalScore}｜迭代 ${result.report.iterations.length} 轮`);

  writeOutputFiles(result, outDir);
  fs.writeFileSync(path.join(outDir, "input.png"), image);
  const rendered = await renderFilesToScreenshot(result.files, result.entry, { width: 640, height: 480 });
  fs.writeFileSync(path.join(outDir, "final-render.png"), rendered.screenshot);
  fs.writeFileSync(
    path.join(outDir, "evidence.json"),
    JSON.stringify(
      {
        kind: "smoke",
        target: "本地合成 UI 样例（官方目标页整页生成受长耗时阻塞，见测试报告）",
        finalScore: result.report.finalScore,
        rounds: result.report.iterations.length,
        iterations: result.report.iterations,
        palette: result.report.colorPalette,
        consoleErrors: rendered.consoleErrors,
        durationMs: Date.now() - t0,
      },
      null,
      2,
    ),
  );
  console.log(`产物：${outDir}`);
  console.log("关键分项：", JSON.stringify(result.report.iterations.at(-1)?.vlm));
  console.log("剩余问题：", result.report.iterations.at(-1)?.issues);
}

main()
  .catch((err) => {
    console.error("冒烟失败：", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([closeBrowser(), closeRenderer()]);
  });
