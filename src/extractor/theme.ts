/**
 * 主题色提取：本地颜色聚类 + Seed VLM 语义分类
 * 1) 采样像素 → 量化 → 统计高频色
 * 2) 传入 Seed 按 UI 语义分类（品牌/辅助/语义色/文本/背景/边框）
 * 3) 无密钥时降级为启发式分类
 */

import sharp from "sharp";
import type { ColorToken, ParsedAsset } from "../types.js";
import type { SeedClient } from "../seed/client.js";

const ROLE_ORDER: ColorToken["role"][] = [
  "brand",
  "accent",
  "success",
  "warning",
  "error",
  "text",
  "background",
  "border",
];

function hexOf(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")
  );
}

/** 本地聚类：采样最多 N 像素，按量化桶统计高频色 */
export async function extractDominantColors(
  image: Buffer,
  opts?: { sample?: number; buckets?: number; top?: number },
): Promise<Array<{ hex: string; ratio: number; r: number; g: number; b: number }>> {
  const sample = opts?.sample ?? 40_000;
  const buckets = opts?.buckets ?? 16; // 每通道量化 16 级（4096 桶）
  const top = opts?.top ?? 20;

  const { data, info } = await sharp(image)
    .resize({ width: 200, height: 200, fit: "inside" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  const step = Math.max(1, Math.floor(data.length / channels / sample));
  const counts = new Map<number, number>();
  const centers = new Map<number, { r: number; g: number; b: number }>();
  let total = 0;

  for (let i = 0; i < data.length; i += channels * step) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    // 过滤近黑/近白噪声
    if (r + g + b < 15 || (r > 245 && g > 245 && b > 245)) continue;
    const key = (r >> (8 - Math.log2(buckets))) * buckets * buckets +
      (g >> (8 - Math.log2(buckets))) * buckets +
      (b >> (8 - Math.log2(buckets)));
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (!centers.has(key)) centers.set(key, { r, g, b });
    total++;
  }
  if (total === 0) return [{ hex: "#FFFFFF", ratio: 1, r: 255, g: 255, b: 255 }];

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([key, count]) => {
      const c = centers.get(key)!;
      return { hex: hexOf(c.r, c.g, c.b), ratio: count / total, ...c };
    });
}

function heuristicRole(hex: string, ratio: number, index: number, total: number): ColorToken {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  let role: ColorToken["role"];
  if (luminance > 225) role = "background";
  else if (luminance < 60) role = "text";
  else if (g > 150 && r < 120 && b < 120) role = "success";
  else if (r > 200 && g > 120 && b < 80) role = "warning";
  else if (r > 180 && g < 90 && b < 90) role = "error";
  else if (index === 0 || ratio > 0.25) role = "brand";
  else if (index < 3) role = "accent";
  else role = "border";
  return { name: role, value: hex, role, ratio, hex };
}

export async function extractTheme(
  asset: Pick<ParsedAsset, "image">,
  seed?: SeedClient,
): Promise<ColorToken[]> {
  const dominant = await extractDominantColors(asset.image);
  if (!seed) {
    return dominant.slice(0, 8).map((c, i) => heuristicRole(c.hex, c.ratio, i, dominant.length));
  }
  // Seed VLM 语义分类（JSON 模式）
  const prompt = `你是 UI 设计系统专家。以下是页面主色列表（hex 与占比），请按 UI 语义分类为：
brand(品牌主色) / accent(辅助色) / success / warning / error / text / background / border。
规则：同色系只保留占比最高的一个；缺失类别可为空；输出 JSON：{"tokens":[{"hex":"#..","role":"..","name":".."}]}，最多 10 项。
主色列表：${JSON.stringify(dominant.slice(0, 15))}`;
  const raw = await seed.chatWithImages({ role: "user", text: prompt, images: [] }, true);
  let parsed: { tokens?: Array<{ hex: string; role: string; name?: string }> };
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { tokens: [] };
  }
  if (!Array.isArray(parsed.tokens) || parsed.tokens.length === 0) {
    return dominant.slice(0, 8).map((c, i) => heuristicRole(c.hex, c.ratio, i, dominant.length));
  }
  const tokens: ColorToken[] = parsed.tokens
    .filter((t) => ROLE_ORDER.includes(t.role as ColorToken["role"]))
    .map((t) => {
      const found = dominant.find((d) => d.hex.toLowerCase() === t.hex.toLowerCase());
      return {
        name: t.name ?? t.role,
        value: t.hex,
        role: t.role as ColorToken["role"],
        ratio: found?.ratio ?? 0,
        hex: t.hex,
      };
    });
  // 按语义角色稳定排序，缺失角色补位
  tokens.sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));
  return tokens.slice(0, 10);
}
