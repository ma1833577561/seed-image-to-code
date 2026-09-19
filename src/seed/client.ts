/**
 * Seed 多模态客户端
 * - ArkClient：火山方舟 OpenAI 兼容接口（模型 doubao-seed-evolving，能力 = Seed-2.1-pro-0915）
 * - MockClient：测试用，不发起真实调用
 */

import OpenAI from "openai";
import { ARK_BASE_URL, ARK_MODEL } from "../constants.js";
import { getConfig } from "../config.js";

export interface ChatImageMessage {
  role: "user";
  text: string;
  /** data URL 或 http(s) URL */
  images: string[];
}

export interface SeedClient {
  chatWithImages(req: ChatImageMessage, jsonMode?: boolean): Promise<string>;
  readonly model: string;
}

export class ArkClient implements SeedClient {
  readonly model: string;
  private client: OpenAI;

  constructor(opts?: { apiKey?: string; baseUrl?: string; model?: string }) {
    const cfg = getConfig();
    const apiKey = opts?.apiKey ?? cfg.arkApiKey;
    if (!apiKey) throw new Error("ARK_API_KEY 未配置：请在 .env 中填写火山方舟密钥");
    this.model = opts?.model ?? cfg.arkModel;
    this.client = new OpenAI({
      apiKey,
      baseURL: opts?.baseUrl ?? cfg.arkBaseUrl,
      maxRetries: 1,
      timeout: Number(process.env.ARK_TIMEOUT_MS ?? 600_000),
    });
  }

  async chatWithImages(req: ChatImageMessage, jsonMode = false): Promise<string> {
    const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
      { type: "text", text: req.text },
      ...req.images.map(
        (url) =>
          ({ type: "image_url", image_url: { url } }) as OpenAI.Chat.Completions.ChatCompletionContentPart,
      ),
    ];
    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.2,
      max_tokens: Number(process.env.GEN_MAX_TOKENS ?? 6000),
      response_format: jsonMode ? { type: "json_object" } : undefined,
      messages: [{ role: "user", content }],
    });
    const text = response.choices[0]?.message?.content;
    if (!text) throw new Error("Seed 返回为空");
    return text;
  }
}

/** 测试用 Mock 客户端 */
export class MockClient implements SeedClient {
  readonly model: string;
  constructor(
    public handler: (req: ChatImageMessage, jsonMode: boolean) => string | Promise<string>,
    model = "mock-seed",
  ) {
    this.model = model;
  }

  chatWithImages(req: ChatImageMessage, jsonMode = false): Promise<string> {
    return Promise.resolve(this.handler(req, jsonMode));
  }

  static fixed(text: string): MockClient {
    return new MockClient(() => text);
  }
}
