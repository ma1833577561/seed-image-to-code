/**
 * Seed VLM 四维评分（布局/色彩/排版/细节）
 * 权重：layout 30% / color 25% / typography 25% / detail 20%
 */

import type { SeedClient } from "../seed/client.js";
import type { VlmScore } from "../types.js";
import { VLM_DIMENSION_WEIGHTS } from "../constants.js";
import { buildScorePrompt } from "../generator/prompt.js";
import { toDataUrl } from "../generator/generator.js";

export async function vlmScore(
  seed: SeedClient,
  original: Buffer,
  rendered: Buffer,
): Promise<VlmScore> {
  const raw = await seed.chatWithImages(
    {
      role: "user",
      text: buildScorePrompt(),
      images: [toDataUrl(original), toDataUrl(rendered)],
    },
    true,
  );
  let parsed: { layout?: number; color?: number; typography?: number; detail?: number; issues?: string[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }
  const clamp = (v: unknown) => Math.max(0, Math.min(100, Number(v) || 0));
  const layout = clamp(parsed.layout);
  const color = clamp(parsed.color);
  const typography = clamp(parsed.typography);
  const detail = clamp(parsed.detail);
  const total =
    layout * VLM_DIMENSION_WEIGHTS.layout +
    color * VLM_DIMENSION_WEIGHTS.color +
    typography * VLM_DIMENSION_WEIGHTS.typography +
    detail * VLM_DIMENSION_WEIGHTS.detail;
  return {
    layout,
    color,
    typography,
    detail,
    total: Math.round(total * 100) / 100,
    issues: Array.isArray(parsed.issues) ? parsed.issues.slice(0, 12).map(String) : [],
  };
}
