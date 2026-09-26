/**
 * @file 校验合并后的代理组、节点、provider 与规则引用。
 * 拒绝重复名称、缺失字段和无效引用，避免输出无法使用的客户端配置。
 */

import { configError, requireArray } from './value.ts';
import { isConfigMap } from '../../src/scripts/shared/value.ts';
import { BUILTIN_TARGETS, validateRuleReferences } from '../../src/scripts/shared/rules.ts';
import { readRuntimeProxyProviders } from '../../src/scripts/shared/runtime-providers.ts';
import type { ConfigMap } from '../../src/scripts/shared/types.ts';

/**
 * 检查代理组列表及名称的有效性，收集名称并拒绝同一列表中的重复项。
 * 名称只用 trim 判断是否为空，重复比较仍使用原始字符串，不修改任何组。
 *
 * @preserve
 * @param {*} groups 待校验的代理组数组，每个元素须为带非空字符串 name 的映射。
 * @param {string} label 错误信息中的来源说明，例如 base.proxy-groups。
 * @returns {Set<string>} 按首次出现顺序收集的原始组名集合。
 * @throws {Error} 输入不是数组、组缺少有效名称或组名重复时抛出配置错误。
 */
export function checkGroupNames(groups: unknown, label: string): Set<string> {
  const names = new Set<string>();
  for (const group of requireArray(groups, label)) {
    if (!isConfigMap(group) || typeof group.name !== 'string' || !group.name.trim()) {
      configError(`${label} 的每个代理组必须有 name`);
    }
    if (names.has(group.name)) configError(`${label} 代理组重名：${group.name}`);
    names.add(group.name);
  }
  return names;
}

/**
 * 校验当前配置的名称、组 type、成员、provider 和规则引用，以及运行时 provider 声明。
 * 只检查已提供的数据，不修改配置，也不校验节点的 dialer-proxy 或覆写阶段的成员声明。
 *
 * @preserve
 * @param {Object<string, *>} config 含 proxy-groups 与 rules 的配置；节点和 provider 定义可省略。
 * @returns {void} 当前配置通过上述结构与引用检查时正常返回。
 * @throws {Error} 名称冲突、必需字段或列表类型无效，或引用目标不存在时抛出配置错误。
 */
export function validateMergedConfig(config: ConfigMap): void {
  const runtimeProviders = readRuntimeProxyProviders(config, configError);
  const groupNames = checkGroupNames(config['proxy-groups'], '合并结果');
  const targets = new Set([...groupNames, ...BUILTIN_TARGETS]);
  for (const proxy of (config.proxies ?? []) as unknown[]) {
    if (!isConfigMap(proxy) || typeof proxy.name !== 'string') configError('订阅节点必须有 name');
    if (targets.has(proxy.name)) configError(`节点或代理组重名：${proxy.name}`);
    targets.add(proxy.name);
  }
  for (const group of config['proxy-groups'] as Array<ConfigMap & { name: string }>) {
    if (typeof group.type !== 'string') configError(`${group.name} 缺少代理组 type`);
    for (const name of requireArray(group.proxies ?? [], `${group.name}.proxies`)) {
      if (typeof name !== 'string' || !targets.has(name)) {
        configError(`${group.name} 引用了不存在的代理或组：${name}`);
      }
    }
    for (const name of requireArray(group.use ?? [], `${group.name}.use`)) {
      if (
        typeof name !== 'string' ||
        (!Object.hasOwn(config['proxy-providers'] ?? {}, name) && !runtimeProviders.has(name))
      ) {
        configError(`${group.name} 引用了不存在的 proxy-provider：${name}`);
      }
    }
  }
  validateRuleReferences(
    config.rules,
    targets,
    (config['rule-providers'] ?? {}) as ConfigMap,
    configError,
  );
}
