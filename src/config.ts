/** 环境配置加载（.env 手动维护，避免引入额外依赖） */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function loadEnvFile(root: string): void {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnvFile(path.resolve(__dirname, ".."));

export interface AppConfig {
  arkApiKey: string;
  arkBaseUrl: string;
  arkModel: string;
  chromiumPath: string;
  viewport: { width: number; height: number };
}

export function getConfig(): AppConfig {
  return {
    arkApiKey: process.env.ARK_API_KEY ?? "",
    arkBaseUrl: process.env.ARK_BASE_URL ?? "https://ark.cn-beijing.volces.com/api/v3",
    arkModel: process.env.ARK_MODEL ?? "doubao-seed-evolving",
    chromiumPath: process.env.CHROMIUM_PATH ?? "/usr/local/bin/chromium",
    viewport: {
      width: Number(process.env.VIEWPORT_WIDTH ?? 1440),
      height: Number(process.env.VIEWPORT_HEIGHT ?? 900),
    },
  };
}

export function hasApiKey(): boolean {
  return Boolean(getConfig().arkApiKey);
}
