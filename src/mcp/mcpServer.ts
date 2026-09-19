/**
 * MCP Server（stdio JSON-RPC 2.0）
 * 暴露工具 design_to_code，适配 Harness TRAE / Claude Code / Cursor 等 IDE。
 * 内部规则（轮次上限等）不暴露给用户可见参数。
 */

import readline from "node:readline";
import fs from "node:fs";
import { ImageToCodePipeline, normalizeTargetFidelity } from "../pipeline/index.js";
import type { TechStack } from "../types.js";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string };
}

const TOOL_DEF = {
  name: "design_to_code",
  description:
    "Seed 多模态驱动：设计图/PSD/URL/Figma 转前端代码，支持多技术栈与目标还原度。传入本地文件路径或站点 URL。",
  inputSchema: {
    type: "object",
    properties: {
      asset_path: {
        type: "string",
        description: "本地设计文件路径，或 http(s) 站点 URL（自动截图还原）",
      },
      tech_stack: {
        type: "string",
        enum: ["native-html", "vue3", "react-tsx"],
        description: "目标技术栈",
      },
      fidelity: {
        type: "number",
        minimum: 85,
        maximum: 100,
        default: 90,
        description: "目标还原度",
      },
      output_dir: {
        type: "string",
        description: "产物输出目录（可选，默认 ./output）",
      },
    },
    required: ["asset_path"],
  },
} as const;

function send(res: JsonRpcResponse): void {
  process.stdout.write(JSON.stringify(res) + "\n");
}

async function handleToolCall(params: unknown): Promise<unknown> {
  const args = (params ?? {}) as Record<string, unknown>;
  const assetPath = String(args.asset_path ?? "");
  if (!assetPath) throw new Error("asset_path 必填");

  const isUrl = /^https?:\/\//i.test(assetPath);
  const asset = isUrl
    ? { type: "url" as const, url: assetPath }
    : { type: "file" as const, buffer: fs.readFileSync(assetPath), filename: assetPath };

  const techStack = (args.tech_stack as TechStack) ?? "native-html";
  const fidelity = normalizeTargetFidelity(Number(args.fidelity ?? 90));
  const outDir = String(args.output_dir ?? "./output");

  const pipeline = new ImageToCodePipeline();
  const result = await pipeline.run({ asset, techStack, targetFidelity: fidelity });

  // 产物落盘
  const { writeOutputFiles } = await import("../reporter/report.js");
  writeOutputFiles(result, outDir);

  return {
    done: true,
    entry: result.entry,
    files: result.files.map((f) => f.path),
    fidelity: {
      target: result.report.targetFidelity,
      final: result.report.finalScore,
      rounds: result.report.iterations.length,
    },
    issues: result.report.iterations.at(-1)?.issues ?? [],
    output_dir: outDir,
  };
}

export async function startMcpServer(): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let req: JsonRpcRequest;
    try {
      req = JSON.parse(line);
    } catch {
      continue;
    }
    const respond = (result?: unknown, error?: { code: number; message: string }) =>
      send({ jsonrpc: "2.0", id: req.id ?? null, result, error });

    try {
      switch (req.method) {
        case "initialize":
          respond({
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: { name: "seed-image-to-code", version: "1.0.0" },
          });
          break;
        case "notifications/initialized":
        case "initialized":
          break;
        case "tools/list":
          respond({ tools: [TOOL_DEF] });
          break;
        case "tools/call": {
          const p = (req.params ?? {}) as { name?: string; arguments?: unknown };
          if (p.name !== "design_to_code") throw new Error(`未知工具：${p.name}`);
          const result = await handleToolCall(p.arguments);
          respond({
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          });
          break;
        }
        case "ping":
          respond({});
          break;
        default:
          respond(undefined, { code: -32601, message: `不支持的方法：${req.method}` });
      }
    } catch (err) {
      respond(undefined, {
        code: -32603,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
