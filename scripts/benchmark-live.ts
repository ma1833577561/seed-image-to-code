/**
 * 并发压测：1 / 2 / 4 并发执行同一任务（真实 Seed API）
 * 观测：平均耗时、P95、成功率、还原度、迭代轮次
 * 输入：默认使用本地合成 UI 样例（官方目标页整页生成耗时长，见测试报告）；
 *       设置 BENCH_MODE=url 可切换为站点截图输入。
 * 运行：npm run benchmark:live
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { ImageToCodePipeline } from "../src/pipeline/index.js";
import { hasApiKey } from "../src/config.js";
import { parseAsset } from "../src/parser/index.js";
import { closeBrowser } from "../src/parser/url.js";
import { closeRenderer } from "../src/renderer/renderer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TARGET_URL = process.env.BENCH_URL ?? "https://www.volcengine.com/";
const MAX_INPUT_WIDTH = Number(process.env.BENCH_MAX_WIDTH ?? 640);
const LEVELS = [1, 2, 4] as const;
const BENCH_MODE = process.env.BENCH_MODE ?? "synthetic";

interface TaskResult {
  concurrency: number;
  task: number;
  ok: boolean;
  durationMs: number;
  fidelity: number;
  rounds: number;
  error?: string;
}

function p95(durations: number[]): number {
  if (durations.length === 0) return 0;
  const sorted = [...durations].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]!;
}

/** 合成 UI 样例（浅色底 + 品牌色头图 + 卡片 + 色条） */
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

async function resolveAsset(): Promise<{ image: Buffer; width: number; height: number; label: string }> {
  if (BENCH_MODE === "url") {
    const raw = await parseAsset({ type: "url", url: TARGET_URL });
    let asset = raw;
    if (asset.width > MAX_INPUT_WIDTH) {
      const resized = await sharp(asset.image).resize({ width: MAX_INPUT_WIDTH }).png().toBuffer();
      const meta = await sharp(resized).metadata();
      asset = { ...asset, image: resized, width: meta.width ?? MAX_INPUT_WIDTH, height: meta.height ?? asset.height };
    }
    return { image: asset.image, width: asset.width, height: asset.height, label: `URL:${TARGET_URL}` };
  }
  const image = await makeSampleUi();
  return { image, width: 640, height: 480, label: "synthetic-ui" };
}

async function runWave(
  concurrency: number,
  image: Buffer,
  width: number,
  height: number,
): Promise<TaskResult[]> {
  const tasks: TaskResult[] = [];
  const run = async (task: number): Promise<TaskResult> => {
    const startedAt = Date.now();
    try {
      const pipeline = new ImageToCodePipeline();
      const result = await pipeline.run({
        asset: { type: "file", buffer: image, filename: "input.png" },
        techStack: "native-html",
        targetFidelity: 85,
        customLoops: 1,
        viewport: { width, height },
      });
      return {
        concurrency,
        task,
        ok: true,
        durationMs: Date.now() - startedAt,
        fidelity: result.report.finalScore,
        rounds: result.report.iterations.length,
      };
    } catch (err) {
      return {
        concurrency,
        task,
        ok: false,
        durationMs: Date.now() - startedAt,
        fidelity: 0,
        rounds: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  };
  await Promise.all(Array.from({ length: concurrency }, (_, i) => run(i + 1).then((r) => tasks.push(r))));
  return tasks.sort((a, b) => a.task - b.task);
}

async function main(): Promise<void> {
  if (!hasApiKey()) {
    console.error("[blocked] ARK_API_KEY 未配置：压测无法执行（按交付周期协议置 waiting_user）");
    process.exit(2);
  }

  const { image, width, height, label } = await resolveAsset();
  console.log(`压测输入：${label}（${width}×${height}，${Math.round(image.length / 1024)}KB）｜并发 1/2/4，fidelity=85，1 轮`);

  const all: TaskResult[] = [];
  for (const level of LEVELS) {
    const waveStarted = Date.now();
    const wave = await runWave(level, image, width, height);
    all.push(...wave);
    const durations = wave.map((w) => w.durationMs);
    const okCount = wave.filter((w) => w.ok).length;
    console.log(
      `并发 ${level}：成功率 ${okCount}/${wave.length}｜平均 ${Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)}ms｜P95 ${p95(durations)}ms｜波次耗时 ${((Date.now() - waveStarted) / 1000).toFixed(0)}s`,
    );
    for (const t of wave) {
      console.log(
        `  task${t.task}: ${t.ok ? `OK 还原度=${t.fidelity} 轮次=${t.rounds}` : `FAIL ${t.error}`}｜${Math.round(t.durationMs / 1000)}s`,
      );
    }
  }

  const resultFile = path.join(ROOT, "output", "benchmark", "benchmark-results.json");
  fs.mkdirSync(path.dirname(resultFile), { recursive: true });
  fs.writeFileSync(resultFile, JSON.stringify(all, null, 2));

  const overallOk = all.filter((a) => a.ok).length / all.length;
  const overallDurations = all.map((a) => a.durationMs);
  console.log(
    `\n整体：成功率 ${(overallOk * 100).toFixed(1)}%｜平均 ${Math.round(overallDurations.reduce((a, b) => a + b, 0) / overallDurations.length / 1000)}s｜P95 ${Math.round(p95(overallDurations) / 1000)}s`,
  );
  console.log(`结果：${resultFile}`);
}

main()
  .catch((err) => {
    console.error("压测异常：", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([closeBrowser(), closeRenderer()]);
  });
