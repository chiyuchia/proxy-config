# 贡献指南

本文面向项目维护者，集中说明修改位置、配置约束和验证流程；文件概览、Sub-Store 接入及脚本参数见 [README.md](README.md)。

[AGENTS.md](AGENTS.md) 是自动化工具共用的工作指令入口，Claude Code 通过 [CLAUDE.md](CLAUDE.md) 中的 `@AGENTS.md` 导入；详细开发规范在本文维护。

## 修改位置

| 修改内容 | 维护位置 |
| --- | --- |
| 公共网络设置、全部共同代理组及候选顺序、成员生成声明、筛选、测速设置、规则集和分流规则 | `configs/base.yaml` |
| Mihomo 的 DNS、嗅探、oixCloud 文件 provider 声明、Optimized 组及相关 `use` 和菜单引用 | `configs/mihomo.yaml` |
| Stash 的 DNS 差异 | `configs/stash.yaml` |
| 服务端下载、配置合并及引用检查 | `src/merge-config/` |
| 节点协议筛选、代理组成员生成和最终配置校验 | `src/config-overwrite/` |
| 按节点地区设置 `dialer-proxy` | `src/dialer-proxy/` |
| 节点地区识别、名称格式和关键词提取 | `src/rename/` |
| Sub-Store 入口与全局对象适配 | `src/entries/` |
| 运行时 provider 声明的读取与校验 | `src/runtime-providers.ts` |
| 共享配置类型与 Sub-Store 全局声明 | `src/types.ts`、`src/sub-store.d.ts` |
| 单文件脚本构建 | `tools/build.ts` |
| 自定义规则集内容 | `rules/` |

共同代理组沿用 Mihomo 的分组和候选顺序，只在 `configs/base.yaml` 维护，包括 oixCloud Edge、吹雪云和一元机场组。`configs/stash.yaml` 不维护代理组；Mihomo 的代理组补丁仅用于 oixCloud provider 相关差异。

除 Mihomo 的 oixCloud provider、Optimized 组及相应 `use` 和菜单引用外，两种客户端合并后的 `proxy-groups` 必须一致。共同候选顺序、筛选和测速设置不能分别在客户端差异文件中维护。

### 脚本开发

