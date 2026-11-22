import fs from "node:fs";

/** vitest 全局 setup：测试环境默认值 */
process.env.VIEWPORT_WIDTH = process.env.VIEWPORT_WIDTH ?? "1440";
process.env.VIEWPORT_HEIGHT = process.env.VIEWPORT_HEIGHT ?? "900";
// 优先用外部传入的 CHROMIUM_PATH；没有就按平台探测，避免换个机器 dry 测试就挂
if (!process.env.CHROMIUM_PATH) {
  const candidates = [
    "/usr/local/bin/chromium",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (found) process.env.CHROMIUM_PATH = found;
}
// 测试默认不要求真实密钥（Live 测试单独校验）
