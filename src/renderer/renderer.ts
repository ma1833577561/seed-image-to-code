/**
 * 渲染器：puppeteer-core 渲染入口 → PNG 截图
 * - native-html：直接加载 entry HTML
 * - react-tsx：用 esbuild 在内存中打包（含 react/react-dom），注入到 HTML 中执行
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { build } from "esbuild";
import puppeteer, { type Browser } from "puppeteer-core";
import type { CodeFile, Viewport } from "../types.js";
import { resolveChromiumPath } from "../config.js";
import { DEFAULT_VIEWPORT } from "../constants.js";

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (browser) return browser;
  browser = await puppeteer.launch({
    executablePath: resolveChromiumPath(),
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });
  return browser;
}

export interface RenderResult {
  screenshot: Buffer;
  width: number;
  height: number;
  consoleErrors: string[];
}

/** 把生成的文件渲染为 HTML 字符串（处理 react-tsx 打包） */
async function buildRenderableHtml(files: CodeFile[], entry: string): Promise<string> {
  const normalizedEntry = entry.replace(/^\.\//, "");
  const isJsx = /\.(t|j)sx?$/.test(normalizedEntry);

  if (!isJsx) {
    const html = files.find((f) => f.path.replace(/^\.\//, "") === normalizedEntry);
    if (!html) throw new Error(`入口文件不存在：${entry}`);
    return html.content;
  }

  // react-tsx：把所有文件写到临时目录，用 esbuild 打包成单文件 JS
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "seed2code-"));
  try {
    for (const f of files) {
      const rel = f.path.replace(/^\.\//, "");
      const abs = path.join(tmp, rel);
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, f.content, "utf8");
    }
    const result = await build({
      entryPoints: [path.join(tmp, normalizedEntry)],
      bundle: true,
      write: false,
      format: "iife",
      loader: { ".tsx": "tsx", ".ts": "ts", ".jsx": "jsx", ".js": "js", ".css": "css" },
      jsx: "automatic",
      // 临时目录在 /tmp，需显式指向项目 node_modules 才能解析 react
      nodePaths: [path.resolve(process.cwd(), "node_modules")],
      minify: false,
      logLevel: "silent",
    });
    const js = result.outputFiles?.[0]?.text ?? "";
    return `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>preview</title></head>
<body><div id="root"></div><script>${js}</script></body>
</html>`;
  } finally {
    await fs.rm(tmp, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** 将生成的文件渲染为截图（files 中取 entry 作为入口） */
export async function renderFilesToScreenshot(
  files: CodeFile[],
  entry: string,
  viewport: Viewport = DEFAULT_VIEWPORT,
): Promise<RenderResult> {
  const html = await buildRenderableHtml(files, entry);

  const page = await (await getBrowser()).newPage();
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  try {
    await page.setViewport({ width: viewport.width, height: viewport.height });
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 60_000 });
    // 等待 React 挂载与字体渲染稳定
    await new Promise((r) => setTimeout(r, 2000));
    const screenshot = Buffer.from(await page.screenshot({ type: "png" }));
    return {
      screenshot,
      width: viewport.width,
      height: viewport.height,
      consoleErrors,
    };
  } finally {
    await page.close().catch(() => undefined);
  }
}

export async function closeRenderer(): Promise<void> {
  if (browser) {
    await browser.close().catch(() => undefined);
    browser = null;
  }
}
