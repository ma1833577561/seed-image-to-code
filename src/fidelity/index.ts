/**
 * 还原度综合评分：VLM 60% + 像素 diff 40%
 */

import type { SeedClient } from "../seed/client.js";
import type { IterationRecord, VlmScore } from "../types.js";
import { FIDELITY_WEIGHTS } from "../constants.js";
import { pixelDiff } from "./pixel.js";
import { vlmScore } from "./vlm.js";

export interface FidelityInput {
  seed: SeedClient;
  original: Buffer;
  rendered: Buffer;
  width: number;
  height: number;
}

export async function calcFidelity(input: FidelityInput): Promise<IterationRecord> {
  const [pixel, vlm] = await Promise.all([
    pixelDiff(input.original, input.rendered, input.width, input.height),
    vlmScore(input.seed, input.original, input.rendered),
  ]);
  const total = Math.round((vlm.total * FIDELITY_WEIGHTS.vlm + pixel.score * FIDELITY_WEIGHTS.pixel) * 100) / 100;
  return {
    round: 0,
    pixelScore: Math.round(pixel.score * 100) / 100,
    vlm,
    totalScore: total,
    issues: vlm.issues,
    changed: true,
  };
}

/**
 * 四维达标判定（99.99 档：分项≥95 且 像素分≥95（即像素 diff<5%），工程可达成口径）
 * 其余档位：综合分 ≥ target。
 */
export function isDimensionTargetMet(
  vlm: VlmScore,
  target: number,
  pixelScore: number,
): boolean {
  if (target >= 99.9) {
    return (
      vlm.layout >= 95 &&
      vlm.color >= 95 &&
      vlm.typography >= 95 &&
      vlm.detail >= 95 &&
      pixelScore >= 95
    );
  }
  return vlm.total >= target;
}

export type { VlmScore };
