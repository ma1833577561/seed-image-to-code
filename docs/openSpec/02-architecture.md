# OpenSpec 02：架构设计（Architecture）

## 1. 分层流水线

```
输入层 → 资产解析层 → 信息提取层 → 代码生成层 → 渲染层 → 还原度评分层 → 修正层 → 产物输出层
```

| 层 | 模块 | 职责 |
|----|------|------|
| 输入层 | cli / mcp | 接收文件路径、URL、IDE 工具参数 |
| 资产解析层 | parser/ | image / psd / url / figma → 统一 ParsedAsset（base64、尺寸、结构） |
| 信息提取层 | extractor/ | 本地聚类主题色 + Seed 语义分类 → ColorToken[] |
| 代码生成层 | generator/ | Prompt 工程 → Seed 多模态生成多文件代码（JSON） |
| 渲染层 | renderer/ | puppeteer-core 渲染入口 HTML → PNG 截图 |
| 评分层 | fidelity/ | pixelmatch 像素 diff（40%）+ Seed VLM 四维评分（60%） |
| 修正层 | generator/fix | 依据问题清单迭代修正（≤ SYSTEM_MAX_LOOPS=10） |
| 输出层 | reporter/ | 质量报告（Markdown/JSON）、产物落盘 |

## 2. 目录结构

```
seed-image-to-code/
├── docs/                     # 需求 / openSpec / 测试报告 / 验收
├── src/
│   ├── constants.ts          # 两层次数限制等常量
│   ├── types.ts              # 全局类型
│   ├── config.ts             # env 加载
│   ├── parser/               # image.ts psd.ts url.ts figma.ts index.ts
│   ├── extractor/theme.ts    # 主题色提取
│   ├── seed/client.ts        # Ark 客户端 + Mock 客户端
│   ├── generator/prompt.ts generator.ts
│   ├── renderer/renderer.ts  # 无头渲染
│   ├── fidelity/pixel.ts vlm.ts index.ts
│   ├── pipeline/index.ts     # 单任务闭环（loop ≤ 10）
│   ├── orchestrator/deliveryCycle.ts  # 交付周期（cycle ≤ 10）
│   ├── reporter/report.ts    # 质量报告
│   ├── mcp/mcpServer.ts      # stdio JSON-RPC MCP Server
│   ├── cli/index.ts          # 命令行
│   └── index.ts              # SDK 导出
├── tests/                    # unit / dry
├── scripts/                  # test-live.ts benchmark-live.ts
└── docs/test-report.md docs/acceptance.md
```

## 3. 关键设计决策

1. **本地预解析降耗**：图像尺寸、主色聚类、图层结构在本地完成，只把「必要的视觉信息 + 结构化摘要」传给 Seed，减少图像 Token 消耗。
2. **双维评分**：像素 diff（客观）与 VLM 语义（结构/色彩/排版/细节）加权，避免字体渲染差异被误判。
3. **达标即停**：达到目标分 / 代码无变化 / 问题清单无变化立即终止，配合 Seed 自身 Token 优化降低综合成本。
4. **两层次数隔离**：`pipeline` 控制单任务内部修正（≤10）；`orchestrator` 控制开发-测试-验收交付周期（≤10），两者互不暴露。
5. **可直接运行的产物**：Vue/React 生成内联单文件 HTML（CDN 引入），无需构建即可渲染验收。

## 4. 依赖图

```
cli / mcp → pipeline → generator → seed/client
                    → renderer → fidelity → seed/client
                    → reporter
orchestrator → pipeline（作为 develop/test/accept 三阶段钩子）
```
