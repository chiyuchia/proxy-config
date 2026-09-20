/**
 * @file 合并公共配置与客户端差异，生成经过校验的客户端配置。
 * 检查并移除来源标记，只保留 Sub-Store 注入的订阅节点。
 */

import { configError, copyConfigValue, isConfigMap, requireArray } from './value.js';
import { mergeConfigValue } from './patch.js';
import { validateMergedConfig } from './validation.js';

export function mergeConfigDocuments(base, profile, proxies) {
  if (!isConfigMap(base) || base.$base !== true) configError('base.yaml 必须包含 $base: true');
  if (!isConfigMap(profile) || !['mihomo', 'stash'].includes(profile.$profile)) {
    configError('客户端差异必须包含 $profile: mihomo 或 stash');
  }
  // 标记可检测远程来源返回 HTML、颠倒的文件或错误的客户端差异，输出中不保留标记。
  const { $base, ...common } = base;
  const { $profile, ...overlay } = profile;
  if (Object.hasOwn(common, 'proxies') || Object.hasOwn(overlay, 'proxies')) {
    configError('配置源不能包含 proxies，节点由 Sub-Store 注入');
  }
  const merged = mergeConfigValue(mergeConfigValue({}, common), overlay);
  if (proxies !== undefined) {
    merged.proxies = copyConfigValue(requireArray(proxies, '输入 proxies'));
  }
  validateMergedConfig(merged);
  return merged;
}
