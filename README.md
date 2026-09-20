# 代理配置

Mihomo 和 Stash 的共同代理组、候选顺序、筛选和测速设置统一维护在基础配置中，客户端差异仅保留 DNS、Mihomo 嗅探和 oixCloud provider 相关配置。Sub-Store 在服务端读取 YAML 并合并，再使用现有覆写脚本处理节点，无需在本地生成完整配置。

| 文件 | 维护内容 |
| --- | --- |
| [configs/base.yaml](configs/base.yaml) | 公共网络设置、全部共同代理组及其候选顺序、成员生成声明、筛选、测速设置、规则集和分流规则 |
| [configs/mihomo.yaml](configs/mihomo.yaml) | Mihomo 的 DNS、嗅探、oixCloud 文件 provider 声明、Optimized 组及相关 `use` 和菜单引用 |
| [configs/stash.yaml](configs/stash.yaml) | Stash 的 DNS 差异 |
| [scripts/merge-config.js](scripts/merge-config.js) | 服务端拉取、合并与配置检查的发布脚本；源码在 [src/merge-config/](src/merge-config/) |
| [scripts/config-overwrite.js](scripts/config-overwrite.js) | 组成员筛选、去重和最终配置校验的发布脚本；源码在 [src/config-overwrite/](src/config-overwrite/) |
| [scripts/dialer-proxy.js](scripts/dialer-proxy.js) | 为自建落地、oixCloud Edge 和一元机场节点设置中转的发布脚本；源码在 [src/dialer-proxy/](src/dialer-proxy/) |
| [scripts/rename.js](scripts/rename.js) | 地区识别、名称整理和关键词过滤的发布脚本；源码在 [src/rename/](src/rename/) |

