/**
 * 开发-测试-验收周期编排器
 * 外层交付流程最多 DELIVERY_MAX_CYCLES（=10）周期；达标即 completed，否则 waiting_user。
 */

import { DELIVERY_MAX_CYCLES } from "../constants.js";
import type {
  DeliveryCycleRecord,
  DeliveryCycleResult,
  StageOutcome,
} from "../types.js";

export interface DeliveryCycleHooks<T> {
  /** 开发阶段：首次周期完成开发，后续周期按上轮问题修复 */
  develop: (cycle: number) => Promise<StageOutcome>;
  /** 测试阶段：单元 / Dry / Live / 压测 */
  test: (cycle: number) => Promise<StageOutcome>;
  /** 验收阶段：按目标还原度判定，返回结果与可选产物 */
  accept: (cycle: number) => Promise<{ outcome: StageOutcome; result?: T }>;
}

function skippedStage(reason: string): StageOutcome {
  return { status: "skipped", summary: reason };
}

function blockedStage(reason: string): StageOutcome {
  return { status: "blocked", summary: reason };
}

function toStageOutcome(error: unknown): StageOutcome {
  return {
    status: "failed",
    summary: error instanceof Error ? error.message : "阶段执行失败",
    error: error instanceof Error ? error.stack ?? error.message : String(error),
  };
}

export async function runDeliveryCycles<T>(
  hooks: DeliveryCycleHooks<T>,
  maxCycles: number = DELIVERY_MAX_CYCLES,
): Promise<DeliveryCycleResult<T>> {
  const cycles: DeliveryCycleRecord[] = [];

  for (let cycle = 1; cycle <= maxCycles; cycle++) {
    const startedAt = new Date();
    let develop: StageOutcome;
    let test: StageOutcome;
    let acceptance: StageOutcome;
    let finalResult: T | undefined;

    try {
      develop = await hooks.develop(cycle);
    } catch (error) {
      develop = toStageOutcome(error);
    }

    if (develop.status !== "passed") {
      test = blockedStage("开发阶段未通过，本周期测试/验收被阻断");
      acceptance = blockedStage("开发阶段未通过，本周期验收被阻断");
    } else {
      try {
        test = await hooks.test(cycle);
      } catch (error) {
        test = toStageOutcome(error);
      }
      if (test.status !== "passed") {
        acceptance = blockedStage("测试阶段未通过，本周期验收被阻断");
      } else {
        try {
          const accepted = await hooks.accept(cycle);
          acceptance = accepted.outcome;
          finalResult = accepted.result;
        } catch (error) {
          acceptance = toStageOutcome(error);
        }
      }
    }

    const record: DeliveryCycleRecord = {
      cycle,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      develop,
      test,
      acceptance,
      passed:
        develop.status === "passed" &&
        test.status === "passed" &&
        acceptance.status === "passed",
    };
    cycles.push(record);

    if (record.passed) {
      return {
        status: "completed",
        cycles,
        finalResult,
        stopReason: "target-accepted",
      };
    }
  }

  return {
    status: "waiting_user",
    cycles,
    stopReason: "delivery-cycle-limit-reached",
  };
}
