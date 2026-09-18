# 贡献指南

本文档说明了本项目的开发规范和约定。

项目维护 `config/base.yaml` 公共配置、`config/mihomo.yaml` 与 `config/stash.yaml` 客户端差异，以及订阅处理脚本和 `custom_rule/` 中的自定义规则集。Sub-Store 使用 `scripts/merge-config.js` 在服务端合并 YAML，再注入实际节点并运行 `scripts/config-overwrite.js`。接入方式和合并语法见 [README.md](README.md)。

配置来源统一维护在三份 YAML 中：`config/base.yaml` 维护全部共同代理组、候选顺序、筛选、测速设置和规则，包括 oixCloud Edge、吹雪云和一元机场组；`config/mihomo.yaml` 仅维护 Mihomo 的 DNS、嗅探、oixCloud provider、Optimized 组及相应 `use` 和菜单引用；`config/stash.yaml` 仅维护 Stash 的 DNS 差异。

---

## 开发流程

1. **修改代码**：在本地进行必要的修改
2. **验证更改**：检查两种客户端共同代理组的一致性、规则集和策略组引用，并验证节点注入及覆写结果
3. **手动提交**：使用约定式提交格式进行 `git commit`
4. **确认后推送**：检查 commit 信息无误后，手动执行 `git push`

> ⚠️ **重要**：提交和推送是两个独立的步骤，必须分别手动执行。

### 本地验证

运行测试需要支持 `node:test` 的 Node.js，以及可导入 `yaml` 的 Python 3（PyYAML）。这些是本地测试依赖；Sub-Store 使用自带的 YAML 解析器，服务端不需要 Python。

```bash
node --test tests/merge-config.test.js
```

测试覆盖两种客户端的配置合并、共同代理组及候选顺序的一致性、数组与代理组补丁、远程读取和错误处理、节点保留及现有覆写流程。一致性检查只排除 Mihomo 的 oixCloud provider、Optimized 组及相应 `use` 和菜单引用。有意调整配置行为时，应更新相应测试预期，并检查三份配置源合并后的实际输出。

---

## 约定式提交

本项目遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范。

### 提交格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type 类型

| Type | 说明 |
|-------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档更新 |
| `style` | 代码格式调整（不影响功能） |
| `refactor` | 重构（非新功能、非 bug 修复） |
| `perf` | 性能优化 |
| `test` | 测试相关 |
| `chore` | 构建过程或辅助工具变动 |
| `ci` | CI 配置和脚本 |

### Scope 范围

描述提交影响的范围，例如：

- `clash-rules` - Clash 规则配置
- `cdn` - CDN 配置
- `docs` - 文档

### 示例

```bash
# 简单提交
git commit -m "feat(clash-rules): 合并谷歌相关规则集和策略组"

# 详细提交
git commit -m "chore(clash-config): 本仓库资源统一使用 GitHub Raw 链接

将 chiyuchia/proxy-config 的脚本和 YAML 资源链接改为 raw.githubusercontent.com。

- 同步更新合并脚本默认地址和接入文档
- 保留原有分支和文件路径
- 其他仓库继续使用各自现有的资源链接"
```

---

## 资源链接

本仓库 `chiyuchia/proxy-config` 的脚本、YAML 和其他资源统一使用 GitHub Raw 链接。

### 链接格式

```
https://raw.githubusercontent.com/chiyuchia/proxy-config/{branch}/{path}
```

例如，合并脚本使用 `https://raw.githubusercontent.com/chiyuchia/proxy-config/master/scripts/merge-config.js`。

其他仓库（如 `proxy-rule`、`ACL4SSR`、`blackmatrix7` 和 `dler-io`）保留各自现有的 CDN 链接策略。

修改链接时保留正确的仓库、分支和文件路径，并检查资源是否可访问。

---

## Clash 规则配置

### 规则优先级

Clash 规则**从上到下依次匹配**，第一条匹配的规则生效。

### 修改原则