维护脚本时修改 `src/` 中的 TypeScript 源码，在本地构建并验证；类型检查、工具和测试用法见[贡献指南的脚本开发](CONTRIBUTING.md#脚本开发)。推送到 `master` 后由 GitHub Actions 自动构建并发布 `scripts/`，详见[自动构建与发布](CONTRIBUTING.md#自动构建与发布)。Sub-Store 继续使用下方四个 JavaScript 单文件地址，无需安装开发依赖。

## 接入 Sub-Store

适用于 Sub-Store 的 **“Mihomo 配置”文件类型**。Mihomo 与 Stash 分别保留一个输出文件，通过脚本的 `client` 参数选择差异配置。

先将本仓库的新文件发布到 GitHub 或你自己的 HTTP(S) 地址，确认 Sub-Store 服务端能够读取这些地址。本地尚未推送的修改不会生效。

文件类型使用“Mihomo 配置”，文件来源设为本地内容，填写非空初始内容 `{}`，并配置订阅节点来源。三份 YAML 由合并脚本自行下载，不需要逐份添加为文件来源或添加模板处理操作。

然后按以下顺序配置处理操作：

1. 添加远程脚本 `scripts/merge-config.js`，通过下方的 URL 参数选择客户端。
2. 配置节点注入操作（例如“从订阅添加节点”）；先在各自来源订阅中完成[节点中转](#节点中转)等处理。自建节点保留原名；oixCloud Edge 和一元机场设置中转后可按需[重命名](#节点重命名)。
3. 最后运行 `scripts/config-overwrite.js`，无需参数；脚本完成覆写后自动校验最终配置。

```text
本地初始内容：{}
→ scripts/merge-config.js：读取 base.yaml + 客户端差异
→ 注入已在来源订阅中处理的节点
→ scripts/config-overwrite.js：重建代理组成员、校验最终配置、移除内部声明
→ Sub-Store 输出完整 YAML
```

若现有节点注入操作位于合并脚本之前，也可以保留：合并脚本会保留传入的 `config.proxies`。输入中的其他配置由合并结果替换；需要额外修改配置时，将相应操作放在合并之后、最终覆写脚本之前，以便检查完整结果。

Mihomo 的远程脚本地址：

```text
https://raw.githubusercontent.com/chiyuchia/proxy-config/master/scripts/merge-config.js#client=mihomo
```

Stash 的远程脚本地址：

```text
https://raw.githubusercontent.com/chiyuchia/proxy-config/master/scripts/merge-config.js#client=stash
```

覆写脚本地址：

```text
https://raw.githubusercontent.com/chiyuchia/proxy-config/master/scripts/config-overwrite.js
```

本仓库的 Mihomo 配置依赖 OpenClash 中已启用的 oix 运行时。模板预定义以下文件 provider，使下载后的独立内核检查能解析 `use: [oixCloud]`，不依赖测试进程携带 oix 凭据：

```yaml
proxy-providers:
  oixCloud:
    type: file
    path: ./proxy_provider/oixCloud
```

[内核 `-t` 检查](https://github.com/vernesong/mihomo-oix/blob/cd52e9e2facb5523e76526896a6abf283fddc858/main.go#L208-L224)不要求这个文件已经存在；Sub-Store 也不会读取或检查客户端文件。正式启动仍需启用 oix，由内核[接管同名 provider](https://github.com/vernesong/mihomo-oix/blob/cd52e9e2facb5523e76526896a6abf283fddc858/component/oix/oix.go#L199-L236)、生成并管理文件和解密密钥，模板无需填写订阅 URL 或密钥。上述声明只解决配置解析，不提供离线订阅内容。Stash 配置没有这项 provider 和依赖。

如需自行管理其他 HTTP provider，在配置中显式定义其有效 `url`，并按需添加组内 `use` 引用。

这两个 JavaScript 文件必须作为**两个独立的脚本操作**执行，它们分别提供 `main(config)`，不能拼接到同一个脚本中。Sub-Store 会等待异步 `main` 并将返回值序列化为 YAML，参见[官方脚本处理实现](https://github.com/sub-store-org/Sub-Store/blob/master/backend/src/core/proxy-utils/processors/index.js)。

代理组通过模板中的 `x-substore.members` 声明成员生成方式，覆写不再根据组名决定行为；声明在最终输出前移除。每次刷新都应重新执行合并与覆写，不能直接对上次输出再次覆写。新增组和声明字段的说明见[贡献指南的成员生成声明](CONTRIBUTING.md#成员生成声明)。

最终校验随覆写脚本直接在 Sub-Store 中运行，无需另加脚本或安装依赖。发现重复名称、无效引用、依赖循环或无效 HTTP provider 地址时，本次脚本报错并停止输出；具体范围和限制见[贡献指南的最终配置校验](CONTRIBUTING.md#最终配置校验)。

首次切换后，在 Sub-Store 预览最终配置，确认原来的订阅节点仍在 `proxies` 中，并检查三个机场亚太组的成员，再更新客户端订阅。

### 合并脚本参数

| 参数 | 含义 |
| --- | --- |
| `client` | 必填，值为 `mihomo` 或 `stash` |
| `configBaseUrl` | 三份 YAML 的远程目录；默认 `https://raw.githubusercontent.com/chiyuchia/proxy-config/master/configs` |
| `baseUrl` | 单独指定公共配置地址，优先于 `configBaseUrl` |
| `profileUrl` | 单独指定客户端差异地址，优先于 `configBaseUrl` |
| `timeout` | 每次请求的超时毫秒数，默认 `10000` |
| `noCache` | 默认 `true`；仅接受布尔值或字符串 `true` / `false`。请求 YAML 时要求缓存重新验证，GitHub Raw 地址还会附加动态刷新参数；设为 `false` 可关闭 |

参数放在脚本 URL 的 `#` 后，用 `&` 分隔。URL 参数值需要进行 URL 编码，例如使用自己的目录：

```text
https://example.com/scripts/merge-config.js#client=stash&configBaseUrl=https%3A%2F%2Fexample.com%2Fproxy-config%2Fconfigs
```

YAML 请求刷新默认开启，无需额外参数。若还需跳过 Sub-Store 的脚本下载缓存，使用：

```text
https://raw.githubusercontent.com/chiyuchia/proxy-config/master/scripts/merge-config.js#client=mihomo#noCache
```

合并脚本的 `noCache` 参数控制内部 YAML 请求，可显式添加 `&noCache=false` 关闭；末尾 `#noCache` 是 Sub-Store 的脚本资源下载选项，两者互不替代。需要使用已发布且支持该默认行为的脚本版本；仍固定到旧版本时，仅追加参数不会生效。

启用后，公共配置和客户端差异的请求都会携带 `Cache-Control: no-cache`。主机名为 `raw.githubusercontent.com` 的地址额外附加动态 `_substore_refresh` 查询参数，同一次合并共用一个值，后续合并使用新值；通过 `baseUrl`、`profileUrl` 显式指定的 GitHub Raw 地址也适用。其他自定义域名只添加请求头，保留 URL 原样以兼容签名地址。该选项降低旧缓存命中的可能性，不保证所有 CDN 即时更新，也不保证跟随分支的两份 YAML 来自同一提交。

需要固定版本时，选择已包含对应构建产物的 Git 提交，将所用脚本 URL 和 `configBaseUrl` 一起固定到该提交，例如配置目录使用 `https://raw.githubusercontent.com/chiyuchia/proxy-config/<commit>/configs`。若源码提交由机器人补充发布产物，应选择机器人的发布提交；仅固定脚本地址不会自动固定 YAML 版本。

合并脚本在远程请求失败、来源为空、客户端不匹配、补丁无效或配置引用错误时会报错并停止生成配置。

## 节点中转

在 Sub-Store 的**各自来源订阅**中添加远程脚本操作，替换原有设置 `dialer-proxy` 的内联脚本。该脚本通过 `operator(proxies, targetPlatform, context)` 处理当前输入节点，必须用 `mode` 参数明确选择行为，不根据订阅名推断模式。

自建节点使用：

```text
https://raw.githubusercontent.com/chiyuchia/proxy-config/master/scripts/dialer-proxy.js#mode=self-hosted
```

oixCloud Edge 和一元机场在各自订阅中使用同一个地址：

```text
https://raw.githubusercontent.com/chiyuchia/proxy-config/master/scripts/dialer-proxy.js#mode=edge
```

| `mode` | 行为 |
| --- | --- |
| `self-hosted` | 名称同时包含“落地”和 `SG` 时设置 `dialer-proxy: 🛡️ 亚太中转`；其他包含“落地”的节点设置 `dialer-proxy: 🛡️ 美西中转`；不含“落地”的节点保持不变 |
| `edge` | 为当前输入订阅的全部节点设置 `dialer-proxy: 🛡️ Edge 中转` |

`mode` 必填，只接受上述两个值。自建模式按原节点名进行区分大小写的字面子串匹配，`sg` 不等于 `SG`。命中时覆盖已有 `dialer-proxy`；未命中时保留已有值及其他节点字段。`edge` 模式应用于全部输入节点，因此应分别放在 oixCloud Edge、一元机场来源订阅中。

自建节点保留原名，不经过重命名脚本：

```text
自建原始节点
→ scripts/dialer-proxy.js#mode=self-hosted：设置中转，保留原名
→ 供“Mihomo 配置”文件注入并执行覆写
```

oixCloud Edge 和一元机场分别在各自来源订阅中设置中转，可按需整理名称：

```text
机场原始节点
→ scripts/dialer-proxy.js#mode=edge：设置中转
→ scripts/rename.js：按需整理名称
→ 供“Mihomo 配置”文件注入并执行覆写
```

机场分组依赖最终节点名中的 `oixCloud Edge` 或“一元机场”，使用重命名脚本时可通过对应的 `_subName` 保留机场名。

重命名脚本的默认过滤词包含“一元机场”。若该机场的原始节点名包含这几个字且需要保留，可按[重命名脚本参数](#重命名脚本参数)使用 JSON 参数 `{"filter":""}` 禁用该来源订阅的过滤；仅 `_subName` 含“一元机场”无需因此禁用过滤。完成注入和覆写后，在两种客户端的最终配置中检查 `dialer-proxy`、中转组和机场组成员。

## 节点重命名

在 Sub-Store 的**订阅或组合订阅**中添加远程脚本操作，使用以下地址：

```text
https://raw.githubusercontent.com/chiyuchia/proxy-config/master/scripts/rename.js
```

该脚本通过 `async operator(proxies, targetPlatform, context)` 处理节点数组。自建节点不使用此脚本；oixCloud Edge 和一元机场如需重命名，在各自来源订阅中先完成[节点中转](#节点中转)，再执行此脚本。之后由“Mihomo 配置”文件注入处理后的节点，并运行 `scripts/config-overwrite.js`。文件中的合并与覆写脚本使用 `main(config)`，`dialer-proxy.js` 和 `rename.js` 应分别配置为订阅中的独立节点处理操作。

脚本先过滤信息节点，再仅从节点名称识别地区，无需联网解析或查询。名称无法识别时保留原名，`one` 参数的序号处理仍会独立生效。

默认输出 `国旗 地区代码 序号 | 保留关键词 订阅名`，序号按 `_subName` 与地区分组，从 `01` 重新生成，空的后缀部分会省略。订阅名来自节点的 `_subName` 字段。以下例子各自作为所属分组的第一个节点：

| 原节点名 | `_subName` | 默认输出 |
| --- | --- | --- |
| `🇯🇵 JP-SH-12-GCP` | `VikingLinks` | `🇯🇵 JP 01 \| SH GCP VikingLinks` |
| `🇯🇵日本高速01\|CTCU\|0.5x` | `良心云` | `🇯🇵 JP 01 \| 高速 CTCU 0.5x 良心云` |
| `香港 03` | 无 | `🇭🇰 HK 01` |

默认保留城市、线路、运营商等内置关键词；VikingLinks 格式会保留线路和服务商，良心云格式会保留运营商组合及倍率标签。结果按内置热门地区优先排序，各类内部按地区代码和名称排序，未识别地区的节点放到最后。

### 重命名脚本参数

下表描述传入 `$arguments` 后的值。包含布尔值或空字符串时，请使用下方的 JSON 参数写法。

| 参数 | 默认值 | 含义 |
| --- | --- | --- |
| `remove` | `true` | 替换原节点名；`false` 保留完整原名，追加在地区标签和序号后 |
| `filter` | 内置词表 | 名称包含过滤词时丢弃节点，不区分大小写；自定义词用 `\|` 分隔并追加到内置词表；空字符串 `""` 禁用过滤 |
| `block` | 不启用 | 识别地区前从名称中去除匹配内容，支持正则表达式，忽略大小写并全局替换；不修改输出中的原名或关键词 |
| `one` | `false` | 去掉两位序号后的完整名称唯一时，移除其中的 `01`；判断包含关键词和订阅名，并非只按地区计数 |
| `hot` | 不过滤 | `true` / `1` 仅保留 `HK/TW/CN/JP/SG/US`；字符串如 `HK\|SG\|JP` 仅保留指定地区；启用后未识别地区的节点也会丢弃 |
| `retain` | 启用内置关键词 | `remove=true` 时生效；`false` / `0` 禁用保留；字符串如 `IPLC\|专线` 在内置规则上追加关键词 |
| `out` | `FG\|EN` | 按顺序组合 `FG`（旗帜）、`ZH`（中文名）、`EN`（地区代码）、`QC`（英文全称）；忽略无效项，全无效时回退默认值 |

内置过滤词为：`过期、剩余、官网、套餐、重置、到期、Traffic、Expire、一元机场、客户端、网站`。它们按名称中的字面子串匹配；`block` 则按正则表达式处理。`hot` 的自定义值若没有任何有效地区代码，会使用内置热门地区列表。

仅保留香港、新加坡、日本，并显示旗帜与地区代码：

```text
https://raw.githubusercontent.com/chiyuchia/proxy-config/master/scripts/rename.js#hot=HK%7CSG%7CJP&out=FG%7CEN
```

Sub-Store 的普通 `#key=value` 参数会将值传为字符串，且把 `filter=` 这样的空值转成 `true`；因此 `remove=false`、`one=false`、`hot=false` 不能按布尔值关闭对应行为，`filter=` 也不能禁用过滤。布尔值或空字符串应使用 `#` 加 URL 编码后的 JSON，参见[官方参数解析实现](https://github.com/sub-store-org/Sub-Store/blob/master/backend/src/core/proxy-utils/index.js)。例如，保留完整原名并禁用信息节点过滤，参数对象为：

```json
{"remove": false, "filter": ""}
```

对应的可直接使用地址：

```text
https://raw.githubusercontent.com/chiyuchia/proxy-config/master/scripts/rename.js#%7B%22remove%22%3Afalse%2C%22filter%22%3A%22%22%7D
```

其他组合也可用 `encodeURIComponent(JSON.stringify(参数对象))` 生成 URL 片段。默认参数无需填写。修改 `out`、`retain` 或订阅名后，检查最终名称是否仍满足 `configs/base.yaml` 中代理组对机场名、地区代码和线路关键词的筛选要求。

## 修改与更新

修改配置或脚本前，请阅读 [贡献指南](CONTRIBUTING.md)，其中说明了修改位置、配置合并与补丁语法、测速参数复用、规则约束、验证方法和提交规范。

推送到 `master` 后，等待 GitHub Actions 自动构建与发布成功，再让 Sub-Store 重新生成输出并更新客户端订阅。远程资源和 Sub-Store 的缓存可能使刚发布的修改延迟生效。

各 Agent 共用的工作指令维护在 [AGENTS.md](AGENTS.md)；[CLAUDE.md](CLAUDE.md) 通过 `@AGENTS.md` 导入。使用说明和参数维护在本 README，详细开发规范维护在 CONTRIBUTING。
