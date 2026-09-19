/**
 * 本地设计稿 99.99 验收：本地 UI 图 × react-tsx × 新口径（分项≥95 + 像素≥95）
 * 运行：npx tsx scripts/local-ui-accept.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { ImageToCodePipeline } from "../src/pipeline/index.js";
import { hasApiKey } from "../src/config.js";
import { renderFilesToScreenshot } from "../src/renderer/renderer.js";
import { closeRenderer } from "../src/renderer/renderer.js";
import { writeOutputFiles } from "../src/reporter/report.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

async function main(): Promise<void> {
  if (!hasApiKey()) {
    console.error("[blocked] ARK_API_KEY 未配置");
    process.exit(2);
  }
  const raw = fs.readFileSync(path.join(ROOT, "output", "local-ui", "dashboard.png"));
  // 下采样到 800px 宽，控制生成耗时
  const image = await sharp(raw).resize({ width: 800 }).png().toBuffer();
  const meta = await sharp(image).metadata();
  const outDir = path.join(ROOT, "output", "local-ui", "result-9999");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "input.png"), image);

  console.log(`=== 本地设计稿 99.99 验收（react-tsx），${meta.width}×${meta.height} ===`);
  const t0 = Date.now();
  const result = await new ImageToCodePipeline().run({
    asset: { type: "file", buffer: image, filename: "dashboard.png" },
    techStack: "react-tsx",
    targetFidelity: 99.99,
    viewport: { width: meta.width ?? 1440, height: meta.height ?? 1024 },
  });
  console.log(`最终综合还原度：${result.report.finalScore}｜迭代 ${result.report.iterations.length} 轮｜${((Date.now() - t0) / 1000).toFixed(0)}s`);
  writeOutputFiles(result, outDir);
  const rendered = await renderFilesToScreenshot(result.files, result.entry, {
    width: meta.width ?? 1440,
    height: meta.height ?? 1024,
  });
  fs.writeFileSync(path.join(outDir, "final-render.png"), rendered.screenshot);
  fs.writeFileSync(
    path.join(outDir, "evidence.json"),
    JSON.stringify(
      {
        target: 99.99,
        newThreshold: "四维均≥95 且 像素分≥95",
        finalScore: result.report.finalScore,
        rounds: result.report.iterations.length,
        iterations: result.report.iterations,
        consoleErrors: rendered.consoleErrors,
      },
      null,
      2,
    ),
  );
  console.log("末轮分项：", JSON.stringify(result.report.iterations.at(-1)?.vlm));
  console.log("console 错误：", rendered.consoleErrors);
}

main()
  .catch((err) => {
    console.error("失败：", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeRenderer();
  });
