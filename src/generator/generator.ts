/**
 * Seed 代码生成器：首轮生成 + 迭代修正
 */

import type { CodeFile, ColorToken, TechStack, Viewport } from "../types.js";
import type { SeedClient } from "../seed/client.js";
import { buildFirstPrompt, buildFixPrompt, type GenerationContext } from "./prompt.js";

export function toDataUrl(image: Buffer, mime = "image/png"): string {
  return `data:${mime};base64,${image.toString("base64")}`;
}

export interface GenerateParams {
  image: Buffer;
  mime?: string;
  techStack: TechStack;
  viewport: Viewport;
  colorTokens: ColorToken[];
  structureSummary?: string;
  projectConfig?: unknown;
}

export interface FixParams extends GenerateParams {
  issues: string[];
}

export interface FileBundle {
  files: CodeFile[];
  entry: string;
}

function parseFileBundle(raw: string): FileBundle {
  const text = raw.trim();
  const json = text.startsWith("{") ? text : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed.files) || parsed.files.length === 0) {
    throw new Error("模型未返回有效文件清单");
  }
  const files: CodeFile[] = parsed.files.map((f: { path?: string; content?: string }) => {
    if (!f.path || typeof f.content !== "string") throw new Error("文件结构不合法");
    return { path: f.path, content: f.content };
  });
  const entry = typeof parsed.entry === "string" ? parsed.entry : "index.html";
  return { files, entry };
}

export class CodeGenerator {
  constructor(private seed: SeedClient) {}

  private context(p: GenerateParams): GenerationContext {
    return {
      techStack: p.techStack,
      viewport: p.viewport,
      colorTokens: p.colorTokens,
      structureSummary: p.structureSummary,
      projectConfig: p.projectConfig,
    };
  }

  /** 解析模型输出；JSON 被截断/损坏时自动重试一次（追加提示要求完整 JSON） */
  private async callAndParse(
    prompt: string,
    image: string,
    attempt = 0,
  ): Promise<FileBundle> {
    const raw = await this.seed.chatWithImages(
      { role: "user", text: prompt, images: [image] },
      true,
    );
    try {
      return parseFileBundle(raw);
    } catch (err) {
      if (attempt >= 1) throw err;
      // 截断常见：追加一句要求，重新生成
      const retryPrompt =
        prompt +
        "\n\n注意：上一次输出被截断导致 JSON 不完整。请严格输出完整、合法的单个 JSON 对象，不要省略任何文件内容，不要使用 markdown 代码块。";
      return this.callAndParse(retryPrompt, image, attempt + 1);
    }
  }

  async first(p: GenerateParams): Promise<FileBundle> {
    const prompt = buildFirstPrompt(this.context(p));
    return this.callAndParse(prompt, toDataUrl(p.image, p.mime));
  }

  async fix(p: FixParams): Promise<FileBundle> {
    const prompt = buildFixPrompt(this.context(p), p.issues);
    return this.callAndParse(prompt, toDataUrl(p.image, p.mime));
  }
}

/** 生成类调用统一带上限（复杂页面输出极长，避免无限等待；截断会如实报错） */
export function generationMaxTokens(): number {
  return Number(process.env.GEN_MAX_TOKENS ?? 8000);
}
