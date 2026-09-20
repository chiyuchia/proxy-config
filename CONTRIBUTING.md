# 贡献指南

本文面向项目维护者，集中说明修改位置、配置约束和验证流程；文件概览、Sub-Store 接入及脚本参数见 [README.md](README.md)。

[AGENTS.md](AGENTS.md) 是自动化工具共用的工作指令入口，Claude Code 通过 [CLAUDE.md](CLAUDE.md) 中的 `@AGENTS.md` 导入；详细开发规范在本文维护。

## 修改位置

| 修改内容 | 维护位置 |
| --- | --- |
| 公共网络设置、全部共同代理组及候选顺序、筛选、测速设置、规则集和分流规则 | `configs/base.yaml` |
| Mihomo 的 DNS、嗅探、oixCloud provider、Optimized 组及相关 `use` 和菜单引用 | `configs/mihomo.yaml` |
| Stash 的 DNS 差异 | `configs/stash.yaml` |
| 服务端下载、配置合并及引用检查 | `src/merge-config/` |
| 节点协议筛选、代理组成员生成和 provider URL 注入 | `src/config-overwrite/` |
| 节点地区识别、名称格式和关键词提取 | `src/rename/` |
| Sub-Store 入口与全局对象适配 | `src/entries/` |
| 单文件脚本构建 | `tools/build.js` |
| 自定义规则集内容 | `rules/` |

共同代理组沿用 Mihomo 的分组和候选顺序，只在 `configs/base.yaml` 维护，包括 oixCloud Edge、吹雪云和一元机场组。`configs/stash.yaml` 不维护代理组；Mihomo 的代理组补丁仅用于 oixCloud provider 相关差异。

除 Mihomo 的 oixCloud provider、Optimized 组及相应 `use` 和菜单引用外，两种客户端合并后的 `proxy-groups` 必须一致。共同候选顺序、筛选和测速设置不能分别在客户端差异文件中维护。

### 脚本开发

