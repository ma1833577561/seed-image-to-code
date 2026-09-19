/**
 * Live 测试：四档还原度 × 真实 Seed 调用 × 目标页面 juejin.cn 首屏切片
 * 运行：npm run test:live
 * 前置：.env 配置 ARK_API_KEY
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { ImageToCodePipeline } from "../src/pipeline/index.js";
import { hasApiKey } from "../src/config.js";
import { parseAsset } from "../src/parser/index.js";
import { renderFilesToScreenshot } from "../src/renderer/renderer.js";
import { closeBrowser } from "../src/parser/url.js";
import { closeRenderer } from "../src/renderer/renderer.js";
import { writeOutputFiles } from "../src/reporter/report.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TARGET_URL = process.env.LIVE_URL ?? "https://juejin.cn/";
/** 输入图最大宽度（首屏切片下采样，降低生成耗时同时保留结构） */
const MAX_INPUT_WIDTH = Number(process.env.LIVE_MAX_WIDTH ?? 800);

/**
 * 四档还原度 Live 校验（juejin.cn 首屏切片 = 导航+Hero）：
 * 85→1 轮、90→2 轮、95→3 轮；99.99 不指定 customLoops，
 * 走默认映射到 SYSTEM_MAX_LOOPS(10)，按达标即停或用尽轮次终止。
 */
const TIERS: Array<{
  label: string;
  fidelity: number;
  tech: "native-html" | "react-tsx" | "vue3";
  loops?: number;
}> = [
  { label: "85", fidelity: 85, tech: "native-html", loops: 1 },
  { label: "90", fidelity: 90, tech: "react-tsx", loops: 2 },
  { label: "95", fidelity: 95, tech: "vue3", loops: 3 },
  { label: "99.99", fidelity: 99.99, tech: "react-tsx" },
];

async function main(): Promise<void> {
  if (!hasApiKey()) {
    console.error("[blocked] ARK_API_KEY 未配置：Live 测试无法执行（按交付周期协议置 waiting_user）");
    process.exit(2);
  }

  console.log(`目标站点：${TARGET_URL}`);
  const rawAsset = await parseAsset({ type: "url", url: TARGET_URL });
  // 大图下采样：控制生成耗时与 Token 消耗
  let asset = rawAsset;
  if (asset.width > MAX_INPUT_WIDTH) {
    const resized = await sharp(asset.image)
      .resize({ width: MAX_INPUT_WIDTH })
      .png()
      .toBuffer();
    const meta = await sharp(resized).metadata();
    asset = {
      ...asset,
      image: resized,
      width: meta.width ?? MAX_INPUT_WIDTH,
      height: meta.height ?? asset.height,
    };
    console.log(`输入下采样：${rawAsset.width}×${rawAsset.height} → ${asset.width}×${asset.height}`);
  }
  // 顶部切片（导航+Hero）：只保留顶部区域，进一步降低代码生成量与耗时
  const CROP_TOP_HEIGHT = Number(process.env.LIVE_CROP_HEIGHT ?? 380);
  if (asset.height > CROP_TOP_HEIGHT) {
    const cropped = await sharp(asset.image)
      .extract({ left: 0, top: 0, width: asset.width, height: CROP_TOP_HEIGHT })
      .png()
      .toBuffer();
    asset = { ...asset, image: cropped, height: CROP_TOP_HEIGHT };
    console.log(`顶部切片：${asset.width}×${asset.height}（导航+Hero）`);
  }
  const inputDir = path.join(ROOT, "output", "live", "_input");
  fs.mkdirSync(inputDir, { recursive: true });
  fs.writeFileSync(path.join(inputDir, "original.png"), asset.image);
  fs.writeFileSync(path.join(inputDir, "captured-full.png"), rawAsset.image);
  console.log(`已捕获站点首屏截图：${rawAsset.width}×${rawAsset.height}（原始 ${rawAsset.image.length} bytes）`);

  const results: Array<Record<string, unknown>> = [];
  const pipeline = new ImageToCodePipeline();

  for (const tier of TIERS) {
    const startedAt = Date.now();
    console.log(`\n=== 档位 ${tier.label}%｜tech=${tier.tech} ===`);
    try {
      const runOptions: Parameters<ImageToCodePipeline["run"]>[0] = {
        asset: { type: "file", buffer: asset.image, filename: "original.png" },
        techStack: tier.tech,
        targetFidelity: tier.fidelity,
        viewport: { width: asset.width, height: asset.height },
      };
      if (tier.loops !== undefined) runOptions.customLoops = tier.loops;
      const result = await pipeline.run(runOptions);

      const outDir = path.join(ROOT, "output", "live", `tier-${tier.label}`);
      writeOutputFiles(result, outDir);
      // 保留输入截图证据
      fs.writeFileSync(path.join(outDir, "original.png"), asset.image);
      // 渲染最终产物为证据截图
      const rendered = await renderFilesToScreenshot(result.files, result.entry, {
        width: asset.width,
        height: asset.height,
      });
      fs.writeFileSync(path.join(outDir, "final-render.png"), rendered.screenshot);
      fs.writeFileSync(
        path.join(outDir, "evidence.json"),
        JSON.stringify(
          {
            tier: tier.label,
            url: TARGET_URL,
            input: `${asset.width}x${asset.height}`,
            targetFidelity: result.report.targetFidelity,
            finalScore: result.report.finalScore,
            rounds: result.report.iterations.length,
            iterations: result.report.iterations,
            palette: result.report.colorPalette,
            consoleErrors: rendered.consoleErrors,
            durationMs: Date.now() - startedAt,
          },
          null,
          2,
        ),
      );
      results.push({
        tier: tier.label,
        tech: tier.tech,
        target: tier.fidelity,
        finalScore: result.report.finalScore,
        rounds: result.report.iterations.length,
        issues: result.report.iterations.at(-1)?.issues ?? [],
        passed: result.report.finalScore >= tier.fidelity,
        durationMs: Date.now() - startedAt,
      });
      console.log(
        `综合还原度 ${result.report.finalScore}｜迭代 ${result.report.iterations.length} 轮｜${Date.now() - startedAt}ms`,
      );
    } catch (err) {
      results.push({
        tier: tier.label,
        tech: tier.tech,
        target: tier.fidelity,
        error: err instanceof Error ? err.message : String(err),
        passed: false,
        durationMs: Date.now() - startedAt,
      });
      console.error(`档位 ${tier.label} 执行失败：`, err instanceof Error ? err.message : err);
    }
  }

  const resultFile = path.join(ROOT, "output", "live", "live-results.json");
  fs.mkdirSync(path.dirname(resultFile), { recursive: true });
  fs.writeFileSync(resultFile, JSON.stringify(results, null, 2));
  console.log(`\n结果汇总：${resultFile}`);
  for (const r of results) {
    console.log(JSON.stringify(r));
  }
}

main()
  .catch((err) => {
    console.error("Live 测试异常：", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([closeBrowser(), closeRenderer()]);
  });
