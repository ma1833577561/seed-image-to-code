import { describe, expect, it } from "vitest";
import { DELIVERY_MAX_CYCLES } from "../../src/constants.js";
import { runDeliveryCycles, type DeliveryCycleHooks, type StageOutcome } from "../../src/index.js";

function passed(summary: string): StageOutcome {
  return { status: "passed", summary };
}
function failed(summary: string): StageOutcome {
  return { status: "failed", summary };
}

describe("开发-测试-验收周期控制", () => {
  it("第 1 个周期验收通过 → completed", async () => {
    const hooks: DeliveryCycleHooks<{ score: number }> = {
      develop: async () => passed("开发完成"),
      test: async () => passed("测试通过"),
      accept: async () => ({ outcome: passed("99.99% 验收通过"), result: { score: 99.99 } }),
    };
    const result = await runDeliveryCycles(hooks);
    expect(result.status).toBe("completed");
    expect(result.stopReason).toBe("target-accepted");
    expect(result.cycles).toHaveLength(1);
    expect(result.finalResult?.score).toBe(99.99);
  });

  it("第 3 个周期验收通过 → completed，cycles=3", async () => {
    let accepted = false;
    const hooks: DeliveryCycleHooks<{ score: number }> = {
      develop: async (c) => passed(`第 ${c} 周期开发完成`),
      test: async (c) => passed(`第 ${c} 周期测试通过`),
      accept: async (c) => {
        if (c === 3) accepted = true;
        return { outcome: accepted ? passed("验收通过") : failed("还原度未达标"), result: { score: accepted ? 99.99 : 98.2 } };
      },
    };
    const result = await runDeliveryCycles(hooks);
    expect(result.status).toBe("completed");
    expect(result.cycles).toHaveLength(3);
  });

  it("10 个周期均未通过 → waiting_user", async () => {
    const hooks: DeliveryCycleHooks<unknown> = {
      develop: async () => passed("开发完成"),
      test: async () => passed("测试通过"),
      accept: async () => ({ outcome: failed("还原度仍低于 99.99%") }),
    };
    const result = await runDeliveryCycles(hooks);
    expect(result.status).toBe("waiting_user");
    expect(result.stopReason).toBe("delivery-cycle-limit-reached");
    expect(result.cycles).toHaveLength(DELIVERY_MAX_CYCLES);
  });

  it("开发失败 → 测试/验收 blocked", async () => {
    const hooks: DeliveryCycleHooks<unknown> = {
      develop: async () => failed("构建失败"),
      test: async () => passed("不应执行"),
      accept: async () => ({ outcome: passed("不应执行") }),
    };
    const result = await runDeliveryCycles(hooks);
    const last = result.cycles.at(-1)!;
    expect(last.test.status).toBe("blocked");
    expect(last.acceptance.status).toBe("blocked");
  });

  it("测试失败 → 验收 blocked", async () => {
    const hooks: DeliveryCycleHooks<unknown> = {
      develop: async () => passed("开发完成"),
      test: async () => failed("Live 测试失败"),
      accept: async () => ({ outcome: passed("不应执行") }),
    };
    const result = await runDeliveryCycles(hooks);
    const last = result.cycles.at(-1)!;
    expect(last.acceptance.status).toBe("blocked");
  });

  it("阶段抛异常 → 记录为 failed，不无限循环", async () => {
    const hooks: DeliveryCycleHooks<unknown> = {
      develop: async () => {
        throw new Error("阶段异常");
      },
      test: async () => passed("不应执行"),
      accept: async () => ({ outcome: passed("不应执行") }),
    };
    const result = await runDeliveryCycles(hooks);
    expect(result.cycles.length).toBeLessThanOrEqual(DELIVERY_MAX_CYCLES);
    expect(result.cycles[0]!.develop.status).toBe("failed");
    expect(result.cycles[0]!.develop.error).toContain("阶段异常");
  });
});
