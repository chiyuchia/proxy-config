/**
 * @file 读取由客户端运行时提供的代理集合声明，供合并及最终配置校验共用。
 * 声明仅放行组的 use 引用，不创建 provider，也不将其名称视为节点或规则集。
 */

import { isConfigMap } from './value.ts';
import type { ConfigMap } from './types.ts';

/**
 * 严格读取顶层 x-substore.runtime-proxy-providers，拒绝无效声明及本地同名定义。
 * 缺少声明或字段时返回空集合；保留名称原值，不修改配置或创建运行时资源。
 * @preserve
 * @param {Object} config 当前配置，可包含顶层 x-substore 声明及本地 proxy-providers。
 * @param {Function} fail 接收错误原因并抛出当前处理阶段异常的函数。
 * @returns {Set<string>} 明确由客户端运行时提供的 proxy-provider 名称，允许空集合。
 * @throws {Error} 声明容器、字段、名称、重复项或本地定义冲突无效时抛出配置错误。
 */
export function readRuntimeProxyProviders(
  config: ConfigMap,
  fail: (message: string) => never,
): Set<string> {
  const metadata = config['x-substore'];
  if (metadata === undefined) return new Set();
  if (!isConfigMap(metadata)) fail('顶层 x-substore 必须是映射');
  for (const key of Object.keys(metadata)) {
    if (key !== 'runtime-proxy-providers') fail(`顶层 x-substore.${key} 是未知字段`);
  }

  const path = 'x-substore.runtime-proxy-providers';
  const names = metadata['runtime-proxy-providers'];
  if (names === undefined) return new Set();
  if (!Array.isArray(names)) fail(`${path} 必须是数组`);
  const runtimeProviders = new Set<string>();
  for (const [index, name] of names.entries()) {
    if (typeof name !== 'string' || !name.trim()) {
      fail(`${path}[${index}] 必须是非空字符串`);
    }
    if (runtimeProviders.has(name)) fail(`${path} 名称重复：${name}`);
    if (Object.hasOwn(config['proxy-providers'] ?? {}, name)) {
      fail(`${path} 与本地 proxy-providers 同名：${name}`);
    }
    runtimeProviders.add(name);
  }
  return runtimeProviders;
}
