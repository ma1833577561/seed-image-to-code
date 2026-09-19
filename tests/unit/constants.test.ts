import { describe, expect, it } from "vitest";
import {
  DELIVERY_MAX_CYCLES,
  FIDELITY_LOOP_MAP,
  MIN_FIDELITY,
  MAX_FIDELITY,
  SYSTEM_MAX_LOOPS,
} from "../../src/constants.js";
import { loopsByFidelity } from "../../src/pipeline/index.js";

describe("两层次数限制（内部，用户不可见）", () => {
  it("单任务内部闭环上限为 10", () => {
    expect(SYSTEM_MAX_LOOPS).toBe(10);
  });
  it("开发-测试-验收周期上限为 10", () => {
    expect(DELIVERY_MAX_CYCLES).toBe(10);
  });
});

describe("还原度-轮次映射", () => {
  it("85% → 1 轮", () => {
    expect(loopsByFidelity(85)).toBe(1);
  });
  it("90% → 2 轮", () => {
    expect(loopsByFidelity(90)).toBe(2);
  });
  it("95% → 3 轮", () => {
    expect(loopsByFidelity(95)).toBe(3);
  });
  it("99.99% → 顶格 10 轮", () => {
    expect(loopsByFidelity(99.99)).toBe(SYSTEM_MAX_LOOPS);
  });
  it("越界值被夹取到合法区间", () => {
    expect(loopsByFidelity(50)).toBe(1);
    expect(loopsByFidelity(200)).toBe(SYSTEM_MAX_LOOPS);
  });
  it("FIDELITY_LOOP_MAP 覆盖全部档位", () => {
    expect(FIDELITY_LOOP_MAP[0]?.min).toBe(99.9);
    expect(MIN_FIDELITY).toBe(85);
    expect(MAX_FIDELITY).toBe(100);
  });
});
