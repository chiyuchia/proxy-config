# 贡献指南

本文档说明了本项目的开发规范和约定。

项目主要维护 `mihomo_config.yaml` 和 `mihomo_config_stash.yaml` 两个 YAML 模板，以及订阅处理脚本和 `custom_rule/` 中的自定义规则集。模板需要配合订阅转换流程注入实际节点。

---

## 开发流程

1. **修改代码**：在本地进行必要的修改
2. **验证更改**：检查 YAML 语法、规则集和策略组引用，并验证节点注入结果
3. **手动提交**：使用约定式提交格式进行 `git commit`
4. **确认后推送**：检查 commit 信息无误后，手动执行 `git push`

> ⚠️ **重要**：提交和推送是两个独立的步骤，必须分别手动执行。

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
git commit -m "perf(rules): 替换 raw.githubusercontent.com 为 JSDMirror CDN 链接

将所有 GitHub Raw 链接替换为 JSDMirror CDN 加速链接，提升国内访问速度。

- 替换 32 个 raw.githubusercontent.com 链接
- JSDMirror 提供免费的全球 CDN 加速服务
- 保持原有的规则集路径不变"
```

---

## CDN 配置

本项目主要使用 [JSDMirror](https://cdn.jsdmirror.com) CDN 加速 GitHub 资源访问。

### 链接格式

| 源格式 | CDN 格式 |
|---------|----------|
| `https://raw.githubusercontent.com/{user}/{repo}/{branch}/{path}` | `https://cdn.jsdmirror.com/gh/{user}/{repo}@{branch}/{path}` |

修改链接时保留正确的仓库、分支和文件路径，并检查资源是否可访问。

---

## Clash 规则配置

### 规则优先级

Clash 规则**从上到下依次匹配**，第一条匹配的规则生效。

### 修改原则

1. **具体规则在前**：更具体的规则（如 YouTube）应放在通用规则（如 Google）之前
2. **规则集命名**：使用清晰的中文名称（如 "📢 谷歌服务"）
3. **策略组统一**：相同用途的规则集应使用同一个策略组

### 示例

```yaml
# 更具体的规则在前；交换两条规则可能让 Google 先匹配 YouTube 流量。
rules:
  - "RULE-SET,youtube,📹 油管视频"
  - "RULE-SET,google,📢 Google"
```

### 订阅处理

- `rename.js` 用于节点重命名。
- `config_overwrite.js` 合并并去重策略组的 `proxies` 成员，按 `filter` 筛选节点；中转组只追加不带 `dialer-proxy` 的节点，良心云 Hy2 组按协议重建成员，全球直连组保持手工配置。
- `oixCloudEdgePath` 参数可为 oixCloud provider 注入订阅 URL；主模板本身没有填写该 URL。
- 修改模板或覆写逻辑后，检查最终生成配置中的组成员和引用，避免仅验证未注入节点的模板。

---

## 项目结构

```
proxy-config/
├── mihomo_config.yaml        # Mihomo 模板
├── mihomo_config_stash.yaml  # Stash 模板
├── config_overwrite.js       # 订阅配置覆写
├── rename.js                 # 节点重命名
├── custom_rule/              # 自定义规则集
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
