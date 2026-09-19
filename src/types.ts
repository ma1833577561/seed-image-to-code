/** 全局类型定义 */

import type { TECH_STACKS } from "./constants.js";

export type TechStack = (typeof TECH_STACKS)[number];

export interface Viewport {
  width: number;
  height: number;
}

/** 设计资产来源 */
export type AssetInput =
  | { type: "file"; buffer: Buffer; filename: string }
  | { type: "url"; url: string }
  | { type: "figma"; url: string };

/** 解析后的统一资产 */
export interface ParsedAsset {
  kind: "bitmap" | "psd" | "figma" | "url";
  source: string;
  /** 渲染用预览图（bitmap 直接为原图；psd/figma/url 为合成/截图） */
  image: Buffer;
  mime: string;
  width: number;
  height: number;
  /** 结构化信息（psd 图层 / figma 节点 / url 标题与元信息），可为空 */
  structure?: unknown;
  structureSummary?: string;
}

/** 主题色令牌 */
export interface ColorToken {
  name: string;
  value: string;
  role: "brand" | "accent" | "success" | "warning" | "error" | "text" | "background" | "border";
  /** 该色在图片中的占比（0~1） */
  ratio: number;
  hex: string;
}

/** 生成的代码文件 */
export interface CodeFile {
  path: string;
  content: string;
}

/** 单任务生成选项 */
export interface GenerateOptions {
  asset: AssetInput;
  techStack?: TechStack;
  targetFidelity?: number;
  /** 高级模式手动指定轮次（内部仍受 SYSTEM_MAX_LOOPS 约束），用户界面不展示 */
  customLoops?: number;
  viewport?: Viewport;
  /** IDE 内读取的现有项目规范 */
  projectConfig?: unknown;
}

/** VLM 四维评分 */
export interface VlmScore {
  layout: number;
  color: number;
  typography: number;
  detail: number;
  total: number;
  issues: string[];
}

/** 一轮迭代记录 */
export interface IterationRecord {
  round: number;
  pixelScore: number;
  vlm: VlmScore;
  totalScore: number;
  issues: string[];
  changed: boolean;
  skipped?: boolean;
}

/** 质量报告 */
export interface QualityReport {
  targetFidelity: number;
  finalScore: number;
  iterations: IterationRecord[];
  colorPalette: ColorToken[];
  dimensions: { width: number; height: number };
  techStack: TechStack;
  tokenHint?: { outputTokens?: number; toolCalls?: number };
  files: string[];
  summary: string[];
}

/** 单任务结果 */
export interface GenerateResult {
  files: CodeFile[];
  report: QualityReport;
  sourceAsset: ParsedAsset;
  entry: string;
}

/* ---------- 交付周期（开发-测试-验收）类型 ---------- */

export type DeliveryStage = "develop" | "test" | "acceptance";

export type DeliveryCycleStatus = "completed" | "waiting_user" | "failed";

export type StageStatus = "passed" | "failed" | "skipped" | "blocked";

export interface StageOutcome {
  status: StageStatus;
  summary: string;
  evidence?: string[];
  error?: string;
}

export interface DeliveryCycleRecord {
  cycle: number;
  startedAt: string;
  finishedAt: string;
  develop: StageOutcome;
  test: StageOutcome;
  acceptance: StageOutcome;
  passed: boolean;
}

export interface DeliveryCycleResult<T> {
  status: DeliveryCycleStatus;
  cycles: DeliveryCycleRecord[];
  finalResult?: T;
  stopReason: "target-accepted" | "delivery-cycle-limit-reached" | "stage-exception";
}
