# Agent 工作指令

本文件是各 Agent 共用工作指令的唯一维护源。Claude Code 通过 `CLAUDE.md` 中的 `@AGENTS.md` 导入；使用说明见 [README.md](README.md)，详细开发规范见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 开始工作前

本仓库在构建时合并公共配置与客户端差异，生成 Mihomo 和 Stash 模板，再由 Sub-Store 注入节点并覆写为完整配置。

- 修改配置、脚本或规则前，先阅读贡献指南的[修改位置](CONTRIBUTING.md#修改位置)、[配置与合并](CONTRIBUTING.md#配置与合并)和[规则与节点筛选](CONTRIBUTING.md#规则与节点筛选)。
- `src/configs/` 维护配置源，`src/scripts/` 维护运行期脚本，公共依赖集中在 `src/scripts/shared/`，`tools/` 维护构建编排与专用合并逻辑；按[脚本开发](CONTRIBUTING.md#脚本开发)构建并检查 `dist/` 发布产物。
- 修改接入方式或脚本参数时，阅读 README 中对应的[接入 Sub-Store](README.md#接入-sub-store)、[节点中转](README.md#节点中转)或[节点重命名](README.md#节点重命名)，同步更新使用说明。
- 修改远程资源地址时，遵循[资源链接约定](CONTRIBUTING.md#资源链接)。

## 关键约束

- 共同代理组、候选顺序、筛选和测速参数只在 `src/configs/base.yaml` 维护。两端代理组仅允许 oixCloud provider、Optimized 组及相关引用存在差异。
- 三份 YAML 独立解析，保留 `$base` / `$profile` 标记，不使用跨文件锚点，不在配置源定义顶层 `proxies`。
- 保留规则的匹配优先级和候选顺序；修改组名、规则集名或文件位置时，同步检查引用。
- 构建模板保留成员生成和运行时 provider 声明；Sub-Store 按远程模板、节点注入、`config-overwrite.js` 的顺序处理，不再运行合并脚本。`dialer-proxy.js` 与 `rename.js` 在来源订阅中分别通过 `operator` 处理节点，自建节点仅设置中转并保留原名。
- 节点筛选的具体限制以贡献指南为准；验证时检查注入节点并覆写后的最终分组。

## 验证与交付

- 配置或脚本变更按[本地验证](CONTRIBUTING.md#本地验证)运行相关检查，并确认两个客户端的结果。
- 纯文档变更检查链接、章节引用和示例与实现是否一致。
- 交付时说明修改内容、验证结果及尚未完成的事项。
- 用户仅要求修改或查看草稿时，不自动提交。提交遵循[提交规范](CONTRIBUTING.md#提交规范)，提交与推送分开执行。

## 文档维护

- `README.md`：接入方式、脚本参数、使用示例和文件用途。
- `CONTRIBUTING.md`：配置维护规则、合并语法、验证与 Git 规范。
- `AGENTS.md`：工作前需要阅读什么、关键约束和交付要求；详细规则通过链接引用。
- `CLAUDE.md`：仅保留 `@AGENTS.md` 导入入口。

每项详细说明只在所属文档维护，其他文档保留必要的简短提醒和链接。
