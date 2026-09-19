# OpenSpec 01：项目总览（Overview）

## 1. 规格元信息

| 项 | 值 |
|----|----|
| 项目名 | seed-image-to-code |
| 版本 | v1.0.0 |
| 语言/运行时 | TypeScript / Node.js ≥ 18 |
| 模型 | doubao-seed-evolving（能力 = Seed-2.1-pro-0915） |
| API 端点 | https://ark.cn-beijing.volces.com/api/v3（OpenAI 兼容） |

## 2. 规格文档索引

| 文档 | 内容 |
|------|------|
| 02-architecture.md | 分层架构、目录结构、技术选型 |
| 03-api.md | SDK / CLI / MCP 接口契约 |
| 04-testing.md | 测试策略：单元 / Dry / Live / 压测 |
| 05-acceptance.md | 验收标准与分级 |
| 06-delivery-cycle.md | 开发-测试-验收周期规则（max 10） |

## 3. 一句话规格

一次调用完成「设计资产 → 可运行前端代码 + 质量报告」，内部以「本地预解析降耗 + Seed 多模态首轮生成 + 像素/VLM 双维评分 + 迭代修正（≤10 轮）+ 交付周期验收（≤10 周期）」闭环执行，两层次数限制对用户不可见。

## 4. 外部依赖

- 火山方舟 OpenAI 兼容 API（Key 必填）
- 无头浏览器（本机已验证 /usr/local/bin/chromium，puppeteer-core 驱动）
- npm 包：openai / pixelmatch / pngjs / sharp / puppeteer-core / ag-psd

## 5. 可配置项（环境变量）

| 变量 | 必填 | 默认 |
|------|------|------|
| ARK_API_KEY | 是 | - |
| ARK_BASE_URL | 否 | https://ark.cn-beijing.volces.com/api/v3 |
| ARK_MODEL | 否 | doubao-seed-evolving |
| CHROMIUM_PATH | 否 | /usr/local/bin/chromium |
| VIEWPORT_WIDTH/HEIGHT | 否 | 1440 / 900 |
