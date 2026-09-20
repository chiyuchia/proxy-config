/**
 * @file 校验合并后的代理组、节点、provider 与规则引用。
 * 拒绝重复名称、缺失字段和无效引用，避免输出无法使用的客户端配置。
 */

import { configError, isConfigMap, requireArray } from './value.ts';
import type { ConfigMap } from '../types.ts';

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
 * 校验当前配置的组名、节点名冲突、组 type 字段，以及成员、provider 和规则策略引用。
 * 只检查已提供的数据，不修改配置，也不校验节点的 dialer-proxy 或覆写阶段的成员声明。
 *
 * @preserve
 * @param {Object<string, *>} config 含 proxy-groups 与 rules 的配置；节点和 provider 定义可省略。
 * @returns {void} 当前配置通过上述结构与引用检查时正常返回。
 * @throws {Error} 名称冲突、必需字段或列表类型无效，或引用目标不存在时抛出配置错误。
 */
export function validateMergedConfig(config: ConfigMap): void {
  const groupNames = checkGroupNames(config['proxy-groups'], '合并结果');
  const targets = new Set<unknown>([
    ...groupNames,
    'DIRECT',
    'REJECT',
    'REJECT-DROP',
    'PASS',
    'COMPATIBLE',
    'GLOBAL',
  ]);
  for (const proxy of (config.proxies ?? []) as unknown[]) {
    if (!isConfigMap(proxy) || typeof proxy.name !== 'string') configError('订阅节点必须有 name');
    if (targets.has(proxy.name)) configError(`节点或代理组重名：${proxy.name}`);
    targets.add(proxy.name);
  }
  for (const group of config['proxy-groups'] as Array<ConfigMap & { name: string }>) {
    if (typeof group.type !== 'string') configError(`${group.name} 缺少代理组 type`);
    for (const name of requireArray(group.proxies ?? [], `${group.name}.proxies`)) {
      if (!targets.has(name)) configError(`${group.name} 引用了不存在的代理或组：${name}`);
    }
    for (const name of requireArray(group.use ?? [], `${group.name}.use`)) {
      // 保留原生 hasOwn 对键的转换行为，不为现有配置额外增加成员类型校验。
      if (!Object.hasOwn(config['proxy-providers'] ?? {}, name as PropertyKey)) {
        configError(`${group.name} 引用了不存在的 proxy-provider：${name}`);
      }
    }
  }
  for (const rule of requireArray(config.rules, 'rules')) {
    if (typeof rule !== 'string') configError('rules 中必须是规则字符串');
    const parts = rule.split(',');
    const target = parts[parts.length - (parts[parts.length - 1] === 'no-resolve' ? 2 : 1)];
    if (!targets.has(target)) configError(`规则引用了不存在的策略：${target}`);
    if (parts[0] === 'RULE-SET' && !Object.hasOwn(config['rule-providers'] ?? {}, parts[1])) {
      configError(`规则引用了不存在的 rule-provider：${parts[1]}`);
    }
  }
}
