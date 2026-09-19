/**
 * 质量报告生成（Markdown / JSON）
 */

import fs from "node:fs";
import path from "node:path";
import type { GenerateResult, QualityReport } from "../types.js";

export function buildReportMarkdown(result: GenerateResult): string {
  const r = result.report;
  const lines: string[] = [];
  lines.push(`# 质量报告`);
  lines.push("");
  lines.push(`- 来源：${result.sourceAsset.source}`);
  lines.push(`- 技术栈：${r.techStack}｜目标还原度：${r.targetFidelity}｜最终综合还原度：${r.finalScore}`);
  lines.push(`- 画布：${r.dimensions.width} × ${r.dimensions.height}`);
  lines.push(`- 文件：${r.files.join("、")}`);
  lines.push("");
  lines.push(`## 迭代记录`);
  lines.push(`| 轮次 | 像素分 | VLM布局 | VLM色彩 | VLM排版 | VLM细节 | 综合分 |`);
  lines.push(`|------|--------|---------|---------|---------|---------|--------|`);
  for (const it of r.iterations) {
    lines.push(
      `| ${it.round} | ${it.pixelScore} | ${it.vlm.layout} | ${it.vlm.color} | ${it.vlm.typography} | ${it.vlm.detail} | ${it.totalScore} |`,
    );
  }
  lines.push("");
  lines.push(`## 结论`);
  for (const s of r.summary) lines.push(`- ${s}`);
  lines.push("");
  lines.push(`## 主题色板`);
  lines.push(`| 角色 | 色值 | 占比 |`);
  lines.push(`|------|------|------|`);
  for (const c of r.colorPalette) lines.push(`| ${c.role} | ${c.hex} | ${(c.ratio * 100).toFixed(1)}% |`);
  const lastIssues = r.iterations.at(-1)?.issues ?? [];
  lines.push("");
  lines.push(`## 剩余问题清单（末轮）`);
  if (lastIssues.length === 0) {
    lines.push(`- 无`);
  } else {
    lastIssues.forEach((i, idx) => lines.push(`${idx + 1}. ${i}`));
  }
  return lines.join("\n");
}

export function buildReportJson(result: GenerateResult): QualityReport {
  return result.report;
}

/** 将产物文件写出到输出目录 */
export function writeOutputFiles(result: GenerateResult, outDir: string): void {
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of result.files) {
    const target = path.join(outDir, f.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, f.content, "utf8");
  }
  fs.writeFileSync(path.join(outDir, "quality-report.md"), buildReportMarkdown(result), "utf8");
  fs.writeFileSync(path.join(outDir, "quality-report.json"), JSON.stringify(result.report, null, 2), "utf8");
}
