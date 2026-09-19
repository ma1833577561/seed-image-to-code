/**
 * CLI 入口：seed2code
 * 用法：
 *   seed2code generate <file|url> [--tech native-html|vue3|react-tsx] [--fidelity 90] [-o outDir]
 *   seed2code mcp
 */

import fs from "node:fs";
import { ImageToCodePipeline } from "../pipeline/index.js";
import { writeOutputFiles } from "../reporter/report.js";
import { closeBrowser } from "../parser/url.js";
import { closeRenderer } from "../renderer/renderer.js";
import { startMcpServer } from "../mcp/mcpServer.js";

interface CliOptions {
  tech?: string;
  fidelity?: number;
  out?: string;
}

function parseArgs(argv: string[]): { command: string; positional: string[]; options: CliOptions } {
  const options: CliOptions = {};
  const positional: string[] = [];
  let command = "help";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--tech") options.tech = argv[++i];
    else if (a === "--fidelity") options.fidelity = Number(argv[++i]);
    else if (a === "-o" || a === "--out") options.out = argv[++i];
    else if (a === "generate" || a === "mcp" || a === "help") command = a;
    else positional.push(a);
  }
  return { command, positional, options };
}

function printHelp(): void {
  console.log(`seed-image-to-code — Seed-2.1-pro-0915 驱动的设计资产转代码
用法：
  seed2code generate <文件路径|URL> [--tech native-html|vue3|react-tsx] [--fidelity 85~100] [-o 输出目录]
  seed2code mcp
示例：
  seed2code generate ./login.png --tech vue3 --fidelity 90 -o ./output
  seed2code generate https://www.volcengine.com/ --tech react-tsx --fidelity 85 -o ./output`);
}

async function main(): Promise<void> {
  const { command, positional, options } = parseArgs(process.argv.slice(2));
  if (command === "mcp") {
    await startMcpServer();
    return;
  }
  if (command !== "generate" || positional.length === 0) {
    printHelp();
    return;
  }
  const target = positional[0]!;
  const tech = (options.tech ?? "native-html") as "native-html" | "vue3" | "react-tsx";
  if (!["native-html", "vue3", "react-tsx"].includes(tech)) {
    throw new Error("不支持的 tech，可选：native-html / vue3 / react-tsx");
  }
  const fidelity = options.fidelity ?? 90;
  const out = options.out ?? "./output";
  const asset = /^https?:\/\//i.test(target)
    ? { type: "url" as const, url: target }
    : { type: "file" as const, buffer: fs.readFileSync(target), filename: target };

  console.log(`[1/4] 解析资产：${target}`);
  const pipeline = new ImageToCodePipeline();
  console.log(`[2/4] Seed 多模态生成中（tech=${tech}, fidelity=${fidelity}）…`);
  const result = await pipeline.run({ asset, techStack: tech, targetFidelity: fidelity });
  console.log(`[3/4] 写入产物：${out}`);
  writeOutputFiles(result, out);
  console.log(`[4/4] 完成：综合还原度 ${result.report.finalScore}，迭代 ${result.report.iterations.length} 轮`);
  console.log(`产物目录：${out}`);
}

main()
  .catch((err) => {
    console.error("执行失败：", err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([closeBrowser(), closeRenderer()]);
  });
