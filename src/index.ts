/**
 * SDK 入口
 */

export { SYSTEM_MAX_LOOPS, DELIVERY_MAX_CYCLES, FIDELITY_LOOP_MAP } from "./constants.js";
export { ImageToCodePipeline, loopsByFidelity, normalizeTargetFidelity } from "./pipeline/index.js";
export { runDeliveryCycles, type DeliveryCycleHooks } from "./orchestrator/deliveryCycle.js";
export { extractTheme, extractDominantColors } from "./extractor/theme.js";
export { parseAsset } from "./parser/index.js";
export { ArkClient, MockClient, type SeedClient } from "./seed/client.js";
export { calcFidelity, isDimensionTargetMet } from "./fidelity/index.js";
export { pixelDiff } from "./fidelity/pixel.js";
export { vlmScore } from "./fidelity/vlm.js";
export { renderFilesToScreenshot } from "./renderer/renderer.js";
export { buildReportMarkdown, writeOutputFiles } from "./reporter/report.js";

export type {
  AssetInput,
  ParsedAsset,
  ColorToken,
  CodeFile,
  GenerateOptions,
  GenerateResult,
  IterationRecord,
  QualityReport,
  TechStack,
  VlmScore,
  DeliveryCycleRecord,
  DeliveryCycleResult,
  DeliveryStage,
  DeliveryCycleStatus,
  StageOutcome,
} from "./types.js";
