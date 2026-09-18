# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 仓库概述

这是一个代理配置仓库，用于管理基于规则的流量路由。Mihomo 和 Stash 使用公共 YAML 与客户端差异，由 Sub-Store 服务端脚本合并，再注入节点并覆写组成员。

## 核心配置文件

- [config/base.yaml](config/base.yaml)：两个客户端共用的网络设置、代理组、规则集和分流规则，公共配置只在这里维护。
- [config/mihomo.yaml](config/mihomo.yaml)：Mihomo 专用 DNS、嗅探、provider 和代理组差异。
- [config/stash.yaml](config/stash.yaml)：Stash 专用 DNS 和代理组差异。
- [scripts/merge-config.js](scripts/merge-config.js)：通过 `async main(config)` 在 Sub-Store 中读取公共配置和指定客户端差异，合并、检查并保留传入节点；必须排在 `config_overwrite.js` 之前执行。
- [config_overwrite.js](config_overwrite.js)：订阅转换后的覆写脚本，合并并去重代理组成员，按 `filter` 筛选节点；中转组和机场亚太组只使用不带 `dialer-proxy` 的节点，良心云 Hy2 和亚太组按实际协议重建成员，分别仅保留 Hy2 和 VLESS 节点。
- [rename.js](rename.js)：订阅节点重命名脚本。
- [custom_rule/](custom_rule/)：自定义规则集。

VikingLinks、良心云和吹雪云的机场亚太组统一命名为“机场名 亚太”，仅筛选 HK、SG、JP、TW，每次覆写都重建成员，避免旧节点残留。良心云亚太组另要求名称包含 `CT`（含 `CTCU`、`CTCUCM`），吹雪云亚太组另要求名称包含“电信”。

三份 YAML 是合并来源，需要配合订阅转换流程注入实际节点。覆写脚本还可通过 `oixCloudEdgePath` 参数补入 oixCloud provider 的订阅 URL；Mihomo 差异文件本身未填写该 URL。Sub-Store 接入步骤和补丁语法见 [README.md](README.md)。

根目录的 `mihomo_config.yaml` 和 `mihomo_config_stash.yaml` 只保留为迁移前快照，不随公共源文件更新；后续更改应写入 `config/`，不要继续维护两份快照。

## CDN 配置

规则集中的 GitHub 资源链接主要使用 JSDMirror CDN：

**格式转换：**
```
https://raw.githubusercontent.com/{user}/{repo}/{branch}/{path}
→ https://cdn.jsdmirror.com/gh/{user}/{repo}@{branch}/{path}
```

修改链接时保留正确的仓库、分支和文件路径，并检查资源是否可访问。

## Clash 规则优先级

**关键：** Clash 规则从上到下依次匹配，第一条匹配的规则生效。

**规则排序原则：**
1. 更具体的规则必须放在通用规则之前
2. 示例：YouTube 规则必须放在 Google 规则之前（否则 YouTube 域名会被 Google 规则匹配）

**正确顺序：**
```yaml
rules:
  - "RULE-SET,youtube,📹 油管视频"
  - "RULE-SET,google,📢 Google"
```

**错误顺序（YouTube 流量会被 Google 规则捕获）：**
```yaml
rules:
  - "RULE-SET,google,📢 Google"
  - "RULE-SET,youtube,📹 油管视频"
```

## 配置结构

公共 YAML 包含全局与网络配置、`proxy-groups`、`rule-providers` 和 `rules`；Mihomo 差异文件另有 `proxy-providers`。

- `proxy-groups` 定义节点选择、中转、地区、机场和服务分流组。
- `rule-providers` 定义远程规则集，`rules` 按顺序引用规则集和策略组。
- 修改组名或规则集名时，同步检查所有引用；最终以 `MATCH` 兜底。
- 普通映射递归合并，数组整体替换；`proxy-groups` 按 `name` 合并，数组局部修改使用脚本支持的补丁操作，保留规则和候选顺序。
- 公共文件保留 `$base: true`，差异文件保留正确的 `$profile` 标记；三个文件分别解析，不允许跨文件 YAML 锚点。
- 修改时分别验证两个客户端的合并结果和覆写后的节点成员。

## Git 工作流

**分支策略：**
- `master` - 稳定生产分支
- 功能分支 - 仅用于大型功能

**开发流程：**
1. 在本地进行开发，大型功能可使用功能分支
2. 提交或合并前充分测试
3. 确保 `master` 分支保持稳定
4. 推送是提交后的独立手动步骤

## 提交规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

**格式：** `<type>(<scope>): <subject>`

**类型：**
- `feat` - 新功能
- `fix` - Bug 修复
- `docs` - 文档更新
- `style` - 代码格式调整
- `refactor` - 重构
- `perf` - 性能优化
- `test` - 测试相关
- `chore` - 构建/工具变动
- `ci` - CI 配置

**常用范围：**
- `clash-rules` - Clash 规则配置
- `clash-config` - Clash 配置文件
- `cdn` - CDN 配置
- `docs` - 文档

**示例：**
```bash
git commit -m "feat(clash-config): 为所有服务分流组添加机场订阅选项"
```

## 文件结构

```
proxy-config/
├── config/
│   ├── base.yaml             # 公共配置，唯一维护入口
│   ├── mihomo.yaml           # Mihomo 差异
│   └── stash.yaml            # Stash 差异
├── scripts/
│   └── merge-config.js      # Sub-Store 服务端合并
├── mihomo_config.yaml        # 迁移前快照，不再维护
├── mihomo_config_stash.yaml  # 迁移前快照，不再维护
├── config_overwrite.js       # 订阅配置覆写
├── rename.js                 # 节点重命名
├── custom_rule/              # 自定义规则集
├── tests/                    # 合并与节点处理验证
├── README.md                 # Sub-Store 接入与日常维护
├── CLAUDE.md                 # 仓库工作指南
└── CONTRIBUTING.md           # 开发指南
```
