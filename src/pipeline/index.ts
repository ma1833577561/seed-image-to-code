/**
 * 单任务闭环编排
 * 流程：解析资产 → 提取主题色 → Seed 首轮生成 → 渲染 → 双维评分 → 未达标修正（≤ SYSTEM_MAX_LOOPS）
 * 提前终止：达标 / 代码连续无变化 / 问题清单连续无变化
 */

import type {
  CodeFile,
  GenerateOptions,
  GenerateResult,
  IterationRecord,
  QualityReport,
} from "../types.js";
import { FIDELITY_LOOP_MAP, MIN_FIDELITY, SYSTEM_MAX_LOOPS } from "../constants.js";
import { parseAsset } from "../parser/index.js";
import { extractTheme } from "../extractor/theme.js";
import { ArkClient, type SeedClient } from "../seed/client.js";
import { CodeGenerator } from "../generator/generator.js";
import { renderFilesToScreenshot } from "../renderer/renderer.js";
import { calcFidelity, isDimensionTargetMet } from "../fidelity/index.js";

export function loopsByFidelity(target: number): number {
  const clamped = Math.max(MIN_FIDELITY, Math.min(100, target));
  const hit = FIDELITY_LOOP_MAP.find((m) => clamped >= m.min);
  return hit?.loops ?? 1;
}

export function normalizeTargetFidelity(target: number): number {
  return Math.max(MIN_FIDELITY, Math.min(100, target));
}

export class ImageToCodePipeline {
  constructor(private seed?: SeedClient) {}

  private getSeed(): SeedClient {
    if (this.seed) return this.seed;
    return new ArkClient();
  }

  async run(options: GenerateOptions): Promise<GenerateResult> {
    const seed = this.getSeed();
    const techStack = options.techStack ?? "native-html";
    const targetFidelity = normalizeTargetFidelity(options.targetFidelity ?? 90);
    const viewport = options.viewport ?? { width: 1440, height: 900 };

    // 1. 资产解析
    const asset = await parseAsset(options.asset);
    // 2. 主题色提取（本地聚类 + Seed 语义分类）
    const colorTokens = await extractTheme(asset, seed);

    // 3. 迭代闭环
    const generator = new CodeGenerator(seed);
    const maxLoops = Math.min(options.customLoops ?? loopsByFidelity(targetFidelity), SYSTEM_MAX_LOOPS);
    const iterations: IterationRecord[] = [];

    let bundle = await generator.first({
      image: asset.image,
      mime: asset.mime,
      techStack,
      viewport,
      colorTokens,
      structureSummary: asset.structureSummary,
      projectConfig: options.projectConfig,
    });
    let files: CodeFile[] = bundle.files;
    let entry = bundle.entry;

    let lastIssues: string[] = [];
    let lastSignature = "";

    for (let round = 1; round <= maxLoops; round++) {
      const rendered = await renderFilesToScreenshot(files, entry, viewport);
      const record = await calcFidelity({
        seed,
        original: asset.image,
        rendered: rendered.screenshot,
        width: asset.width || viewport.width,
        height: asset.height || viewport.height,
      });
      record.round = round;
      iterations.push(record);

      const signature = files.map((f) => `${f.path}:${f.content.length}`).join("|");
      const issuesUnchanged =
        lastIssues.length > 0 &&
        lastIssues.length === record.issues.length &&
        lastIssues.every((v, i) => v === record.issues[i]);

      if (isDimensionTargetMet(record.vlm, targetFidelity, record.pixelScore) && record.totalScore >= targetFidelity) {
        break; // 达标提前终止
      }
      if (signature === lastSignature || issuesUnchanged) {
        break; // 无进展终止
      }
      if (round >= maxLoops) break;

      lastSignature = signature;
      lastIssues = record.issues;

      // 4. 迭代修正
      const next = await generator.fix({
        image: asset.image,
        mime: asset.mime,
        techStack,
        viewport,
        colorTokens,
        structureSummary: asset.structureSummary,
        projectConfig: options.projectConfig,
        issues: record.issues,
      });
      files = next.files;
      entry = next.entry;
    }

    // 5. 质量报告
    const report: QualityReport = {
      targetFidelity,
      finalScore: iterations.at(-1)?.totalScore ?? 0,
      iterations,
      colorPalette: colorTokens,
      dimensions: { width: asset.width, height: asset.height },
      techStack,
      files: files.map((f) => f.path),
      summary: buildSummary(iterations, targetFidelity),
    };

    return { files, report, sourceAsset: asset, entry };
  }
}

function buildSummary(iterations: IterationRecord[], target: number): string[] {
  if (iterations.length === 0) return ["未产生迭代记录"];
  const last = iterations.at(-1)!;
  const achieved = last.totalScore >= target;
  return [
    `共迭代 ${iterations.length} 轮，最终综合还原度 ${last.totalScore}（目标 ${target}）`,
    achieved ? "已达到目标还原度，提前终止" : "未达到目标还原度（受内部轮次上限约束，详见测试报告）",
    `末轮分项：布局 ${last.vlm.layout} / 色彩 ${last.vlm.color} / 排版 ${last.vlm.typography} / 细节 ${last.vlm.detail}`,
    ...(last.issues.length ? [`剩余问题 ${last.issues.length} 项（见报告）`] : ["无剩余问题"]),
  ];
}
