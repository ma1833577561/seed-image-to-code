/**
 * 像素 diff：pixelmatch 对比两张 PNG
 * 先等比缩放至相同尺寸，返回差异率与得分。
 */

import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { resizeTo } from "../parser/image.js";

export interface PixelDiffResult {
  diffRatio: number;
  score: number; // 100 - diffRatio*100
  width: number;
  height: number;
}

export async function pixelDiff(a: Buffer, b: Buffer, width: number, height: number): Promise<PixelDiffResult> {
  const [pa, pb] = await Promise.all([resizeTo(a, width, height), resizeTo(b, width, height)]);
  const imgA = PNG.sync.read(pa);
  const imgB = PNG.sync.read(pb);
  const diff = new PNG({ width, height });
  const mismatched = pixelmatch(imgA.data, imgB.data, diff.data, width, height, {
    threshold: 0.1,
    includeAA: false,
  });
  const diffRatio = mismatched / (width * height);
  return {
    diffRatio,
    score: Math.max(0, Math.min(100, 100 - diffRatio * 100)),
    width,
    height,
  };
}
