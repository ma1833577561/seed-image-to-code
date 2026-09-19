---
name: seed-image-to-code
description: 基于 Seed-2.1-pro-0915（doubao-seed-evolving）多模态 Coding/VLM 能力的设计资产转前端代码 Skill。将设计图（PNG/JPEG/WebP/PSD/Figma）或站点 URL 自动还原为可运行的前端工程，包含主题色提取、多技术栈代码生成、渲染、双维还原度评分、迭代修正与质量报告。适用于 UI 稿转页面、站点还原、原型快速交付等场景。
---

# Seed Image To Code

把「设计资产」变成「可运行前端代码 + 质量报告」的完整闭环。

## 何时使用

- 用户提供 UI 设计图 / 截图 / PSD / Figma 链接 / 站点 URL，要求转成前端页面。
- 需要高保真还原（支持 85% ~ 99.99% 目标还原度）。
- 需要多技术栈输出（原生 HTML / Vue 3 / React 18）。

## 工作流程（Agent 执行）

1. **解析资产**：位图 → 尺寸+色板；PSD → 图层结构；URL → 无头浏览器截图（1440×900，触发懒加载）；Figma → Dev Mode MCP 或降级截图。
2. **提取主题色**：本地颜色聚类 + Seed VLM 语义分类 → 设计令牌。
3. **首轮生成**：结构化 Prompt + 设计图 → Seed 生成多文件代码（JSON）。
4. **渲染**：puppeteer-core 渲染入口 HTML 为 PNG。
5. **评分**：像素 diff（40%）+ Seed VLM 四维评分（60%，布局/色彩/排版/细节）。
6. **迭代**：未达标按问题清单修正，重复 4-5；提前终止条件：达标 / 代码无变化 / 问题清单无变化；内部上限 10 轮。
7. **交付**：多文件工程 + 质量报告（迭代记录、主题色板、问题清单）。

## 关键约束（必须遵守）

- **两层次数限制均对用户不可见**：单任务内部闭环 `SYSTEM_MAX_LOOPS=10`；开发-测试-验收周期 `DELIVERY_MAX_CYCLES=10`。不出现在 CLI 帮助、MCP 参数、界面文案中。
- 99.99% 目标不可通过修改评分公式 / 跳过像素校验 / 删除问题项造假。
- 不使用极限词、导流词，不拉踩竞品（征集活动内容规范）。
- 模型统一使用 `doubao-seed-evolving`（能力 = Seed-2.1-pro-0915）。

## 命令

```bash
npm run build                # 构建
npm test                     # 单元 + Dry 测试
npm run test:live            # 四档还原度 Live 测试（volcengine.com）
npm run benchmark:live       # 1/2/4 并发压测
npm run cli -- generate <file|url> [--tech native-html|vue3|react-tsx] [--fidelity 85~100] [-o out]
npm run mcp                  # MCP Server（stdio，供 TRAE / Claude Code / Cursor）
```

## 参考文档

- 需求：`docs/requirements.md`
- 规格：`docs/openSpec/`（01 总览 / 02 架构 / 03 接口 / 04 测试 / 05 验收 / 06 交付周期）
- 测试报告：`docs/test-report.md`
- 验收文档：`docs/acceptance.md`