1. **具体规则在前**：更具体的规则（如 YouTube）应放在通用规则（如 Google）之前
2. **规则集命名**：使用清晰的中文名称（如 "📢 谷歌服务"）
3. **策略组统一**：相同用途的规则集应使用同一个策略组
4. **共同分组单一维护**：沿用 Mihomo 的分组和候选顺序，在 `config/base.yaml` 修改共同代理组及筛选、测速设置；除 oixCloud provider 相关差异外，两种客户端合并后的 `proxy-groups` 必须一致

### 示例

```yaml
# 更具体的规则在前；交换两条规则可能让 Google 先匹配 YouTube 流量。
rules:
  - "RULE-SET,youtube,📹 油管视频"
  - "RULE-SET,google,📢 Google"
```

### 订阅处理

- `scripts/merge-config.js` 用于 Sub-Store 的“Mihomo 配置”类型，通过 `client=mihomo` / `client=stash` 选择差异文件；必须在 `scripts/config-overwrite.js` 之前作为独立脚本执行。合并时保留已有 `config.proxies`，其他输入配置由新结果替换。
- 三份 YAML 分别解析，不能跨文件引用锚点。公共文件的 `$base` 与差异文件的 `$profile` 标记在输出时移除。
- 普通映射递归合并，普通数组整体替换，顶层 `proxy-groups` 按 `name` 合并。数组局部增删支持 `$append`、`$prepend`、`$remove` 或 `$insert-before`；客户端代理组补丁仅用于 oixCloud provider 相关差异，共同候选顺序直接在 `config/base.yaml` 中维护，不要改变公共规则的优先级。
- `scripts/rename.js` 在 Sub-Store 的订阅或组合订阅中，通过 `async operator(proxies, targetPlatform, context)` 处理节点数组，完成地区识别、重命名、筛选和排序。处理后的节点再供文件注入及 `scripts/config-overwrite.js` 覆写使用；接入方式和参数见 [README.md 的节点重命名说明](README.md#节点重命名)。
- `scripts/config-overwrite.js` 合并并去重策略组的 `proxies` 成员，按 `filter` 筛选节点；中转组和机场亚太组只使用不带 `dialer-proxy` 的节点，良心云 Hy2 和亚太组按实际协议重建成员，分别仅保留 Hy2 和 VLESS 节点，全球直连组保持手工配置。
- VikingLinks、良心云和吹雪云的机场亚太组统一命名为“机场名 亚太”，仅筛选 HK、SG、JP、TW，每次覆写都重建成员，避免旧节点残留。良心云亚太组另要求名称包含 `CT`（含 `CTCU`、`CTCUCM`），吹雪云亚太组另要求名称包含“电信”。
- `oixCloudEdgePath` 参数可为 oixCloud provider 注入订阅 URL；Mihomo 差异文件本身没有填写该 URL。
- 修改公共配置、客户端差异或脚本后，检查最终生成配置中的组成员和引用，避免仅验证未注入节点的合并结果。

---

## 项目结构

```
proxy-config/
├── config/
│   ├── base.yaml             # 公共配置与全部共同代理组
│   ├── mihomo.yaml           # DNS、嗅探与 oixCloud provider 差异
│   └── stash.yaml            # Stash DNS 差异
├── scripts/
│   ├── merge-config.js       # Sub-Store 服务端合并
│   ├── config-overwrite.js   # 订阅配置覆写
│   └── rename.js             # 节点重命名
├── custom_rule/              # 自定义规则集
├── tests/                    # 合并与节点处理验证
├── README.md                 # Sub-Store 接入与日常维护
├── CLAUDE.md                 # 仓库工作指南
└── CONTRIBUTING.md           # 本文档
```

---

## 版本控制

### 分支策略

`master` 分支保持稳定，提交或合并前需在本地充分验证更改。

### 大型功能分支策略

对于大型功能，建议创建带功能名称的分支：
```bash
# 创建功能分支
git checkout -b feature/large-feature master

# 开发并验证完成后，合并到 master 分支
git checkout master
git pull origin master
git merge feature/large-feature
```

### 注意事项

- **master 分支始终保持稳定**：只包含已测试通过的代码
- **功能分支可选**：仅在大型功能时使用
- **提交前检查**：确认更改无误后再 commit
- **推送前确认**：检查 commit 信息正确后再 push

---

## 联系方式

如有问题，请提交 [Issue](https://github.com/chiyuchia/proxy-config/issues)。
