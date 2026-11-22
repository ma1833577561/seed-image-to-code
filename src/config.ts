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
// 先从当前工作目录找 .env（npx / 全局安装时的常见位置），再回退到包根目录
loadEnvFile(process.cwd());
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
    chromiumPath: detectChromium(),
    viewport: {
      width: Number(process.env.VIEWPORT_WIDTH ?? 1440),
      height: Number(process.env.VIEWPORT_HEIGHT ?? 900),
    },
  };
}

const CHROMIUM_CANDIDATES = [
  "/usr/local/bin/chromium",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

/** 按平台猜 Chrome/Chromium 位置；找不到返回空串，由调用方给出可读的报错 */
export function detectChromium(): string {
  const fromEnv = process.env.CHROMIUM_PATH?.trim();
  if (fromEnv) return fromEnv;
  for (const candidate of CHROMIUM_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return "";
}

/** 拿不到浏览器时抛错，把「去哪装、怎么指」直接写进错误里 */
export function resolveChromiumPath(): string {
  const found = getConfig().chromiumPath;
  if (found && fs.existsSync(found)) return found;
  throw new Error(
    [
      found ? `CHROMIUM_PATH 指向的文件不存在: ${found}` : "没有找到 Chrome / Chromium。",
      "本项目用 puppeteer-core（不自带浏览器），需要本机已有 Chrome：",
      "  macOS:  默认会自动找到 /Applications/Google Chrome.app",
      "  Linux:  sudo apt install chromium-browser  （或 npx puppeteer browsers install chrome）",
      "  也可以显式指定：export CHROMIUM_PATH=/path/to/chrome",
    ].join("\n"),
  );
}

export function hasApiKey(): boolean {
  return Boolean(getConfig().arkApiKey);
}