脚本使用 JavaScript ES Modules 维护，按职责拆分源码，再由 esbuild 打包到 `scripts/`。`scripts/*.js` 是纳入版本控制的发布产物，请修改 `src/` 后在本地构建并验证，不要直接修改生成文件。源码可单独提交，也可连同重新生成的产物一起提交；`master` 的产物由[自动构建与发布](#自动构建与发布)流程补齐。

```text
src/
  entries/           Sub-Store 的 main / operator 入口，读取运行时全局对象
  merge-config/      配置值、补丁合并、引用校验、远程来源读取
  config-overwrite/  组成员筛选与重建、provider URL 注入
  rename/            地区数据、别名、关键词、参数、识别与名称格式
tools/build.js       将三个入口分别打包为 scripts/*.js
tests/              核心逻辑测试与发布脚本的 Sub-Store 运行环境模拟
```

核心逻辑通过参数接收配置、脚本参数、HTTP/YAML 等依赖；`$arguments`、`$substore`、`ProxyUtils` 只在入口适配。新增规则先确定所属模块，地区信息按一条记录维护代码、中文名、英文名和旗帜，保留记录及匹配顺序。

三个发布文件各自包含完整依赖，不需要运行时 `import`、`require` 或本地 Node.js。构建保留顶层 `main(config)` / `operator(proxies, targetPlatform, context)`，两个配置脚本仍作为独立操作执行。产物不压缩，保留中文和来源模块注释，便于排查问题。

## 配置与合并

### 配置来源与处理流程

- `configs/base.yaml` 保留 `$base: true`，两份差异文件分别保留 `$profile: mihomo` 和 `$profile: stash`；标记用于检查来源，输出时移除。
- 三份 YAML 分别解析，锚点只能引用同一文件中的定义。实际节点由 Sub-Store 注入，三份配置源不要定义顶层 `proxies`。
- `scripts/merge-config.js` 通过 `async main(config)` 读取公共配置和指定客户端差异；保留已有 `config.proxies`，其余输入配置由合并结果替换。
- 合并与 `scripts/config-overwrite.js` 覆写必须作为两个独立的脚本操作执行，不能拼接；覆写在合并之后执行。额外的配置修改也应放在合并之后。
- `scripts/rename.js` 在订阅或组合订阅中通过 `async operator(proxies, targetPlatform, context)` 处理节点数组，再供文件注入和覆写使用；接入及参数见 [README.md 的节点重命名说明](README.md#节点重命名)。

### 测速参数复用

公共测速组通过 `<<: *url_test_defaults` 复用参数，锚点定义在 `base.yaml` 的 VikingLinks 亚太组中。调整公共测速参数时只改该定义，各组名称和筛选条件单独维护。

Mihomo 的 oixCloud provider 健康检查与 Optimized 组通过 `configs/mihomo.yaml` 内的 `oix_health_check` 锚点复用测速参数。provider 的 `enable` 与组的 `tolerance`、`max-failed-times` 等专属字段分别保留，不跨文件引用锚点。

### 合并与补丁语法

普通映射递归合并，标量和普通数组由客户端差异覆盖。数组不会自动去重或排序，`rules` 和候选节点顺序保持原样。客户端可独立覆盖 DNS，例如：

```yaml
$profile: stash
dns:
  nameserver:
    - https://doh.pub/dns-query
```

顶层 `proxy-groups` 按 `name` 合并，已有组只写要修改的字段，新组默认追加到末尾。Mihomo 可补入 oixCloud provider 和 Optimized 组引用：

```yaml
$profile: mihomo
proxy-groups:
  - name: "🚀 节点选择"
    use: [oixCloud]
    proxies:
      $insert-before:
        "✈️ oixCloud Edge": ["✈️ oixCloud Optimized"]
```

数组局部修改支持以下操作，依次执行；共同代理组的候选内容与顺序仍直接在 `base.yaml` 中修改。

| 操作 | 用途 |
| --- | --- |
| `$remove` | 删除指定成员 |
| `$prepend` | 在数组开头插入成员 |
| `$append` | 在数组末尾追加成员 |
| `$insert-before` | 在指定现有成员之前插入成员 |

用 `{ $delete: true }` 删除字段；删除代理组时保留 `name` 并添加 `$delete: true`。新增组可以用 `$before` 或 `$after` 指定相邻组名。以下仅展示通用补丁语法：

```yaml
sniffer: { $delete: true }
proxy-groups:
  - name: "待删除组"
    $delete: true
  - name: "新选择组"
    $before: "🚀 节点选择"
    type: select
    proxies: [DIRECT]
```

修改或删除组名、规则集名时，同步更新所有引用。补丁字段只用于服务端合并，不会出现在最终客户端配置中。远程请求失败、来源为空、客户端不匹配、补丁无效或引用错误时，合并脚本会报错并停止生成配置。

## 规则与节点筛选

### 规则顺序

Clash 规则从上到下匹配，第一条匹配的规则生效。更具体的规则必须放在通用规则之前，最终以 `MATCH` 兜底；交换下面两条规则可能让 Google 先匹配 YouTube 流量：

```yaml
rules:
  - "RULE-SET,youtube,📹 油管视频"
  - "RULE-SET,google,📢 Google"
```

规则集使用清晰的中文名称，例如“📢 谷歌服务”；相同用途的规则集使用同一个策略组。`rule-providers` 定义远程规则集，`rules` 按顺序引用规则集和策略组；`proxy-groups` 定义节点选择、中转、地区、机场和服务分流组。

### 节点与代理组

覆写脚本合并并去重 `proxies` 成员，保留原有顺序；有 `filter` 的组按筛选规则追加匹配节点，没有 `filter` 的普通组追加全部候选节点。全球直连组保持手工配置，不自动注入节点。

中转组和机场亚太组只使用不带 `dialer-proxy` 的节点。三个机场亚太组统一命名为“机场名 亚太”，只筛选 HK、SG、JP、TW，每次覆写都重建成员，避免旧地区或已改为链式代理的节点残留。

| 代理组 | 额外限制 |
| --- | --- |
| `✈️ VikingLinks 亚太` | 名称含 VikingLinks，线路为 Go、IEPL 或 SH |
| `✈️ 良心云 亚太` | 名称含良心云及 `CT`（包括 `CTCU`、`CTCUCM`），实际协议仅限 VLESS |
| `✈️ 吹雪云 亚太` | 名称含吹雪云及“电信”，不限制协议 |
| `✈️ 良心云 Hy2` | 名称含良心云，实际协议仅限 `hysteria2` / `hy2`，排除带 `dialer-proxy` 的节点，每次覆写重建成员 |

协议筛选依据节点实际 `type`，不依据名称中的协议字样。修改重命名脚本的 `out`、`retain` 或订阅名后，检查最终名称仍能满足机场名、地区代码和线路关键词的筛选要求。

`oixCloudEdgePath` 可向 oixCloud provider 注入订阅 URL，Mihomo 差异文件本身不填写该 URL。Stash 输出不需要该参数；添加它会额外生成 provider。

## 资源链接

本仓库 `chiyuchia/proxy-config` 的脚本、YAML 和其他资源统一使用 GitHub Raw 链接：

```text
https://raw.githubusercontent.com/chiyuchia/proxy-config/{branch}/{path}
```

例如，合并脚本使用 `https://raw.githubusercontent.com/chiyuchia/proxy-config/master/scripts/merge-config.js`。修改链接时保留正确的仓库、分支和路径，并检查资源是否可访问。

其他仓库（如 `ACL4SSR`、`blackmatrix7` 和 `dler-io`）保留各自现有的 CDN 链接策略。

固定脚本和配置版本的用法见 README 的[合并脚本参数](README.md#合并脚本参数)。

## 本地验证

开发环境需要 Node.js 22 或更高版本及 npm。首次安装或锁文件更新后运行 `npm ci`；构建、格式化和测试依赖由 `package-lock.json` 固定，只用于本地开发与 CI。Sub-Store 继续使用自带的 YAML 解析器。

发布流程测试还需要 Git 和 Bash，只在临时目录创建本地仓库，不访问项目远端。

```bash
npm ci
npm run format
npm run build
npm run check
```

`npm run check` 依次检查格式、源码与 `scripts/` 产物一致性并执行测试，不会修改文件。日常调试可单独运行 `npm test`，它测试当前源码与已有发布产物；修改源码后须先构建再做完整检查。GitHub Actions 对所有推送和 PR 依次执行 `npm ci`、`npm run build`、`npm run check`，检查本次构建结果，不要求提交前已更新产物。

测试覆盖：

- 两种客户端的配置合并、共同代理组定义和候选顺序一致性，以及相同注入节点下的组成员一致性；仅排除 Mihomo 的 oixCloud provider、Optimized 组及相应 `use` 和菜单引用。
- 数组与代理组补丁、来源标记、节点保留、重复组名和无效引用等检查。
- 远程读取、URL 与超时参数、请求和 YAML 错误处理，以及 Sub-Store 独立脚本的异步执行与序列化流程。
- 实际机场与中转节点筛选、协议限制、节点注入和覆写结果。
- 重命名仅按节点名称识别地区、未知地区保留原名，以及启用 `hot` 后过滤未知地区节点的行为。
- 参数边界、关键词与旗帜保留、单节点序号处理，以及覆写的无效筛选、正则状态、重复执行和 provider 更新。
- 自动发布的触发限制、无变化跳过、提交范围，以及旧构建和并发推送保护。

修改配置或脚本后，检查两种客户端的最终输出、规则集和策略组引用、组成员及候选顺序，不能只验证未注入节点的合并结果。有意调整行为时，同步更新测试预期。

发布后按 README 的[修改与更新](README.md#修改与更新)刷新输出，更新客户端订阅前先在 Sub-Store 预览节点和组成员。

## 提交规范

### 开发与发布流程

`master` 是稳定生产分支，只接纳已验证的更改。功能分支为可选项，仅在大型功能时使用；提交或合并前都需完成本地验证。

1. 修改文件，并按[本地验证](#本地验证)构建和检查结果；脚本源码可单独提交，也可将重新生成的 `scripts/` 产物一同纳入提交。
2. 检查差异，使用约定式提交格式手动执行 `git commit`。
3. 检查提交内容和 commit 信息，确认后再单独手动执行 `git push`。

提交和推送是两个独立步骤，不把提交视为已获准推送。

### 自动构建与发布

[GitHub Actions 工作流](.github/workflows/check.yml) 在所有分支的 push 和 PR 上安装锁定的依赖、构建三个脚本并执行完整检查。仅 `master` 的 push 在检查成功后自动发布产物；其他分支和 PR 只构建与检查，不回写文件。

发布使用本次已验证的 `scripts/merge-config.js`、`scripts/config-overwrite.js` 和 `scripts/rename.js`。这些文件仍纳入版本控制，只有产物存在差异时，机器人才会创建提交并普通推送到 `master`。发布前会检查远端分支：若 `master` 已前进，旧运行跳过发布，由最新 push 的运行负责构建；不会强制推送或覆盖后续提交。现有 `master/scripts/` 地址及 `configs/` 读取方式保持不变。

发布任务使用 `GITHUB_TOKEN`，并声明 `contents: write` 权限，无需另配个人访问令牌。仓库及组织的 Actions 权限策略须允许该写权限，`master` 的分支保护或规则集也须允许机器人写入；不满足时，发布会失败。使用 `GITHUB_TOKEN` 推送的机器人提交不会再次触发 push 工作流，因此不会循环构建。

推送后，在 Actions 中确认本次构建与发布成功，再按 README 的[修改与更新](README.md#修改与更新)刷新 Sub-Store。构建或发布失败时，脚本修改尚未完成发布，应先修复对应错误。固定版本时须选用包含对应产物的提交，具体用法见[合并脚本参数](README.md#合并脚本参数)。

机器人发布后，远端 `master` 可能比本地多一个产物提交。后续推送前，先妥善处理本地未提交改动，再在本地 `master` 执行：

```bash
git pull --ff-only
```

若本地已有新提交导致无法快进，先检查并整合双方提交，再推送；不要用强制推送覆盖机器人的发布提交。

### 提交信息

遵循 [Conventional Commits](https://www.conventionalcommits.org/)：

```text
<type>(<scope>): <subject>

<body>

<footer>
```

| Type | 说明 |
| --- | --- |
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档更新 |
| `style` | 代码格式调整，不影响功能 |
| `refactor` | 重构，非新功能或 bug 修复 |
| `perf` | 性能优化 |
| `test` | 测试相关 |
| `chore` | 构建过程或辅助工具变动 |
| `ci` | CI 配置和脚本 |

常用 scope：`clash-rules`（Clash 规则）、`clash-config`（Clash 配置）、`cdn`（资源链接）、`docs`（文档）。例如：

```bash
git commit -m "feat(clash-config): 为所有服务分流组添加机场订阅选项"
```

问题反馈请提交 [Issue](https://github.com/chiyuchia/proxy-config/issues)。
