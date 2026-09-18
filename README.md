# 代理配置

Mihomo 和 Stash 共用一份基础配置，各自只维护差异。Sub-Store 在服务端读取 YAML 并合并，再使用现有覆写脚本处理节点，无需在本地生成完整配置。

| 文件 | 维护内容 |
| --- | --- |
| [config/base.yaml](config/base.yaml) | 公共网络设置、代理组、机场亚太筛选、规则集和分流规则 |
| [config/mihomo.yaml](config/mihomo.yaml) | Mihomo 的 DNS、嗅探、provider 和代理组差异 |
| [config/stash.yaml](config/stash.yaml) | Stash 的 DNS 和代理组差异 |
| [scripts/merge-config.js](scripts/merge-config.js) | Sub-Store 服务端拉取、合并与配置检查 |
| [config_overwrite.js](config_overwrite.js) | 按节点名称和实际协议重建组成员、去重和补充 provider URL |

## 接入 Sub-Store

适用于 Sub-Store 的 **“Mihomo 配置”文件类型**。Mihomo 与 Stash 分别保留一个输出文件，通过脚本的 `client` 参数选择差异配置。

先将本仓库的新文件发布到 GitHub 或你自己的 HTTP(S) 地址，确认 Sub-Store 服务端能够读取这些地址。本地尚未推送的修改不会生效。

文件类型继续使用“Mihomo 配置”，保留原来的订阅节点来源。如果旧 YAML 是文件的远程来源，将文件来源改为本地内容，填写非空模板 `{}`；如果旧 YAML 是一个模板处理操作，则移除该操作。三份新 YAML 由合并脚本自行下载，不需要逐份添加为文件来源。

然后按以下顺序配置处理操作：

1. 添加远程脚本 `scripts/merge-config.js`，通过下方的 URL 参数选择客户端。
2. 保留原来的节点注入操作（例如“从订阅添加节点”）。
3. 最后运行原有 `config_overwrite.js`，保留其已有参数。

```text
本地初始内容：{}
→ scripts/merge-config.js：读取 base.yaml + 客户端差异
→ 注入原有订阅节点
→ config_overwrite.js：重建代理组成员
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
https://raw.githubusercontent.com/chiyuchia/proxy-config/master/config_overwrite.js
```

Stash 输出不需要添加 `oixCloudEdgePath`；该参数会额外生成 oixCloud provider。

这两个 JavaScript 文件必须作为**两个独立的脚本操作**执行，它们分别提供 `main(config)`，不能拼接到同一个脚本中。Sub-Store 会等待异步 `main` 并将返回值序列化为 YAML，参见[官方脚本处理实现](https://github.com/sub-store-org/Sub-Store/blob/master/backend/src/core/proxy-utils/processors/index.js)。

首次切换后，在 Sub-Store 预览最终配置，确认原来的订阅节点仍在 `proxies` 中，并检查三个机场亚太组的成员，再更新客户端订阅。

### 脚本参数

| 参数 | 含义 |
| --- | --- |
| `client` | 必填，值为 `mihomo` 或 `stash` |
| `configBaseUrl` | 三份 YAML 的远程目录；默认 `https://raw.githubusercontent.com/chiyuchia/proxy-config/master/config` |
| `baseUrl` | 单独指定公共配置地址，优先于 `configBaseUrl` |
| `profileUrl` | 单独指定客户端差异地址，优先于 `configBaseUrl` |
| `timeout` | 每次请求的超时毫秒数，默认 `10000` |

参数放在脚本 URL 的 `#` 后，用 `&` 分隔。URL 参数值需要进行 URL 编码，例如使用自己的目录：

```text
https://example.com/scripts/merge-config.js#client=stash&configBaseUrl=https%3A%2F%2Fexample.com%2Fproxy-config%2Fconfig
```

需要固定版本时，将脚本 URL 和 `configBaseUrl` 一起固定到同一个 Git 提交，例如配置目录使用 `https://raw.githubusercontent.com/chiyuchia/proxy-config/<commit>/config`。仅固定脚本地址不会自动固定 YAML 版本。

合并脚本在远程请求失败、来源为空、客户端不匹配、补丁无效或配置引用错误时会报错，不会退回旧模板输出。

## 日常维护

- 两个客户端共同使用的规则、测速参数、机场亚太组筛选等，只改 `config/base.yaml`。
- 仅一个客户端使用的 DNS、provider 或候选顺序，改对应的 `config/mihomo.yaml` 或 `config/stash.yaml`。
- 节点协议筛选和组成员生成逻辑，改 `config_overwrite.js`。
- 修改后验证并发布文件，再让 Sub-Store 更新输出。远程资源和 Sub-Store 的缓存可能使刚发布的修改延迟生效。

`base.yaml` 需要保留 `$base: true`，两份差异文件分别保留 `$profile: mihomo` 和 `$profile: stash`。这些标记用于检查读取的文件是否正确，输出时会移除。三个文件分别解析，YAML 锚点只能引用同一文件内定义的锚点。

### 合并约定

普通映射递归合并，标量和普通数组由客户端差异覆盖。数组不会自动去重或排序，`rules` 和候选节点顺序保持原样。实际节点继续由 Sub-Store 注入，三份配置源不要定义顶层 `proxies`。

顶层 `proxy-groups` 按 `name` 合并：已有组只需写要修改的字段，新组默认追加到末尾。例如：

```yaml
$profile: stash
dns:
  nameserver:
    - https://doh.pub/dns-query
proxy-groups:
  - name: "✈️ 良心云 亚太"
    interval: 60
```

需要在公共数组上局部增删时，可以使用以下补丁操作：

```yaml
proxy-groups:
  - name: "🚀 节点选择"
    proxies:
      $prepend: ["✈️ VikingLinks 亚太"]
      $append: ["✈️ 良心云 亚太"]
      $remove: ["🌍 其他节点"]
  - name: "🍎 Apple Push"
    proxies:
      $insert-before:
        DIRECT: ["✈️ 吹雪云 亚太"]
```

用 `{ $delete: true }` 删除字段；删除代理组时保留 `name` 并添加 `$delete: true`。新增代理组可以用 `$before` 或 `$after` 指定相邻组名：

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

删除策略组时，也要同步修改其他组和规则中的引用。补丁字段只用于服务端合并，不会出现在最终客户端配置中。

## 旧模板

仓库根目录的 `mihomo_config.yaml` 和 `mihomo_config_stash.yaml` 保留为迁移前快照，供尚未切换的订阅继续读取。它们不会随 `config/` 的修改自动更新，也不再作为日常维护入口；请按上面的步骤迁移到服务端合并。

开发规范与验证说明见 [CONTRIBUTING.md](CONTRIBUTING.md)。
