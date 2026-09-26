# 贡献指南

本文面向项目维护者，集中说明修改位置、配置约束和验证流程；文件概览、Sub-Store 接入及脚本参数见 [README.md](README.md)。

[AGENTS.md](AGENTS.md) 是自动化工具共用的工作指令入口，Claude Code 通过 [CLAUDE.md](CLAUDE.md) 中的 `@AGENTS.md` 导入；详细开发规范在本文维护。

## 修改位置

| 修改内容 | 维护位置 |
| --- | --- |
| 公共网络设置、全部共同代理组及候选顺序、成员生成声明、筛选、测速设置、规则集和分流规则 | `src/configs/base.yaml` |
| Mihomo 的 DNS、嗅探、oixCloud 文件 provider 声明、Optimized 组及相关 `use` 和菜单引用 | `src/configs/mihomo.yaml` |
| Stash 的 DNS 差异 | `src/configs/stash.yaml` |
| 构建时配置合并、补丁处理、专用校验及错误与复制工具 | `tools/merge-config/` |
| 构建与运行时共用的值类型判断 | `src/scripts/shared/value.ts` |
| 构建与运行时共用的内置策略和规则引用检查 | `src/scripts/shared/rules.ts` |
| 构建与运行时共用的成员生成声明校验 | `src/scripts/shared/member-policy.ts` |
| 节点协议筛选、代理组成员生成和最终配置校验 | `src/scripts/config-overwrite/` |
| 按节点地区设置 `dialer-proxy` | `src/scripts/dialer-proxy/` |
| 节点名称整理、格式和关键词提取 | `src/scripts/rename/` |
| 中转与重命名共用的地区识别、别名和地区数据 | `src/scripts/shared/regions/` |
| Sub-Store 的 `main` / `operator` 入口 | `src/scripts/entries/` |
| 运行时 provider 声明的读取与校验 | `src/scripts/shared/runtime-providers.ts` |
| 共享节点、配置及覆写输出类型 | `src/scripts/shared/types.ts` |
| YAML 模板生成与单文件脚本构建 | `tools/build.ts` |
| 自定义规则集内容 | `rules/` |

共同代理组沿用 Mihomo 的分组和候选顺序，只在 `src/configs/base.yaml` 维护，包括 oixCloud Edge、吹雪云和一元机场组。`src/configs/stash.yaml` 不维护代理组；Mihomo 的代理组补丁仅用于 oixCloud provider 相关差异。

除 Mihomo 的 oixCloud provider、Optimized 组及相应 `use` 和菜单引用外，两种客户端合并后的 `proxy-groups` 必须一致。共同候选顺序、筛选和测速设置不能分别在客户端差异文件中维护。

### 脚本开发

