/**
 * PSD 解析（依赖 ag-psd）
 * - 读取图层结构（名称/位置/尺寸）
 * - 合成预览图需要 node-canvas 原生依赖；失败时提示用户导出 PNG，不阻塞核心图片流程。
 */

import type { ParsedAsset, AssetInput } from "../types.js";

interface PsdLayerInfo {
  name: string;
  kind: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export async function parsePsd(input: Extract<AssetInput, { type: "file" }>): Promise<ParsedAsset> {
  let mod: typeof import("ag-psd");
  try {
    mod = await import("ag-psd");
  } catch {
    throw new Error(
      "PSD 解析依赖 ag-psd 未安装：请执行 npm install ag-psd，或将 PSD 导出为 PNG/JPEG 后使用",
    );
  }

  const psd = mod.readPsd(input.buffer, { skipThumbnail: true });
  const width = psd.width;
  const height = psd.height;

  let image: Buffer;
  try {
    // 预览合成依赖 node-canvas（可选依赖，动态引入避免编译期强依赖）
    const canvasModule = "canvas";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const canvasLib: any = await import(canvasModule);
    mod.initializeCanvas((w: number, h: number) => new canvasLib.Canvas(w, h));
    mod.decodeLayerPixels(psd);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cvs = (psd as any).canvas as { toBuffer: (fmt: string) => Buffer } | undefined;
    if (!cvs) throw new Error("canvas 为空");
    image = Buffer.from(cvs.toBuffer("image/png"));
  } catch {
    throw new Error(
      "PSD 预览图合成需要 node-canvas 原生依赖：请执行 npm install canvas，或将 PSD 导出为 PNG/JPEG 后使用",
    );
  }

  const rawLayers = (psd.children ?? []) as unknown[];
  const layers: PsdLayerInfo[] = rawLayers.map((l) => {
    const rec = l as Record<string, unknown>;
    return {
      name: String(rec.name ?? "layer"),
      kind: String(rec.kind ?? "layer"),
      left: Number(rec.left ?? 0),
      top: Number(rec.top ?? 0),
      right: Number(rec.right ?? 0),
      bottom: Number(rec.bottom ?? 0),
    };
  });

  return {
    kind: "psd",
    source: input.filename,
    image,
    mime: "image/png",
    width,
    height,
    structure: { layers },
    structureSummary: `PSD ${width}×${height}，图层 ${layers.length} 个`,
  };
}
