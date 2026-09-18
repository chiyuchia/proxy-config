# 贡献指南

本文面向项目维护者，集中说明修改位置、配置约束和验证流程；文件概览、Sub-Store 接入及脚本参数见 [README.md](README.md)。

[AGENTS.md](AGENTS.md) 是自动化工具共用的工作指令入口，Claude Code 通过 [CLAUDE.md](CLAUDE.md) 中的 `@AGENTS.md` 导入；详细开发规范在本文维护。

## 修改位置

| 修改内容 | 维护位置 |
| --- | --- |
| 公共网络设置、全部共同代理组及候选顺序、筛选、测速设置、规则集和分流规则 | `configs/base.yaml` |
| Mihomo 的 DNS、嗅探、oixCloud provider、Optimized 组及相关 `use` 和菜单引用 | `configs/mihomo.yaml` |
| Stash 的 DNS 差异 | `configs/stash.yaml` |
| 服务端下载、配置合并及引用检查 | `scripts/merge-config.js` |
| 节点协议筛选、代理组成员生成和 provider URL 注入 | `scripts/config-overwrite.js` |
| 节点地区识别、名称格式和关键词提取 | `scripts/rename.js` |
| 自定义规则集内容 | `rules/` |

共同代理组沿用 Mihomo 的分组和候选顺序，只在 `configs/base.yaml` 维护，包括 oixCloud Edge、吹雪云和一元机场组。`configs/stash.yaml` 不维护代理组；Mihomo 的代理组补丁仅用于 oixCloud provider 相关差异。

除 Mihomo 的 oixCloud provider、Optimized 组及相应 `use` 和菜单引用外，两种客户端合并后的 `proxy-groups` 必须一致。共同候选顺序、筛选和测速设置不能分别在客户端差异文件中维护。

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

运行测试需要支持 `node:test` 的 Node.js，以及可导入 `yaml` 的 Python 3（PyYAML）。它们是本地测试依赖；Sub-Store 使用自带的 YAML 解析器，服务端不需要 Python。

```bash
node --test tests/*.test.js
```

测试覆盖：

- 两种客户端的配置合并、共同代理组定义和候选顺序一致性，以及相同注入节点下的组成员一致性；仅排除 Mihomo 的 oixCloud provider、Optimized 组及相应 `use` 和菜单引用。
- 数组与代理组补丁、来源标记、节点保留、重复组名和无效引用等检查。
- 远程读取、URL 与超时参数、请求和 YAML 错误处理，以及 Sub-Store 独立脚本的异步执行与序列化流程。
- 实际机场与中转节点筛选、协议限制、节点注入和覆写结果。
- 重命名仅按节点名称识别地区、未知地区保留原名，以及启用 `hot` 后过滤未知地区节点的行为。

修改配置或脚本后，检查两种客户端的最终输出、规则集和策略组引用、组成员及候选顺序，不能只验证未注入节点的合并结果。有意调整行为时，同步更新测试预期。

发布后按 README 的[修改与更新](README.md#修改与更新)刷新输出，更新客户端订阅前先在 Sub-Store 预览节点和组成员。

## 提交规范

### 开发与发布流程

`master` 是稳定生产分支，只接纳已验证的更改。功能分支为可选项，仅在大型功能时使用；提交或合并前都需完成本地验证。

1. 修改文件，并按[本地验证](#本地验证)检查结果。
2. 检查差异，使用约定式提交格式手动执行 `git commit`。
3. 检查提交内容和 commit 信息，确认后再单独手动执行 `git push`。

提交和推送是两个独立步骤，不把提交视为已获准推送。

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
