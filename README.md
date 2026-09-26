# 代理配置

Mihomo 和 Stash 的共同代理组、候选顺序、筛选和测速设置统一维护在基础配置中，客户端差异仅保留 DNS、Mihomo 嗅探和 oixCloud provider 相关配置。构建时将公共配置与客户端差异合并为两份 YAML 模板；Sub-Store 读取模板、注入订阅节点，再运行覆写脚本输出完整配置。

| 文件 | 用途与维护位置 |
| --- | --- |
| [src/configs/base.yaml](src/configs/base.yaml) | 公共配置源：网络设置、全部共同代理组及其候选顺序、成员生成声明、筛选、测速设置、规则集和分流规则 |
| [src/configs/mihomo.yaml](src/configs/mihomo.yaml) | Mihomo 差异源：DNS、嗅探、oixCloud 文件 provider 声明、Optimized 组及相关 `use` 和菜单引用 |
| [src/configs/stash.yaml](src/configs/stash.yaml) | Stash 差异源：DNS 设置 |
| [mihomo.yaml](https://github.com/chiyuchia/proxy-config/releases/latest/download/mihomo.yaml) | 构建生成的 Mihomo 模板，作为 Sub-Store 的远程文件来源 |
| [stash.yaml](https://github.com/chiyuchia/proxy-config/releases/latest/download/stash.yaml) | 构建生成的 Stash 模板，作为 Sub-Store 的远程文件来源 |
| [config-overwrite.js](https://github.com/chiyuchia/proxy-config/releases/latest/download/config-overwrite.js) | 组成员筛选、去重和最终配置校验的发布脚本；源码在 [src/scripts/config-overwrite/](src/scripts/config-overwrite/) |
| [dialer-proxy.js](https://github.com/chiyuchia/proxy-config/releases/latest/download/dialer-proxy.js) | 为自建、oixCloud Edge 和一元机场节点按地区设置中转的发布脚本；源码在 [src/scripts/dialer-proxy/](src/scripts/dialer-proxy/) |
| [rename.js](https://github.com/chiyuchia/proxy-config/releases/latest/download/rename.js) | 地区识别、名称整理和关键词过滤的发布脚本；源码在 [src/scripts/rename/](src/scripts/rename/) |
| [src/scripts/shared/](src/scripts/shared/) | 脚本与构建工具共用的类型、配置声明校验和地区识别逻辑；维护位置见[贡献指南](CONTRIBUTING.md#修改位置) |

修改 `src/configs/` 中的配置源或 `src/scripts/` 中的 TypeScript 脚本源码后，在本地构建并验证；`dist/` 是被 Git 忽略的本地产物目录，不随源码提交。推送到 `master` 后，GitHub Actions 构建并检查两份 YAML 和三份 JavaScript，再将五个文件发布为 [GitHub Releases](https://github.com/chiyuchia/proxy-config/releases) 附件，详见[自动构建与发布](CONTRIBUTING.md#自动构建与发布)。Sub-Store 使用附件下载地址，无需安装开发依赖。Release 自动提供的 Source code 压缩包不包含 `dist/`；使用时下载对应的 `.yaml` 和 `.js` 附件。

## 接入 Sub-Store

适用于 Sub-Store 的 **“Mihomo 配置”文件类型**。Mihomo 与 Stash 分别保留一个输出文件，以不同的远程模板地址选择客户端。这两份 YAML 是供 Sub-Store 注入节点的模板，需要完成下述流程后输出给客户端。

确认所用版本已成功发布，且 Sub-Store 服务端能够读取下方的 GitHub Releases 附件；也可以使用自行托管的 HTTP(S) 地址。本地尚未推送或尚未完成发布的模板、脚本修改不会生效。

升级到此版本时，删除旧的 `merge-config.js` 合并操作及本地 `{}` 来源，将文件来源改为对应的远程 YAML 模板。旧合并脚本的参数随操作一起移除；节点注入和最终覆写操作保留在远程模板加载之后。原来指向 `scripts/` 或 `dist/` 的 JavaScript Raw 地址也应替换为 Releases 下载地址，新版本不再提供旧合并脚本或兼容入口。

1. 创建“Mihomo 配置”文件，将文件来源设为**远程**，填写下方对应客户端的 YAML 地址，参见 [Sub-Store 文件说明](https://sub-store-org.github.io/doc/file/overview)。不要将 `src/configs/base.yaml` 或客户端差异源直接用作文件来源。
2. 配置订阅节点来源与节点注入操作（例如“从订阅添加节点”）；先在各自来源订阅中完成[节点中转](#节点中转)等处理。自建节点保留原名；oixCloud Edge 和一元机场设置中转后可按需[重命名](#节点重命名)。
3. 最后运行远程脚本 `config-overwrite.js`，无需参数；脚本重建代理组成员并校验最终配置。额外的配置修改放在模板加载之后、最终覆写之前。

```text
远程 mihomo.yaml / stash.yaml 模板
→ 注入已在来源订阅中处理的节点
→ config-overwrite.js：重建代理组成员、校验最终配置、移除内部声明
→ Sub-Store 输出完整 YAML
```

Mihomo 的远程模板地址：

```text
https://github.com/chiyuchia/proxy-config/releases/latest/download/mihomo.yaml
```

Stash 的远程模板地址：

```text
https://github.com/chiyuchia/proxy-config/releases/latest/download/stash.yaml
```

覆写脚本地址：

```text
https://github.com/chiyuchia/proxy-config/releases/latest/download/config-overwrite.js
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

`config-overwrite.js` 在文件的脚本操作中提供 `main(config)`；来源订阅中的节点脚本使用 `operator`，不要拼接到同一个操作中。Sub-Store 会调用 `main` 并将返回值序列化为 YAML，参见[官方脚本处理实现](https://github.com/sub-store-org/Sub-Store/blob/master/backend/src/core/proxy-utils/processors/index.js)。

代理组通过模板中的 `x-substore.members` 声明成员生成方式，构建后的 YAML 保留这些声明，覆写在最终输出前移除。每次刷新都应从远程模板重新注入节点并覆写，不能直接对上次输出再次覆写。新增组和声明字段的说明见[贡献指南的成员生成声明](CONTRIBUTING.md#成员生成声明)。

最终校验随覆写脚本直接在 Sub-Store 中运行，无需另加脚本或安装依赖。发现重复名称、无效引用、依赖循环或无效 HTTP provider 地址时，本次脚本报错并停止输出；具体范围和限制见[贡献指南的最终配置校验](CONTRIBUTING.md#最终配置校验)。

首次切换后，在 Sub-Store 预览最终配置，确认原来的订阅节点仍在 `proxies` 中，并检查三个机场亚太组的成员，再更新客户端订阅。

### 固定版本

需要固定版本时，选择已发布的 `build-<SHA>` Release，其中 `<SHA>` 是构建来源的完整 40 位源码提交 SHA。将所用模板和脚本的 `releases/latest/download/` 地址全部改为同一标签下的 `releases/download/build-<SHA>/` 地址：

```text
https://github.com/chiyuchia/proxy-config/releases/download/build-<SHA>/mihomo.yaml
https://github.com/chiyuchia/proxy-config/releases/download/build-<SHA>/stash.yaml
https://github.com/chiyuchia/proxy-config/releases/download/build-<SHA>/config-overwrite.js
https://github.com/chiyuchia/proxy-config/releases/download/build-<SHA>/dialer-proxy.js
https://github.com/chiyuchia/proxy-config/releases/download/build-<SHA>/rename.js
```

根据客户端选择一份模板，所有使用到的脚本与模板固定到同一 Release。默认的 `latest` 下载地址会随新版本更新；多次下载可能跨越一次发布，需要严格匹配时应固定标签。模板中的规则集 URL 仍按各自来源更新，固定这五个附件不会同时固定远程规则内容。

## 节点中转

在 Sub-Store 的**各自来源订阅**中添加远程脚本操作，替换原有设置 `dialer-proxy` 的内联脚本。自建节点、oixCloud Edge 和一元机场使用同一个地址，无需参数：

```text
https://github.com/chiyuchia/proxy-config/releases/latest/download/dialer-proxy.js
```

脚本通过 `operator(proxies, targetPlatform, context)` 设置中转，无需选择模式，也不要求名称包含“落地”。订阅名 `_subName` 为“自建节点”时视为自建，仅处理实际 `type` 为 `ss` 的节点（不区分大小写）；其他协议或缺少 `type` 的自建节点保持原样，包括已有 `dialer-proxy`。其他来源节点不限协议，不根据节点名称判断是否自建。

符合条件的节点按地区分配中转：

| 节点地区 | `dialer-proxy` |
| --- | --- |
| 美国 | `🛡️ 美西中转` |
| 其他地区或无法识别 | `🛡️ 亚太中转` |

中转与重命名脚本共用名称地区识别逻辑，支持地区代码（如 `US`、`us`）、中文名、英文名、国旗和已有城市别名；不根据服务器地址或订阅名推断地区，也不联网查询。符合条件节点的已有 `dialer-proxy` 会被覆盖，原节点名称、顺序及其他字段保留。旧地址中的 `mode` 参数不再使用，可直接移除；配置中仅保留亚太和美西两个中转组。

自建节点保留原名，不经过重命名脚本：

```text
自建原始节点
→ dialer-proxy.js：仅为 SS 节点按地区设置中转，保留原名
→ 供“Mihomo 配置”文件注入并执行覆写
```

oixCloud Edge 和一元机场分别在各自来源订阅中设置中转，可按需整理名称：

```text
机场原始节点
→ dialer-proxy.js：按地区设置中转
→ rename.js：按需整理名称
→ 供“Mihomo 配置”文件注入并执行覆写
```

机场分组依赖最终节点名中的 `oixCloud Edge` 或“一元机场”，使用重命名脚本时可通过对应的 `_subName` 保留机场名。

重命名脚本只过滤原始节点名称，不检查 `_subName`，因此订阅名为“一元机场”不影响节点保留。完成注入和覆写后，在两种客户端的最终配置中检查 `dialer-proxy`、中转组和机场组成员。

## 节点重命名

在 Sub-Store 的**订阅或组合订阅**中添加远程脚本操作，使用以下地址，无需参数：

```text
https://github.com/chiyuchia/proxy-config/releases/latest/download/rename.js
```

该脚本通过 `async operator(proxies, targetPlatform, context)` 处理节点数组。自建节点不使用此脚本；oixCloud Edge 和一元机场如需重命名，在各自来源订阅中先完成[节点中转](#节点中转)，再执行此脚本。之后由“Mihomo 配置”文件注入处理后的节点，并运行 `config-overwrite.js`。文件中的覆写脚本使用 `main(config)`，`dialer-proxy.js` 和 `rename.js` 应分别配置为订阅中的独立节点处理操作。

脚本使用固定的重命名规则，不读取外部脚本参数，旧地址中的参数可直接移除。先按内置词表过滤信息节点，再仅从节点名称识别地区，无需联网解析或查询；不按地区删除节点，无法识别地区时保留原名。

已识别节点固定输出 `国旗 地区代码 序号 | 保留关键词 订阅名`，序号按 `_subName` 与地区分组，从 `01` 重新生成，至少保留两位，即使只有一个节点也保留序号，空的后缀部分会省略。订阅名来自节点的 `_subName` 字段。以下例子各自作为所属分组的第一个节点：

| 原节点名 | `_subName` | 输出 |
| --- | --- | --- |
| `🇯🇵 JP-SH-12-GCP` | `VikingLinks` | `🇯🇵 JP 01 \| SH GCP VikingLinks` |
| `🇯🇵日本高速01\|CTCU\|0.5x` | `良心云` | `🇯🇵 JP 01 \| 高速 CTCU 0.5x 良心云` |
| `香港 03` | 无 | `🇭🇰 HK 01` |

保留城市、线路、运营商等内置关键词；VikingLinks 格式会保留线路和服务商，良心云格式会保留运营商组合及倍率标签。结果按内置热门地区优先排序，各类内部按地区代码和名称排序，未识别地区的节点放到最后。

内置过滤词为：`过期、剩余、官网、套餐、重置、到期、Traffic、Expire、一元机场、客户端、网站`。它们只按原始节点名称中的字面子串匹配，不区分大小写，不检查 `_subName`。

修改名称格式、关键词提取规则或订阅名后，检查最终名称是否仍满足 `src/configs/base.yaml` 中代理组对机场名、地区代码和线路关键词的筛选要求。

## 修改与更新

修改配置或脚本前，请阅读 [贡献指南](CONTRIBUTING.md)，其中说明了修改位置、配置合并与补丁语法、测速参数复用、规则约束、验证方法和提交规范。

本地 `git commit` 不会触发 GitHub Actions；推送到 `master` 后才会自动构建、检查并发布 Release 附件。确认发布成功后，再让 Sub-Store 重新生成输出并更新客户端订阅。远程资源和 Sub-Store 的缓存可能使刚发布的修改延迟生效。

各 Agent 共用的工作指令维护在 [AGENTS.md](AGENTS.md)；[CLAUDE.md](CLAUDE.md) 通过 `@AGENTS.md` 导入。使用说明和参数维护在本 README，详细开发规范维护在 CONTRIBUTING。
