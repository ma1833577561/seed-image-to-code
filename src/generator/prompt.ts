/**
 * Prompt 工程：首轮生成与迭代修正的统一规范
 * 通过结构化提示最大化 Seed-2.1-pro-0915 能力、降低 Token 消耗。
 */

import type { ColorToken, TechStack, Viewport } from "../types.js";

export interface GenerationContext {
  techStack: TechStack;
  viewport: Viewport;
  colorTokens: ColorToken[];
  structureSummary?: string;
  projectConfig?: unknown;
}

const TECH_STACK_INSTRUCTIONS: Record<TechStack, string> = {
  "native-html":
    "技术栈：原生 HTML + CSS + Vanilla JS。输出 index.html（内联 style 与 script），语义化类名，优先 Flex/Grid 布局，禁止大面积绝对定位。",
  vue3:
    "技术栈：Vue 3（CDN 引入），输出单文件 index.html（内联 <script type=\"module\"> 创建 Vue app，template 使用 HTML 模板）。组件化拆分子组件，主题色注入 CSS 变量。",
  "react-tsx":
    "技术栈：React 18（CDN 引入）TSX 风格，输出单文件 index.html（内联 <script type=\"text/babel\"> 或 esm 引入 babel standalone），函数组件 + hooks。主题色注入 CSS 变量。",
};

export function buildFirstPrompt(ctx: GenerationContext): string {
  return `你是资深前端开发工程师。请根据提供的 UI 设计图生成可直接在浏览器运行的代码。
${TECH_STACK_INSTRUCTIONS[ctx.techStack]}
### 预解析设计信息
- 画布尺寸：${ctx.viewport.width} × ${ctx.viewport.height}
- 主题色板（已提取）：
${JSON.stringify(ctx.colorTokens, null, 2)}
${ctx.structureSummary ? `- 结构化摘要：${ctx.structureSummary}` : ""}
${ctx.projectConfig ? `- 现有项目规范：${JSON.stringify(ctx.projectConfig)}` : ""}
### 严格遵循
1. 文本、图标、布局、配色与设计图完全对齐；优先还原可见元素，不虚构额外内容。
2. **只还原截图可见的首屏内容**（导航、Hero 主视觉、主要区块），忽略轮播/动态/懒加载内容与截图外区域。
3. 主题色注入为 CSS 变量（:root），Tailwind 类名仅作辅助。
4. 补充基础 hover/active 交互与合理默认态；代码无冗余样式，符合工业界最佳实践；代码量控制在 600-1200 行内。
5. 仅返回 JSON，不要额外解释：{"files":[{"path":"相对路径","content":"文件内容"}],"entry":"index.html"}`;
}

export function buildFixPrompt(ctx: GenerationContext, issues: string[]): string {
  return `你是资深前端开发工程师。上一版代码渲染后与原始设计图存在偏差，请根据问题清单修正代码。
${TECH_STACK_INSTRUCTIONS[ctx.techStack]}
### 本次待修正问题（逐条落实，不要遗漏）
${issues.map((i, idx) => `${idx + 1}. ${i}`).join("\n")}
### 约束
1. 只修改与问题相关的部分，保持其他代码不变；保持单文件可运行。
2. 若问题已在上版解决，明确说明，不要重复修改。
3. 仅返回 JSON：{"files":[{"path":"相对路径","content":"文件内容"}],"entry":"index.html"}`;
}

export function buildScorePrompt(): string {
  return `对比两张图：第一张为原始设计稿，第二张为代码渲染截图。
请从四个维度打分（0-100），并列出具体可落地的修正问题（标注位置与预期效果）。
维度：layout（布局结构：元素位置/层级/间距）｜color（色彩：主色/渐变/阴影/透明度）｜typography（排版：字号/字重/行高/文本）｜detail（细节组件：圆角/边框/图标/交互态）。
仅返回 JSON：{"layout":number,"color":number,"typography":number,"detail":number,"issues":string[]}`;
}
