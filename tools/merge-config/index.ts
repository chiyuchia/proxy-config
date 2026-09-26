/**
 * @file 合并公共配置与客户端差异，生成经过校验的客户端模板。
 * 构建时检查并移除来源标记，保留供 Sub-Store 注入节点后覆写的内部声明。
 */

import { configError, copyConfigValue, requireArray } from './value.ts';
import { isConfigMap } from '../../src/scripts/shared/value.ts';
import { mergeConfigValue } from './patch.ts';
import { validateMergedConfig } from './validation.ts';
import type { ConfigMap, MergedConfig } from '../../src/scripts/shared/types.ts';

/**
 * 校验来源标记，合并公共模板与客户端差异，再复制注入节点并校验当前配置引用。
 * 不修改输入；移除来源标记，保留供后续覆写使用的成员生成和运行时 provider 声明。
 *
 * @preserve
 * @param {Object<string, *>} base 包含 `$base: true` 且不含顶层 proxies 的公共配置。
 * @param {Object<string, *>} profile 包含合法 `$profile` 且不含顶层 proxies 的客户端差异。
 * @param {Array<Object<string, *>>} [proxies] 已注入的节点；省略时结果不添加顶层 proxies。
 * @returns {Object<string, *>} 完成合并及当前引用校验的新配置，不与输入共享容器。
 * @throws {Error} 来源标记、配置值、补丁、节点或当前配置引用不符合要求时抛出错误。
 */
export function mergeConfigDocuments(
  base: unknown,
  profile: unknown,
  proxies?: unknown,
): MergedConfig {
  if (!isConfigMap(base) || base.$base !== true) configError('base.yaml 必须包含 $base: true');
  if (!isConfigMap(profile) || !(['mihomo', 'stash'] as unknown[]).includes(profile.$profile)) {
    configError('客户端差异必须包含 $profile: mihomo 或 stash');
  }
  // 标记可检测颠倒的文件或错误的配置源，输出中不保留标记。
  const { $base, ...common } = base;
  const { $profile, ...overlay } = profile;
  if (Object.hasOwn(common, 'proxies') || Object.hasOwn(overlay, 'proxies')) {
    configError('配置源不能包含 proxies，节点由 Sub-Store 注入');
  }
  const merged = mergeConfigValue(mergeConfigValue({}, common), overlay) as ConfigMap;
  if (proxies !== undefined) {
    merged.proxies = copyConfigValue(requireArray(proxies, '输入 proxies'));
  }
  validateMergedConfig(merged);
  return merged as MergedConfig;
}
