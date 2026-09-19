/**
 * 全局常量
 * 注意：SYSTEM_MAX_LOOPS / DELIVERY_MAX_CYCLES 为内部限制，不得暴露给终端用户。
 */

/** 单任务内部「生成→渲染→评分→修正」最大闭环次数（用户不可见） */
export const SYSTEM_MAX_LOOPS = 10;

/** 开发-测试-验收最大交付周期（用户不可见） */
export const DELIVERY_MAX_CYCLES = 10;

/** 火山方舟 OpenAI 兼容端点 */
export const ARK_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";

/** 模型：Seed-Evolving（与 Seed-2.1-pro-0915 能力一致） */
export const ARK_MODEL = "doubao-seed-evolving";

/** 默认视口 */
export const DEFAULT_VIEWPORT = { width: 1440, height: 900 } as const;

/** 还原度-内部轮次映射（目标还原度 → 默认内部迭代轮次） */
export const FIDELITY_LOOP_MAP: ReadonlyArray<{ min: number; loops: number; label: string }> = [
  { min: 99.9, loops: SYSTEM_MAX_LOOPS, label: "极限复刻" },
  { min: 95, loops: 3, label: "高保真" },
  { min: 90, loops: 2, label: "标准" },
  { min: 85, loops: 1, label: "基础" },
];

/** 最小/最大目标还原度 */
export const MIN_FIDELITY = 85;
export const MAX_FIDELITY = 100;

/** VLM 评分分项权重 */
export const VLM_DIMENSION_WEIGHTS = {
  layout: 0.3,
  color: 0.25,
  typography: 0.25,
  detail: 0.2,
} as const;

/** 综合分权重 */
export const FIDELITY_WEIGHTS = { vlm: 0.6, pixel: 0.4 } as const;

/** 支持的技术栈 */
export const TECH_STACKS = ["native-html", "vue3", "react-tsx"] as const;

/** 支持图片 MIME */
export const SUPPORTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
