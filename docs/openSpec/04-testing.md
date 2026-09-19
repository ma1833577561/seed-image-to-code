# OpenSpec 04：测试设计（Testing）

## 1. 测试分层

| 层级 | 范围 | 工具 | 环境 |
|------|------|------|------|
| 单元测试 | constants / theme / fidelity / deliveryCycle | vitest | 纯内存，Mock Seed |
| Dry 测试 | pipeline 全链路（Mock Seed + 真实渲染） | vitest | 无外部调用 |
| Live 测试 | pipeline 真实调用 Seed + 真实渲染 | tsx scripts/test-live.ts | 需要 ARK_API_KEY |
| 压测 | 并发 1/2/4，从架构多方向观测 | tsx scripts/benchmark-live.ts | 需要 ARK_API_KEY |

## 2. 四档还原度测试用例（Live）

| 档位 | 技术栈 | 期望内部轮次 | 验收阈值 |
|------|--------|--------------|----------|
| 85% | 原生 HTML | 1 | ≥85 |
| 90% | React | 2 | ≥90 |
| 95% | Vue3 | 3 | ≥95 |
| 99.99% | React | ≤10（顶格） | ≥99.99 |

目标页面：https://www.volcengine.com/

## 3. 压测设计（多方向）

- **并发维度**：1 / 2 / 4 并发执行同一任务，记录平均耗时、P95、成功率。
- **架构维度**：大图输入（站点首屏截图）、多文件产物（跨文件生成）、多轮迭代（问题清单驱动）、长任务（99.99% 顶格轮次）。
- **稳定性维度**：连续同任务，观察还原度方差与失败率。

## 4. 证据要求

- 每次 Live 运行保存：输入截图、渲染截图、评分 JSON、问题清单、耗时与 Token（可用时）。
- 测试报告只写真实运行结果，禁止虚构。

## 5. 环境前提

- ARK_API_KEY 必填（未配置时 Live/压测标记 blocked，遵循交付周期协议置 waiting_user）。
