# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 仓库概述

这是一个代理配置仓库，用于管理基于规则的流量路由。主要维护 Mihomo 和 Stash 的 YAML 模板、订阅处理脚本及自定义规则集。

## 核心配置文件

- [mihomo_config.yaml](mihomo_config.yaml)：Mihomo 主模板，包含 DNS、TUN、嗅探、代理组、订阅集合和分流规则。
- [mihomo_config_stash.yaml](mihomo_config_stash.yaml)：Stash 模板，单独维护 DNS 和代理组配置。
- [config_overwrite.js](config_overwrite.js)：订阅转换后的覆写脚本，合并并去重代理组成员，按 `filter` 筛选节点；中转组只追加不带 `dialer-proxy` 的节点，良心云 Hy2 组按协议重建成员。
- [rename.js](rename.js)：订阅节点重命名脚本。
- [custom_rule/](custom_rule/)：自定义规则集。

两个 YAML 文件都是模板，需要配合订阅转换流程注入实际节点。覆写脚本还可通过 `oixCloudEdgePath` 参数补入 oixCloud provider 的订阅 URL；主模板本身未填写该 URL。

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

YAML 模板包含全局与网络配置、`proxy-groups`、`rule-providers` 和 `rules`；主模板另有 `proxy-providers`。

- `proxy-groups` 定义节点选择、中转、地区、机场和服务分流组。
- `rule-providers` 定义远程规则集，`rules` 按顺序引用规则集和策略组。
- 修改组名或规则集名时，同步检查所有引用；最终以 `MATCH` 兜底。
- 两个模板面向不同客户端，修改时分别验证兼容性和生成后的节点成员。

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
├── mihomo_config.yaml        # Mihomo 模板
├── mihomo_config_stash.yaml  # Stash 模板
├── config_overwrite.js       # 订阅配置覆写
├── rename.js                 # 节点重命名
├── custom_rule/              # 自定义规则集
├── CLAUDE.md                 # 仓库工作指南
└── CONTRIBUTING.md           # 开发指南
```
