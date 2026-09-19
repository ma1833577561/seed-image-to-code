# OpenSpec 03：接口设计（API）

## 1. SDK（src/index.ts）

```ts
// 单任务：设计资产 → 代码 + 质量报告
generateCode(options: GenerateOptions): Promise<GenerateResult>

// 交付周期编排：开发-测试-验收，最多 DELIVERY_MAX_CYCLES 周期
runDeliveryCycles<T>(hooks: DeliveryCycleHooks<T>): Promise<DeliveryCycleResult<T>>

// 主题色提取
extractTheme(asset: ParsedAsset, seed?: SeedClient): Promise<ColorToken[]>
```

### GenerateOptions

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| asset | Buffer \| { url: string } | 是 | 图片字节 或 URL |
| techStack | 'native-html' \| 'vue3' \| 'react-tsx' | 否 | 默认 native-html |
| targetFidelity | number | 否 | 85~100，默认 90 |
| customLoops | number | 否 | 高级模式手动指定（内部仍 ≤ SYSTEM_MAX_LOOPS） |
| viewport | { width, height } | 否 | 默认 1440×900 |
| projectConfig | object | 否 | IDE 内读取的现有项目规范（复杂仓库适配） |
| seed | SeedClient | 否 | 依赖注入，测试用 Mock |

### GenerateResult

| 字段 | 说明 |
|------|------|
| files | CodeFile[]（path + content） |
| report | QualityReport |
| sourceAsset | 原始资产信息 |

## 2. CLI（seed2code）

```bash
# 文件转代码
seed2code generate ./login.png --tech vue3 --fidelity 90 -o ./output
# URL 站点还原
seed2code generate https://www.volcengine.com/ --tech react-tsx --fidelity 85 -o ./output
# 启动 MCP Server（stdio）
seed2code mcp
```

## 3. MCP Server（src/mcp/mcpServer.ts）

- 传输：stdio（JSON-RPC 2.0）
- 工具：`design_to_code`
  - 参数：`asset_path`（必填，本地文件路径或 URL）、`tech_stack`（enum）、`fidelity`（85~100）、`custom_loops`（可选）
  - 返回：文件清单、综合还原度、质量报告摘要
- 适配：Harness TRAE / Claude Code / Cursor（MCP 标准协议）

## 4. 内部规则不暴露约束

- `SYSTEM_MAX_LOOPS` / `DELIVERY_MAX_CYCLES` 不出现在任何用户可见参数、帮助文本、界面文案中。
