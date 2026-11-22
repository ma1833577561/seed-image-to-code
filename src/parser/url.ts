/**
 * URL 站点还原：无头浏览器（puppeteer-core）截图
 * - 默认视口 1440×900，支持全页长截图，截图前触发懒加载滚动
 */

import puppeteer, { type Browser } from "puppeteer-core";
import type { ParsedAsset, AssetInput, Viewport } from "../types.js";
import { resolveChromiumPath } from "../config.js";
import { DEFAULT_VIEWPORT } from "../constants.js";

let cachedBrowser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (cachedBrowser) return cachedBrowser;
  cachedBrowser = await puppeteer.launch({
    executablePath: resolveChromiumPath(),
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
    ],
  });
  return cachedBrowser;
}

export async function closeBrowser(): Promise<void> {
  if (cachedBrowser) {
    await cachedBrowser.close().catch(() => undefined);
    cachedBrowser = null;
  }
}

export interface UrlCaptureResult {
  image: Buffer;
  width: number;
  height: number;
  title: string;
  fullPage: boolean;
}

export async function captureUrl(
  url: string,
  viewport: Viewport = DEFAULT_VIEWPORT,
  opts?: { fullPage?: boolean },
): Promise<UrlCaptureResult> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: viewport.width, height: viewport.height });
    // 真实桌面 UA + 常用请求头，规避基础反爬/WAF 拦截
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    );
    await page.setExtraHTTPHeaders({
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"',
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
    });
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60_000 });
    // 懒加载滚动：分步滚动到底部再回顶部
    await page.evaluate(async () => {
      const step = 800;
      const total = document.body.scrollHeight;
      for (let y = 0; y < total; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 80));
      }
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 300));
    });
    const title = await page.title();
    const fullPage = opts?.fullPage ?? false;
    const image = Buffer.from(
      await page.screenshot({
        type: "png",
        fullPage,
        captureBeyondViewport: false,
      }),
    );
    const dims = fullPage
      ? await page.evaluate(() => ({
          width: document.documentElement.scrollWidth,
          height: document.documentElement.scrollHeight,
        }))
      : { width: viewport.width, height: viewport.height };
    return { image, width: dims.width, height: dims.height, title, fullPage };
  } finally {
    await page.close().catch(() => undefined);
  }
}

export async function parseUrl(
  input: Extract<AssetInput, { type: "url" }>,
  viewport: Viewport = DEFAULT_VIEWPORT,
): Promise<ParsedAsset> {
  const captured = await captureUrl(input.url, viewport, { fullPage: false });
  return {
    kind: "url",
    source: input.url,
    image: captured.image,
    mime: "image/png",
    width: captured.width,
    height: captured.height,
    structureSummary: `站点：${input.url}｜标题：${captured.title}｜视口 ${captured.width}×${captured.height}`,
  };
}