源码、构建工具和测试使用 TypeScript ES Modules 维护，按职责拆分，再由 esbuild 将四个入口打包到 `scripts/`。`scripts/*.js` 是供 Sub-Store 运行并纳入版本控制的 JavaScript 发布产物，请修改 `src/` 后在本地构建并验证，不要直接修改生成文件。源码可单独提交，也可连同重新生成的产物一起提交；`master` 的产物由[自动构建与发布](#自动构建与发布)流程补齐。

```text
src/
  entries/           Sub-Store 的 main / operator 入口，读取运行时全局对象
  merge-config/      配置值、补丁合并、引用校验、远程来源读取
  config-overwrite/  组成员筛选与重建、最终配置校验
  dialer-proxy/      节点地区识别与 dialer-proxy 设置
  rename/            地区数据、别名、关键词、参数、识别与名称格式
  runtime-providers.ts  运行时 provider 声明读取与校验
  types.ts           共享节点、代理组、配置和运行时接口
  sub-store.d.ts     Sub-Store 注入的全局对象声明，仅用于类型检查
tools/build.ts       将四个入口分别打包为 scripts/*.js
tests/*.test.ts      核心逻辑测试与发布脚本的 Sub-Store 运行环境模拟
tests/type-contracts.ts  仅在类型检查阶段验证的输入输出类型契约
tsconfig.json        源码、构建工具和测试的严格类型检查配置
```

核心逻辑通过参数接收配置、脚本参数、HTTP/YAML 等依赖；`$arguments`、`$substore`、`ProxyUtils` 只在入口适配。新增规则先确定所属模块，地区信息按一条记录维护代码、中文名、英文名和旗帜，保留记录及匹配顺序。

内部模块使用显式 `.ts` 导入，纯类型依赖使用 `import type`。`tsc --noEmit` 对源码、构建工具和测试启用 `strict` 检查；esbuild 负责移除类型并打包，不代替类型检查。外部 YAML 和未经校验的字段使用 `unknown`，经现有校验后收窄；不要用 `any` 或禁用类型检查来绕过边界。Node.js 类型只用于本地工具和测试，发布脚本运行时仍仅依赖声明的 Sub-Store 接口。

具名函数和运行时适配方法使用中文 JSDoc，说明功能、每个参数及返回值，并注明默认值、输入修改和异常等行为。简单的内联数组回调和测试用例回调由所属函数说明或测试描述解释。`src/` 中的函数注释添加 `@preserve`，构建时保留到发布脚本；发布文件的外层 `main` / `operator` 自动复用源码入口的 JSDoc，无需单独维护。

四个发布文件各自包含完整依赖，不需要运行时 `import`、`require` 或本地 Node.js。构建保留顶层 `main(config)` / `operator(proxies, targetPlatform, context)`，两个配置脚本和两个订阅节点脚本各自作为独立操作执行。产物不压缩，保留中文和来源模块注释，便于排查问题。

## 配置与合并

### 配置来源与处理流程

- `configs/base.yaml` 保留 `$base: true`，两份差异文件分别保留 `$profile: mihomo` 和 `$profile: stash`；标记用于检查来源，输出时移除。
- 三份 YAML 分别解析，锚点只能引用同一文件中的定义。实际节点由 Sub-Store 注入，三份配置源不要定义顶层 `proxies`。
- `scripts/merge-config.js` 通过 `async main(config)` 读取公共配置和指定客户端差异；保留已有 `config.proxies`，其余输入配置由合并结果替换。
- 合并与 `scripts/config-overwrite.js` 覆写必须作为两个独立的脚本操作执行，不能拼接；覆写在合并和节点注入之后执行。额外的配置修改也应放在合并之后、最终覆写之前，以便进入最终校验。
- `scripts/dialer-proxy.js` 在需要中转的来源订阅中通过 `operator(proxies, targetPlatform, context)` 为全部输入节点按地区设置中转，不区分来源模式。自建节点设置中转后保留原名，直接供文件注入和覆写使用；oixCloud Edge 和一元机场设置中转后可按需重命名。接入及地区分配规则见 [README.md 的节点中转说明](README.md#节点中转)。
- `scripts/rename.js` 在订阅或组合订阅中通过 `async operator(proxies, targetPlatform, context)` 处理节点数组，再供文件注入和覆写使用；接入及参数见 [README.md 的节点重命名说明](README.md#节点重命名)。

### 测速参数复用

公共测速组通过 `<<: *url_test_defaults` 复用参数，锚点定义在 `base.yaml` 的 VikingLinks 亚太组中。调整公共测速参数时只改该定义，各组名称和筛选条件单独维护。

Mihomo 的 Optimized 组在 `configs/mihomo.yaml` 中直接维护测速参数，以及 `tolerance`、`max-failed-times` 等组设置。oixCloud provider 的健康检查由 oix 内核运行时管理，不在模板中定义。

### 合并与补丁语法

普通映射递归合并，标量和普通数组由客户端差异覆盖。数组不会自动去重或排序，`rules` 和候选节点顺序保持原样。客户端可独立覆盖 DNS，例如：

```yaml
$profile: stash
dns:
  nameserver:
    - https://doh.pub/dns-query
```

顶层 `proxy-groups` 按 `name` 合并，已有组只写要修改的字段并继承公共成员生成声明，新组默认追加到末尾且必须提供[成员生成声明](#成员生成声明)。Mihomo 可补入 oixCloud provider 和 Optimized 组引用：

```yaml
$profile: mihomo
proxy-providers:
  oixCloud:
    type: file
    path: ./proxy_provider/oixCloud
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
    x-substore:
      members:
        mode: append
    type: select
    proxies: [DIRECT]
```

修改或删除组名、规则集名时，同步更新所有引用。补丁字段只用于服务端合并，不会出现在最终客户端配置中。远程请求失败、来源为空、客户端不匹配、补丁无效或引用错误时，合并脚本会报错并停止生成配置。

### 运行时 provider 声明

自定义配置可通过顶层 `x-substore.runtime-proxy-providers` 声明由客户端运行时创建的代理 provider，例如：

```yaml
x-substore:
  runtime-proxy-providers: [runtimeSubscription]
```

顶层 `x-substore` 只接受 `runtime-proxy-providers` 字段。声明可省略，列表允许 `[]`；提供时必须是数组，成员必须是非空字符串，不能重复。未知字段、错误类型，以及同时在 `proxy-providers` 中定义同名 provider 都会报错，避免对同一名称重复声明。

合并与最终校验均允许组内 `use` 引用本地定义的 provider 或已声明的运行时 provider；未声明且没有本地定义的名称仍然报错。运行时 provider 声明不创建 provider，不代表其中的节点已存在，也不能充当规则目标、`dialer-proxy` 目标或 `rule-providers` 引用。Sub-Store 不读取或检查客户端运行时生成的本地文件。

声明在合并结果和两个独立脚本之间的 YAML 序列化中保留，覆写校验成功后移除顶层 `x-substore`，仅保留组内 `use` 供客户端解析。它只允许引用通过 Sub-Store 校验，不能让内核跳过自己的引用检查；使用前必须确认客户端在所有配置解析阶段都能提供该 provider，包括下载后的独立 `-t` 检查。

本仓库的 Mihomo 模板使用显式 `oixCloud` 文件 provider，不依赖这项豁免；Stash 模板没有 oixCloud 依赖。文件声明及 oix 启用要求见 [README](README.md#接入-sub-store)。

### 最终配置校验

`scripts/config-overwrite.js` 在成员生成之后、返回配置之前执行最终校验，成功后移除内部声明。校验代码随覆写脚本打包为单文件 JavaScript，直接在 Sub-Store 运行；无需新增处理操作或在 Sub-Store 安装开发依赖。合并阶段的引用检查仍保留，最终校验同时覆盖合并后才注入的节点和新增的 provider。

检查范围包括：

- 节点和代理组必须具有非空名称，不允许同名节点、同名组或节点与组重名，也不能占用内置策略名称；`GLOBAL` 允许显式定义为代理组。代理组必须具有非空 `type`。
- 代理组 `proxies`、`use`、节点 `dialer-proxy`、规则的策略目标及顶层 `RULE-SET` 引用必须存在，引用检查识别合法的内置策略；`use` 也接受[已声明的运行时 provider](#运行时-provider-声明)，不解析逻辑规则条件内部的嵌套规则集引用。
- 根据显式组成员和节点中转关系检测依赖循环，包括组引用组、节点中转节点，以及“节点 → 中转组 → 原节点”等混合路径。未显式定义的 `GLOBAL` 按包含全部本地节点和组处理，可捕获“节点 A → GLOBAL → 节点 A”的循环。
- `proxy-providers` 和 `rule-providers` 中 `type: http` 的 provider 必须配置合法的 HTTP(S) `url`，不按名称提供例外。只检查地址格式，不执行下载或连通性测试。

覆写先构造候选结果，校验成功后才将生成的组写回原配置对象、移除内部声明并返回该对象。失败时抛出包含问题位置的异常，保留输入配置、成员生成声明和运行时 provider 声明，供定位或修正；不会返回这份无效结果。测试应同时验证错误内容和失败时的输入保留。

校验仅检查当前配置对象已经包含的内容，不展开远程 provider 的节点或 `include-all` 等客户端动态生成的成员，也不替代 Mihomo、Stash 对全部配置字段的解析和校验。新增引用字段或动态成员机制时，需要明确其运行阶段和检查范围，不能将远程 provider 名称视为已知节点名称。

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

各组的成员生成方式由模板中的 `x-substore.members` 声明，覆写脚本不根据组名或其中的关键词推断行为。共同组的声明只在 `configs/base.yaml` 维护；Mihomo 的共同组补丁继承声明，仅新增的 oixCloud Optimized 组在差异文件中声明。字段和处理边界见[成员生成声明](#成员生成声明)。

当前普通组使用 `append`，全球直连组使用 `manual` 保留手工配置。亚太和美西两个中转组使用 `append` 并排除带 `dialer-proxy` 的注入节点；三个机场亚太组和良心云 Hy2 组使用 `replace` 并排除带 `dialer-proxy` 的注入节点。机场亚太组统一命名为“机场名 亚太”，只筛选 HK、SG、JP、TW，每次覆写重建成员，避免旧地区或已改为链式代理的节点残留。

| 代理组 | 额外限制 |
| --- | --- |
| `✈️ VikingLinks 亚太` | 名称含 VikingLinks，线路为 Go、IEPL 或 SH |
| `✈️ 良心云 亚太` | 名称含良心云及 `CT`（包括 `CTCU`、`CTCUCM`），实际协议仅限 VLESS |
| `✈️ 吹雪云 亚太` | 名称含吹雪云及“电信”，不限制协议 |
| `✈️ 良心云 Hy2` | 名称含良心云，实际协议仅限 `hysteria2` / `hy2`，排除带 `dialer-proxy` 的节点，每次覆写重建成员 |

协议筛选依据节点实际 `type`，不依据名称中的协议字样。修改重命名脚本的 `out`、`retain` 或订阅名后，检查最终名称仍能满足机场名、地区代码和线路关键词的筛选要求。

### 成员生成声明

每个合并后的代理组都必须有 `x-substore.members` 映射，并显式填写 `mode`。显示名称仅用于展示与引用，改名不会改变声明所指定的行为。例如，以下组重建名称匹配良心云、实际协议为 VLESS 且未设置中转的成员：

```yaml
proxy-groups:
  - name: "VLESS 候选"
    type: select
    filter: "良心云"
    x-substore:
      members:
        mode: replace
        exclude-dialer: true
        types: [vless]
```

代理组内的 `x-substore` 只接受 `members` 字段，`members` 只接受下表三个字段；顶层 `x-substore` 使用独立的[运行时 provider 声明](#运行时-provider-声明)。缺少成员声明或 `mode`、未知字段、未知模式、错误的字段类型都会报错，不会回退到按组名判断或全量注入。

| 字段 | 要求 | 含义 |
| --- | --- | --- |
| `mode` | 必填字符串，只接受 `append`、`replace`、`manual` | 指定成员更新方式，见下表 |
| `exclude-dialer` | 可选布尔值，省略为 `false` | 为 `true` 时排除带 `dialer-proxy` 的注入节点；字符串 `"true"` / `"false"` 无效 |
| `types` | 可选的非空字符串数组，数组成员不能是空字符串 | 按节点实际 `type` 限制协议，不区分大小写；省略时不限协议，`[]` 无效 |

| `mode` | 处理方式 |
| --- | --- |
| `append` | 保留现有候选顺序，再追加匹配的注入节点，合并去重并保留首次出现的位置。现有候选中能对应到注入节点的成员同样受 `exclude-dialer` 和 `types` 限制；手工组引用和内置策略保持原序 |
| `replace` | 忽略现有 `proxies`，按当前注入节点重新生成成员，去重并保持节点输入顺序 |
| `manual` | 保留手工配置的 `proxies`，不筛选、追加或重建成员 |

名称筛选继续使用现有组字段 `filter`，不在 `members` 中重复配置。`append` 的新增节点和 `replace` 的重建节点需要同时满足 `filter`、`types` 和 `exclude-dialer`；没有 `filter` 时不限节点名称。`append` 不使用 `filter` 移除原有手工候选，无效正则不会退回全量匹配。两种客户端使用相同的声明执行逻辑，保留共同候选及节点的顺序。

这些限制只处理当前 `config.proxies` 中的注入节点，不递归筛选组引用、`use` 或 provider 内部成员。中转组声明 `exclude-dialer: true` 不代表其引用的每个子组或 provider 也会受到同样限制；需要限制的子组必须声明自己的规则。`manual` 不执行成员筛选，附带的 `types` 或 `exclude-dialer` 不改变手工名单。

声明在合并及两个独立脚本之间的 YAML 序列化中保留，覆写完成后从各组移除，不进入最终客户端配置。每次刷新都从本次合并结果重新执行节点注入与覆写，固定候选仍以模板为准。不要把已输出的客户端配置直接交给覆写脚本再次处理：它已不包含声明，会因缺少声明报错。脚本与配置应一起更新；使用自定义模板时，也需要为每个组补全声明。

## 资源链接

本仓库 `chiyuchia/proxy-config` 的脚本、YAML 和其他资源统一使用 GitHub Raw 链接：

```text
https://raw.githubusercontent.com/chiyuchia/proxy-config/{branch}/{path}
```

例如，合并脚本使用 `https://raw.githubusercontent.com/chiyuchia/proxy-config/master/scripts/merge-config.js`。修改链接时保留正确的仓库、分支和路径，并检查资源是否可访问。

其他仓库（如 `ACL4SSR`、`blackmatrix7` 和 `dler-io`）保留各自现有的 CDN 链接策略。

固定脚本和配置版本的用法见 README 的[合并脚本参数](README.md#合并脚本参数)。

## 本地验证

开发环境需要 Node.js 22 或更高版本及 npm。首次安装或锁文件更新后运行 `npm ci`；TypeScript、tsx、构建、格式化和测试依赖由 `package-lock.json` 固定，只用于本地开发与 CI。构建工具和测试通过 tsx 执行，不依赖 Node.js 的原生 TypeScript 支持。Sub-Store 继续运行 JavaScript 发布文件并使用自带的 YAML 解析器。

发布流程测试还需要 Git 和 Bash，只在临时目录创建本地仓库，不访问项目远端。

```bash
npm ci
npm run format
npm run build
npm run check
```

`npm run check` 依次检查格式、严格类型、源码与 `scripts/` 产物一致性并执行测试，不会修改文件。可单独运行 `npm run typecheck` 检查类型，或运行 `npm test` 测试当前 TypeScript 源码与已有 JavaScript 发布产物；修改源码后须先构建再做完整检查。GitHub Actions 对所有推送和 PR 依次执行 `npm ci`、`npm run build`、`npm run check`，同样包含类型检查，不要求提交前已更新产物。

如已安装 oix 内核，可额外运行原生解析回归；未设置 `MIHOMO_BIN` 时该项默认跳过：

```bash
MIHOMO_BIN=/absolute/path/to/mihomo-oix npm test
```

该回归从最终模板提取 `proxy-providers` 和 oixCloud Optimized 组，隔离其他分组、DNS 和规则等外部依赖，在不传 oix 凭据且 provider 文件不存在的临时目录中执行 `-t`，并验证移除 provider 后会失败。它只验证 oixCloud 注册与 Optimized 组引用，不验证完整最终配置、实际订阅下载或客户端启动。

测试覆盖：

- 覆写输出移除内部声明后的类型，以及节点附加字段和其他配置字段的类型保留。
- 两种客户端的配置合并、共同代理组定义和候选顺序一致性，以及相同注入节点下的组成员一致性；仅排除 Mihomo 的 oixCloud provider、Optimized 组及相应 `use` 和菜单引用。
- 数组与代理组补丁、来源标记、节点保留、重复组名和无效引用等检查。
- 最终覆写后的名称、引用、中转与组成员混合循环、HTTP provider 地址检查，以及校验失败时输入对象和内部声明不变。
- 远程读取、URL、超时与缓存刷新参数的边界和请求行为、自定义地址保留、请求和 YAML 错误处理，以及 Sub-Store 独立脚本的异步执行与序列化流程。
- 成员声明的字段校验、模式和默认值、组名变化不改变行为、声明在中间配置中的保留及最终移除，以及实际机场与中转节点筛选、协议限制、节点注入和覆写结果。
- 运行时 provider 声明的字段与名称校验、与本地定义的冲突、`use` 引用边界、声明在中间配置中的保留及最终移除，以及 Mihomo 文件 provider 与 Stash 无依赖的输出。
- 中转节点的地区识别、全部输入节点的中转设置及已有中转字段覆盖，以及自建保留原名和机场可选重命名后注入、覆写的完整流程。
- 重命名仅按节点名称识别地区、未知地区保留原名，以及启用 `hot` 后过滤未知地区节点的行为。
- 参数边界、关键词与旗帜保留、单节点序号处理，以及覆写的无效筛选、正则状态、从合并结果重复生成和拒绝直接覆写最终输出。
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

[GitHub Actions 工作流](.github/workflows/check.yml) 在所有分支的 push 和 PR 上安装锁定的依赖、构建四个脚本并执行完整检查。仅 `master` 的 push 在检查成功后自动发布产物；其他分支和 PR 只构建与检查，不回写文件。

发布使用本次已验证的 `scripts/merge-config.js`、`scripts/config-overwrite.js`、`scripts/dialer-proxy.js` 和 `scripts/rename.js`。这些文件仍纳入版本控制，只有产物存在差异时，机器人才会创建提交并普通推送到 `master`。发布前会检查远端分支：若 `master` 已前进，旧运行跳过发布，由最新 push 的运行负责构建；不会强制推送或覆盖后续提交。现有 `master/scripts/` 地址及 `configs/` 读取方式保持不变。

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
