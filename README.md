# 代理配置

Mihomo 和 Stash 的共同代理组、候选顺序、筛选和测速设置统一维护在基础配置中，客户端差异仅保留 DNS、Mihomo 嗅探和 oixCloud provider 相关配置。Sub-Store 在服务端读取 YAML 并合并，再使用现有覆写脚本处理节点，无需在本地生成完整配置。

| 文件 | 维护内容 |
| --- | --- |
| [configs/base.yaml](configs/base.yaml) | 公共网络设置、全部共同代理组及其候选顺序、筛选、测速设置、规则集和分流规则 |
| [configs/mihomo.yaml](configs/mihomo.yaml) | Mihomo 的 DNS、嗅探、oixCloud provider、Optimized 组及相关 `use` 和菜单引用 |
| [configs/stash.yaml](configs/stash.yaml) | Stash 的 DNS 差异 |
| [scripts/merge-config.js](scripts/merge-config.js) | Sub-Store 服务端拉取、合并与配置检查 |
| [scripts/config-overwrite.js](scripts/config-overwrite.js) | 按节点名称和实际协议重建组成员、去重和补充 provider URL |
| [scripts/rename.js](scripts/rename.js) | 订阅节点地区识别、名称整理、关键词保留与过滤 |

## 接入 Sub-Store

适用于 Sub-Store 的 **“Mihomo 配置”文件类型**。Mihomo 与 Stash 分别保留一个输出文件，通过脚本的 `client` 参数选择差异配置。

先将本仓库的新文件发布到 GitHub 或你自己的 HTTP(S) 地址，确认 Sub-Store 服务端能够读取这些地址。本地尚未推送的修改不会生效。

文件类型使用“Mihomo 配置”，文件来源设为本地内容，填写非空初始内容 `{}`，并配置订阅节点来源。三份 YAML 由合并脚本自行下载，不需要逐份添加为文件来源或添加模板处理操作。

然后按以下顺序配置处理操作：

1. 添加远程脚本 `scripts/merge-config.js`，通过下方的 URL 参数选择客户端。
2. 配置节点注入操作（例如“从订阅添加节点”）；需要整理节点名称时，先在来源订阅中配置[节点重命名](#节点重命名)。
3. 最后运行原有 `scripts/config-overwrite.js`，保留其已有参数。

```text
本地初始内容：{}
→ scripts/merge-config.js：读取 base.yaml + 客户端差异
→ 注入原有订阅节点
→ scripts/config-overwrite.js：重建代理组成员
→ Sub-Store 输出完整 YAML
```

若现有节点注入操作位于合并脚本之前，也可以保留：合并脚本会保留传入的 `config.proxies`。输入中的其他配置由合并结果替换；需要额外修改配置时，将相应覆写放在合并之后。

Mihomo 的远程脚本地址：

```text
https://raw.githubusercontent.com/chiyuchia/proxy-config/master/scripts/merge-config.js#client=mihomo
```

Stash 的远程脚本地址：

```text
https://raw.githubusercontent.com/chiyuchia/proxy-config/master/scripts/merge-config.js#client=stash
```

原有覆写脚本地址（Mihomo 原来使用的 `oixCloudEdgePath` 参数继续放在此脚本上）：

```text
https://raw.githubusercontent.com/chiyuchia/proxy-config/master/scripts/config-overwrite.js
```

Stash 输出不需要添加 `oixCloudEdgePath`；该参数会额外生成 oixCloud provider。

这两个 JavaScript 文件必须作为**两个独立的脚本操作**执行，它们分别提供 `main(config)`，不能拼接到同一个脚本中。Sub-Store 会等待异步 `main` 并将返回值序列化为 YAML，参见[官方脚本处理实现](https://github.com/sub-store-org/Sub-Store/blob/master/backend/src/core/proxy-utils/processors/index.js)。

首次切换后，在 Sub-Store 预览最终配置，确认原来的订阅节点仍在 `proxies` 中，并检查三个机场亚太组的成员，再更新客户端订阅。

### 合并脚本参数

| 参数 | 含义 |
| --- | --- |
| `client` | 必填，值为 `mihomo` 或 `stash` |
| `configBaseUrl` | 三份 YAML 的远程目录；默认 `https://raw.githubusercontent.com/chiyuchia/proxy-config/master/configs` |
| `baseUrl` | 单独指定公共配置地址，优先于 `configBaseUrl` |
| `profileUrl` | 单独指定客户端差异地址，优先于 `configBaseUrl` |
| `timeout` | 每次请求的超时毫秒数，默认 `10000` |

参数放在脚本 URL 的 `#` 后，用 `&` 分隔。URL 参数值需要进行 URL 编码，例如使用自己的目录：

```text
https://example.com/scripts/merge-config.js#client=stash&configBaseUrl=https%3A%2F%2Fexample.com%2Fproxy-config%2Fconfigs
```

需要固定版本时，将脚本 URL 和 `configBaseUrl` 一起固定到同一个 Git 提交，例如配置目录使用 `https://raw.githubusercontent.com/chiyuchia/proxy-config/<commit>/configs`。仅固定脚本地址不会自动固定 YAML 版本。

合并脚本在远程请求失败、来源为空、客户端不匹配、补丁无效或配置引用错误时会报错并停止生成配置。

## 节点重命名

在 Sub-Store 的**订阅或组合订阅**中添加远程脚本操作，使用以下地址：

```text
https://raw.githubusercontent.com/chiyuchia/proxy-config/master/scripts/rename.js
```

该脚本通过 `async operator(proxies, targetPlatform, context)` 处理节点数组。先在来源订阅中完成重命名，再由“Mihomo 配置”文件注入处理后的节点，并运行 `scripts/config-overwrite.js`。文件中的合并与覆写脚本使用 `main(config)`，`rename.js` 应配置在订阅的节点处理流程中。

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

修改通过验证并发布后，让 Sub-Store 重新生成输出，再更新客户端订阅。远程资源和 Sub-Store 的缓存可能使刚发布的修改延迟生效。

各 Agent 共用的工作指令维护在 [AGENTS.md](AGENTS.md)；[CLAUDE.md](CLAUDE.md) 通过 `@AGENTS.md` 导入。使用说明和参数维护在本 README，详细开发规范维护在 CONTRIBUTING。
