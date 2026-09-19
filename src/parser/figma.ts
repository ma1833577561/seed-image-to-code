/**
 * Figma 输入处理
 * - IDE（TRAE / Claude Code / Cursor）内：由 Figma Dev Mode MCP 提供节点树与渲染图
 * - CLI / 独立场景：提取链接中的 fileKey 与 nodeId，给出降级指引（截图或 Dev Mode 导出）
 */

import type { ParsedAsset, AssetInput } from "../types.js";

const FIGMA_URL_RE = /figma\.com\/(?:file|design)\/([^/?#]+)(?:\/.*node-id=([^&?#]+))?/i;

export interface FigmaRef {
  fileKey: string;
  nodeId?: string;
}

export function parseFigmaUrl(url: string): FigmaRef | null {
  const m = url.match(FIGMA_URL_RE);
  if (!m) return null;
  return { fileKey: m[1] ?? "", nodeId: m[2] };
}

/**
 * 文档级说明：
 * 当通过 IDE 工具调用时，优先走 Figma Dev Mode MCP ——
 * 1) 拉取节点树 / 设计变量（填充 structure）
 * 2) 导出选中节点高清渲染图（填充 image）
 * 3) 将 design tokens 直接映射为目标技术栈主题令牌
 * 本函数在无 Dev Mode 环境下返回明确的降级指引。
 */
export async function parseFigma(
  input: Extract<AssetInput, { type: "figma" }>,
): Promise<ParsedAsset> {
  const ref = parseFigmaUrl(input.url);
  if (!ref) {
    throw new Error("无法识别的 Figma 链接（需 figma.com/file|design/ 格式）");
  }
  // 尝试注入的 Dev Mode 数据（由 MCP 适配层填充）
  const devMode = (globalThis as { __FIGMA_DEV_MODE__?: { image?: Buffer; nodes?: unknown } })
    .__FIGMA_DEV_MODE__;
  if (devMode?.image) {
    return {
      kind: "figma",
      source: input.url,
      image: devMode.image,
      mime: "image/png",
      width: 0,
      height: 0,
      structure: devMode.nodes,
      structureSummary: `Figma fileKey=${ref.fileKey} node=${ref.nodeId ?? "整页"}`,
    };
  }
  throw new Error(
    `Figma 链接解析成功（fileKey=${ref.fileKey}），但当前环境未连接 Figma Dev Mode MCP。请：` +
      `在 TRAE / Claude Code / Cursor 中通过 Dev Mode MCP 调用，或导出选中节点为 PNG 后使用图片输入。`,
  );
}