源码、构建工具和测试使用 TypeScript ES Modules 维护，按职责拆分。`tools/build.ts` 将公共配置与两份客户端差异分别合并，生成 `dist/mihomo.yaml` 和 `dist/stash.yaml`，并由 esbuild 将三个 Sub-Store 入口打包为 `dist/*.js`。`dist/` 由 `.gitignore` 排除，不纳入版本控制。修改配置源、运行期脚本或构建逻辑后，均需在本地构建并验证，不要直接修改或提交生成文件。推送到 `master` 后，由[自动构建与发布](#自动构建与发布)流程重新构建、检查并上传五个 GitHub Releases 附件。

```text
src/
  configs/              公共配置源及 Mihomo、Stash 差异源
  scripts/              运行期脚本及共用依赖
    entries/            Sub-Store 的 main / operator 调用入口
    config-overwrite/   组成员筛选与重建、最终配置校验
    dialer-proxy/       根据地区设置 dialer-proxy
    rename/             重命名流程、名称格式与关键词提取
    shared/             业务脚本与构建工具共用的依赖
      types.ts          共享节点、代理组、配置和覆写输出类型
      value.ts          映射值类型判断 isConfigMap
      rules.ts          内置策略与规则引用检查
      member-policy.ts  成员生成声明读取与校验
      runtime-providers.ts  运行时 provider 声明读取与校验
      regions/
        identify.ts     名称地区识别及 Viking 格式解析
        aliases.ts      地区别名
        regions.ts      地区数据及热门地区集合
tools/
  build.ts           构建编排：生成两份 dist/*.yaml 模板，并打包三个 dist/*.js 入口
  merge-config/      构建专用的合并、补丁、校验及错误与复制工具
tests/*.test.ts      核心逻辑测试与发布脚本的 Sub-Store 运行环境模拟
tests/type-contracts.ts  仅在类型检查阶段验证的输入输出类型契约
tsconfig.json        源码、构建工具和测试的严格类型检查配置
```

`src/` 仅按配置和脚本分为两类：`src/configs/` 保存 YAML 配置源，`src/scripts/` 保存运行期脚本，公共依赖集中在 `src/scripts/shared/`；`tools/` 保存构建编排和专用合并模块。业务脚本与构建工具可以引用 `shared/`，其中的模块只依赖其他共享模块，不反向导入业务脚本或 `tools/`；`src/` 不依赖 `tools/`。合并专用的补丁、校验、错误与复制工具保留在 `tools/merge-config/`。

核心逻辑通过参数接收配置与节点等依赖；三个入口适配 Sub-Store 的 `main` / `operator` 调用约定，不依赖自定义全局对象。配置源在构建时从本地读取，Sub-Store 不再下载并合并三份配置源。新增规则先确定所属模块，地区信息按一条记录维护代码、中文名、英文名和旗帜，保留记录及匹配顺序。

内部模块使用显式 `.ts` 导入，纯类型依赖使用 `import type`。`tsc --noEmit` 对源码、构建工具和测试启用 `strict` 检查；esbuild 负责移除类型并打包，不代替类型检查。外部 YAML 和未经校验的字段使用 `unknown`，经现有校验后收窄；不要用 `any` 或禁用类型检查来绕过边界。Node.js 类型只用于本地工具和测试，发布脚本通过 Sub-Store 的 `main` / `operator` 接口接收输入。

具名函数和运行时适配方法使用中文 JSDoc，说明功能、每个参数及返回值，并注明默认值、输入修改和异常等行为。简单的内联数组回调和测试用例回调由所属函数说明或测试描述解释。`src/scripts/` 中的函数注释添加 `@preserve`，构建时保留到发布脚本；发布文件的外层 `main` / `operator` 自动复用源码入口的 JSDoc，无需单独维护。

三个 JavaScript 发布文件各自包含完整依赖，不需要运行时 `import`、`require` 或本地 Node.js。构建保留顶层 `main(config)` / `operator(proxies, targetPlatform, context)`，一个配置覆写脚本和两个订阅节点脚本各自作为独立操作执行。脚本产物不压缩，保留中文和来源模块注释，便于排查问题。

## 配置与合并

### 配置来源与处理流程

- `src/configs/base.yaml` 保留 `$base: true`，两份差异文件分别保留 `$profile: mihomo` 和 `$profile: stash`；标记用于检查来源，输出时移除。
- 三份 YAML 在构建时分别解析，启用 `merge: true` 处理 YAML 合并键，并以 `uniqueKeys: true` 拒绝重复键；锚点只能引用同一文件中的定义。实际节点由 Sub-Store 注入，三份配置源和生成的模板都不定义顶层 `proxies`。
- `tools/build.ts` 复用 `tools/merge-config/` 的纯合并与校验逻辑，核对客户端来源标记、静态引用和成员声明，分别生成 Mihomo、Stash 模板；公共候选顺序、客户端补丁和规则优先级保持不变。
- 生成模板保留组内 `x-substore.members` 和顶层运行时 provider 声明，供 Sub-Store 运行期使用；构建不能执行覆写来生成发布模板，也不能注入真实订阅节点。
- Sub-Store 先读取远程模板，再注入节点，最后通过 `dist/config-overwrite.js` 覆写并校验。额外的配置修改应放在模板加载之后、最终覆写之前；接入及旧流程迁移见 [README](README.md#接入-sub-store)。
- `dist/dialer-proxy.js` 在需要中转的来源订阅中通过 `operator(proxies, targetPlatform, context)` 按地区设置中转，无需模式参数。自建仅为 SS 节点设置中转并保留原名，直接供文件注入和覆写使用；oixCloud Edge 和一元机场设置中转后可按需重命名。自建识别、协议限制及地区分配规则见 [README.md 的节点中转说明](README.md#节点中转)。
- `dist/rename.js` 在订阅或组合订阅中通过 `async operator(proxies, targetPlatform, context)` 按固定规则处理节点数组，无需参数，再供文件注入和覆写使用；接入及命名规则见 [README.md 的节点重命名说明](README.md#节点重命名)。

### 测速参数复用

公共测速组通过 `<<: *url_test_defaults` 复用参数，锚点定义在 `base.yaml` 的 VikingLinks 亚太组中。调整公共测速参数时只改该定义，各组名称和筛选条件单独维护。

Mihomo 的 Optimized 组在 `src/configs/mihomo.yaml` 中直接维护测速参数，以及 `tolerance`、`max-failed-times` 等组设置。oixCloud provider 的健康检查由 oix 内核运行时管理，不在模板中定义。

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

修改或删除组名、规则集名时，同步更新所有引用。补丁字段只用于构建时合并，不会出现在发布模板和最终客户端配置中。配置源无法解析、来源标记不匹配、补丁无效或静态引用错误时，构建会报错并停止发布。

### 运行时 provider 声明

自定义配置可通过顶层 `x-substore.runtime-proxy-providers` 声明由客户端运行时创建的代理 provider，例如：

```yaml
x-substore:
  runtime-proxy-providers: [runtimeSubscription]
```

顶层 `x-substore` 只接受 `runtime-proxy-providers` 字段。声明可省略，列表允许 `[]`；提供时必须是数组，成员必须是非空字符串，不能重复。未知字段、错误类型，以及同时在 `proxy-providers` 中定义同名 provider 都会报错，避免对同一名称重复声明。

合并与最终校验均允许组内 `use` 引用本地定义的 provider 或已声明的运行时 provider；未声明且没有本地定义的名称仍然报错。运行时 provider 声明不创建 provider，不代表其中的节点已存在，也不能充当规则目标、`dialer-proxy` 目标或 `rule-providers` 引用。Sub-Store 不读取或检查客户端运行时生成的本地文件。

声明在构建后的 YAML 模板及 Sub-Store 节点注入过程中保留，覆写校验成功后移除顶层 `x-substore`，仅保留组内 `use` 供客户端解析。它只允许引用通过构建和 Sub-Store 的校验，不能让内核跳过自己的引用检查；使用前必须确认客户端在所有配置解析阶段都能提供该 provider，包括下载后的独立 `-t` 检查。

本仓库的 Mihomo 模板使用显式 `oixCloud` 文件 provider，不依赖这项豁免；Stash 模板没有 oixCloud 依赖。文件声明及 oix 启用要求见 [README](README.md#接入-sub-store)。

### 最终配置校验

`dist/config-overwrite.js` 在成员生成之后、返回配置之前执行最终校验，成功后移除内部声明。校验代码随覆写脚本打包为单文件 JavaScript，直接在 Sub-Store 运行；无需新增处理操作或在 Sub-Store 安装开发依赖。构建合并阶段的静态引用检查仍保留，最终校验同时覆盖模板加载后才注入的节点和新增的 provider，不能由构建检查代替。

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

各组的成员生成方式由模板中的 `x-substore.members` 声明，覆写脚本不根据组名或其中的关键词推断行为。共同组的声明只在 `src/configs/base.yaml` 维护；Mihomo 的共同组补丁继承声明，仅新增的 oixCloud Optimized 组在差异文件中声明。字段和处理边界见[成员生成声明](#成员生成声明)。

当前普通组使用 `append`，全球直连组使用 `manual` 保留手工配置。亚太和美西两个中转组使用 `append` 并排除带 `dialer-proxy` 的注入节点；三个机场亚太组和良心云 Hy2 组使用 `replace` 并排除带 `dialer-proxy` 的注入节点。机场亚太组统一命名为“机场名 亚太”，只筛选 HK、SG、JP、TW，每次覆写重建成员，避免旧地区或已改为链式代理的节点残留。

| 代理组 | 额外限制 |
| --- | --- |
| `✈️ VikingLinks 亚太` | 名称含 VikingLinks，线路为 Go、IEPL 或 SH |
| `✈️ 良心云 亚太` | 名称含良心云及 `CT`（包括 `CTCU`、`CTCUCM`），实际协议仅限 VLESS |
| `✈️ 吹雪云 亚太` | 名称含吹雪云及“电信”，不限制协议 |
| `✈️ 良心云 Hy2` | 名称含良心云，实际协议仅限 `hysteria2` / `hy2`，排除带 `dialer-proxy` 的节点，每次覆写重建成员 |

协议筛选依据节点实际 `type`，不依据名称中的协议字样。修改重命名脚本的名称格式、关键词提取规则或订阅名后，检查最终名称仍能满足机场名、地区代码和线路关键词的筛选要求。

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

声明在构建后的 YAML 模板及 Sub-Store 节点注入过程中保留，覆写完成后从各组移除，不进入最终客户端配置。每次刷新都从远程模板重新执行节点注入与覆写，固定候选仍以模板为准。不要把已输出的客户端配置直接交给覆写脚本再次处理：它已不包含声明，会因缺少声明报错。脚本与配置应一起更新；使用自定义模板时，也需要为每个组补全声明。

## 资源链接

本仓库 `chiyuchia/proxy-config` 的两份 YAML 模板和三份 JavaScript 发布脚本使用 GitHub Releases 附件下载地址，例如：

```text
https://github.com/chiyuchia/proxy-config/releases/latest/download/mihomo.yaml
https://github.com/chiyuchia/proxy-config/releases/latest/download/config-overwrite.js
```

规则和其他源码资源使用 GitHub Raw 链接，默认读取 `master` 分支；`src/configs/` 下的文件是构建输入，不作为 Sub-Store 的远程模板：

```text
https://raw.githubusercontent.com/chiyuchia/proxy-config/{ref}/{path}
```

例如，自定义直连规则使用 `https://raw.githubusercontent.com/chiyuchia/proxy-config/master/rules/custom_direct.yaml`。修改链接时保留正确的仓库、版本和路径，并在发布后检查资源是否可访问。不要将本地 `dist/` 路径拼接成 Raw 下载地址。

其他仓库（如 `ACL4SSR`、`blackmatrix7` 和 `dler-io`）保留各自现有的 CDN 链接策略。

固定模板和脚本版本的用法见 README 的[固定版本](README.md#固定版本)。

## 本地验证

开发环境需要 Node.js 22 或更高版本及 npm。首次安装或锁文件更新后运行 `npm ci`；TypeScript、tsx、构建、格式化和测试依赖由 `package-lock.json` 固定，只用于本地开发与 CI。原生解析测试使用开发依赖 `@pkgship/mihomo` 提供的上游 Mihomo 内核；`npm ci` 应保留默认安装的平台可选依赖，不要使用 `--omit=optional`。构建工具和测试通过 tsx 执行，不依赖 Node.js 的原生 TypeScript 支持。Sub-Store 继续运行 JavaScript 发布文件并使用自带的 YAML 解析器。

发布流程测试还需要 Git 和 Bash；测试在临时目录中创建本地仓库并模拟 GitHub CLI，不需要 GitHub 凭据，不访问项目远端或创建真实 Release。

```bash
npm ci
npm run format
npm run build
npm run check
```

`npm run check` 依次检查格式、严格类型、配置源及脚本源码与 `dist/` 五份产物的一致性并执行测试，不会修改文件。可单独运行 `npm run typecheck` 检查类型，或运行 `npm test` 测试当前 TypeScript 源码与已有 YAML、JavaScript 产物；修改配置或源码后须先构建再做完整检查。GitHub Actions 对分支推送和 PR 依次执行 `npm ci`、`npm run build`、`npm run check`，同样包含类型检查；CI 从源码重新生成产物，无需提交 `dist/`。

`npm run build` 先完成全部内容的生成与检查，再写入五份产物，并清理已退役的 `dist/merge-config.js`；不会删除 `dist/` 中其他文件。`npm run build:check` 检查五份产物是否同步，并拒绝遗留的 `dist/merge-config.js`，不写入或删除文件。

`npm test` 默认使用 `@pkgship/mihomo` 安装的普通上游 Mihomo 执行原生解析回归，未设置 `MIHOMO_BIN` 时也会运行。若本地平台内核缺失，测试应失败，不会静默跳过。可用 `MIHOMO_BIN` 指定其他内核的绝对路径，例如已安装的 mihomo-oix：

```bash
MIHOMO_BIN=/absolute/path/to/mihomo-oix npm test
```

该回归从构建后的模板提取 `proxy-providers` 和 oixCloud Optimized 组，隔离其他分组、DNS 和规则等外部依赖，在不传 oix 凭据且 provider 文件不存在的临时目录中执行 `-t`，并验证移除 provider 后会失败。它只验证显式 `file` provider 与标准 `url-test` 组引用的静态解析，不证明 oix 接管、解密、订阅下载或正式启动成功，也不验证完整最终配置。

测试覆盖：

- 覆写输出移除内部声明后的类型，以及节点附加字段和其他配置字段的类型保留。
- 两种客户端的配置合并、共同代理组定义和候选顺序一致性，以及相同注入节点下的组成员一致性；仅排除 Mihomo 的 oixCloud provider、Optimized 组及相应 `use` 和菜单引用。
- 数组与代理组补丁、来源标记、节点保留、重复组名和无效引用等检查。
- 最终覆写后的名称、引用、中转与组成员混合循环、HTTP provider 地址检查，以及校验失败时输入对象和内部声明不变。
- 两份构建模板的 YAML 解析、来源标记与补丁移除、成员生成及运行时 provider 声明保留，以及远程模板加载、节点注入和最终覆写流程。
- 成员声明的字段校验、模式和默认值、组名变化不改变行为、声明在中间配置中的保留及最终移除，以及实际机场与中转节点筛选、协议限制、节点注入和覆写结果。
- 运行时 provider 声明的字段与名称校验、与本地定义的冲突、`use` 引用边界、声明在中间配置中的保留及最终移除，以及 Mihomo 文件 provider 与 Stash 无依赖的输出。
- 中转节点的地区识别、自建 SS 协议限制、符合条件节点的中转字段覆盖及其他节点原字段保留，以及自建保留原名和机场可选重命名后注入、覆写的完整流程。
- 重命名仅按节点名称识别地区、未知地区保留原名、保留全部地区并按内置热门地区优先排序，以及仅按原始节点名称过滤信息节点的行为。
- 重命名的固定格式、内置关键词与旗帜保留、按订阅和地区分组编号及单节点序号保留，以及覆写的无效筛选、正则状态、从合并结果重复生成和拒绝直接覆写最终输出。
- 自动发布的触发限制、已发布版本跳过、草稿重试、附件范围，以及过期构建检查和发布串行执行。

修改配置或脚本后，检查两种客户端的最终输出、规则集和策略组引用、组成员及候选顺序，不能只验证未注入节点的合并结果。有意调整行为时，同步更新测试预期。

发布后按 README 的[修改与更新](README.md#修改与更新)刷新输出，更新客户端订阅前先在 Sub-Store 预览节点和组成员。

## 提交规范

### 开发与发布流程

`master` 是稳定生产分支，只接纳已验证的更改。功能分支为可选项，仅在大型功能时使用；提交或合并前都需完成本地验证。

1. 修改文件，并按[本地验证](#本地验证)构建和检查结果；提交源码、配置和相关维护文件，`dist/` 产物保持忽略。
2. 检查差异，使用约定式提交格式手动执行 `git commit`。
3. 检查提交内容和 commit 信息，确认后再单独手动执行 `git push`。

提交和推送是两个独立步骤，不把提交视为已获准推送。

### 自动构建与发布

[GitHub Actions 工作流](.github/workflows/check.yml) 在分支 push 和 PR 上安装锁定的依赖、生成两份模板、构建三个脚本并执行完整检查。本地 `git commit` 不会触发远程工作流；仅推送到 `master` 且检查成功后，才自动发布 GitHub Release。其他分支和 PR 只构建与检查。

发布任务使用本次已验证的 `dist/mihomo.yaml`、`dist/stash.yaml`、`dist/config-overwrite.js`、`dist/dialer-proxy.js` 和 `dist/rename.js`，使用 `build-<SHA>` 标签创建 Release，`<SHA>` 为来源提交的完整 40 位 SHA。先创建草稿并上传两份 `.yaml` 和三份 `.js` 附件，附件齐全后再公开发布并设为 latest；附件下载地址不含 `dist/` 目录。产物不回写 `master`，也不产生额外的源码提交。

同一来源提交的 Release 已公开发布时，重跑跳过发布，不覆盖其附件；未完成的草稿可以重试上传。发布任务串行执行，并在发布前核对远端 `master` 是否仍指向来源提交；检查时发现分支已前进，旧运行跳过公开发布，由最新 push 的运行负责发布。模板与脚本作为同一 Release 的附件发布；不同时间读取 latest 仍可能跨越一次发布，需要匹配同一版本时使用 README 中的[固定版本地址](README.md#固定版本)。远程规则内容不属于这五个附件，仍按各自 URL 更新。

发布任务使用 `GITHUB_TOKEN`，并声明 `contents: write` 权限，无需另配个人访问令牌。仓库及组织的 Actions 权限策略和标签规则须允许创建对应标签、Release 及附件；不满足时，发布会失败。

推送后，在 Actions 中确认本次构建与发布成功，并在 Releases 中确认五个模板与脚本附件齐全，再按 README 的[修改与更新](README.md#修改与更新)刷新 Sub-Store。构建或发布失败时，脚本修改尚未完成发布，应先修复对应错误。接入地址、迁移方法和 Source code 压缩包的区别见 README 的[文件说明](README.md)与[接入 Sub-Store](README.md#接入-sub-store)。

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
