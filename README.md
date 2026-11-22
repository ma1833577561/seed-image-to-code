# seed-image-to-code

[![npm](https://img.shields.io/npm/v/seed-image-to-code)](https://www.npmjs.com/package/seed-image-to-code)
[![license](https://img.shields.io/npm/l/seed-image-to-code)](LICENSE)
![ci](https://github.com/ma1833577561/seed-image-to-code/actions/workflows/ci.yml/badge.svg)

基于 **Seed-2.1-pro-0915**（火山方舟 `doubao-seed-evolving`）多模态 Coding / VLM 能力构建的「设计资产转前端代码」Skill：输入设计图 / PSD / Figma / 站点 URL，自动完成 **主题色提取 → 多文件代码生成 → 渲染 → 双维还原度评分 → 迭代修正 → 质量报告** 的完整闭环。

## 安装 / 运行

```bash
npx seed-image-to-code help            # 不装直接用
npm i -g seed-image-to-code            # 或装到全局
seed2code generate ./design.png --tech vue3 --fidelity 90 -o ./output
```

想跟 main 最新代码走（不走 npm 包）：`npm i -g github:ma1833577561/seed-image-to-code`。

两个前置条件：

1. **ARK_API_KEY** —— 火山方舟的 key（生成和评分都要调 VLM）。放进当前目录的 `.env`，或 `export ARK_API_KEY=...`。
2. **本机 Chrome** —— 用 `puppeteer-core`，不下载浏览器。macOS 默认能找到；Linux 用 `sudo apt install chromium-browser`，或 `export CHROMIUM_PATH=/path/to/chrome`。

接进 MCP（Claude Code / Cursor / TRAE）：

```bash
seed2code mcp
```

## 能力概览

| 能力 | 说明 |
|------|------|
| 多格式输入 | PNG / JPEG / WebP / PSD / Figma / 站点 URL / 剪贴板截图 |
| 多技术栈 | 原生 HTML、Vue 3、React 18（内联单文件，可直接运行） |
| 目标还原度 | 85% ~ 100%，支持 99.99% 极限目标，还原度越高迭代越充分 |
| 还原度评分 | VLM 语义分 × 60% + 像素 diff × 40%（布局/色彩/排版/细节四维） |
| 迭代控制 | 内部「生成→渲染→评分→修正」闭环上限 10 次，达标即停 |
| 交付周期 | 开发-测试-验收总周期上限 10 次；未达标停止并等待用户指令 |
| 产物 | 多文件工程 + 质量报告（Markdown/JSON）+ 原图对比 + 问题清单 |
| IDE 接入 | MCP Server（stdio），适配 Harness TRAE / Claude Code / Cursor |

## 快速开始

```bash
npm install
cp .env.example .env   # 填入真实 ARK_API_KEY
npm run build

# CLI：图片转代码
npm run cli -- generate ./design.png --tech vue3 --fidelity 90 -o ./output

# CLI：站点还原
npm run cli -- generate https://www.volcengine.com/ --tech react-tsx --fidelity 85 -o ./output

# MCP Server（供 IDE 连接）
npm run mcp
```

## 测试

```bash
npm test              # 单元 + Dry 全链路（Mock Seed + 真实渲染）
npm run test:live     # Live：四档还原度（85/90/95/99.99）× volcengine.com，真实 Seed 调用
npm run benchmark:live# 压测：1/2/4 并发，记录耗时/P95/成功率/还原度/轮次
```

## 目录

```
docs/            需求、OpenSpec、测试报告、验收文档
src/             constants/types/config/parser/extractor/seed/generator/renderer/fidelity/pipeline/orchestrator/reporter/mcp/cli
tests/           unit + dry
scripts/         test-live / benchmark-live
```

## 协议说明

- `max_loop=10`（单任务内部）与交付周期上限 10 均为系统内置规则，对用户不可见。
- 99.99% 目标受字体渲染、动态内容、抗锯齿等因素影响可能无法稳定达成；评分与验收不允许造假。
