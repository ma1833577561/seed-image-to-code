/** vitest 全局 setup：测试环境默认值 */
process.env.VIEWPORT_WIDTH = process.env.VIEWPORT_WIDTH ?? "1440";
process.env.VIEWPORT_HEIGHT = process.env.VIEWPORT_HEIGHT ?? "900";
process.env.CHROMIUM_PATH = process.env.CHROMIUM_PATH ?? "/usr/local/bin/chromium";
// 测试默认不要求真实密钥（Live 测试单独校验）
