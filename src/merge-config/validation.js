/**
 * @file 校验合并后的代理组、节点、provider 与规则引用。
 * 拒绝重复名称、缺失字段和无效引用，避免输出无法使用的客户端配置。
 */

import { configError, isConfigMap, requireArray } from './value.js';

export function checkGroupNames(groups, label) {
  const names = new Set();
  for (const group of requireArray(groups, label)) {
    if (!isConfigMap(group) || typeof group.name !== 'string' || !group.name.trim()) {
      configError(`${label} 的每个代理组必须有 name`);
    }
    if (names.has(group.name)) configError(`${label} 代理组重名：${group.name}`);
    names.add(group.name);
  }
  return names;
}

export function validateMergedConfig(config) {
  const groupNames = checkGroupNames(config['proxy-groups'], '合并结果');
  const targets = new Set([
    ...groupNames,
    'DIRECT',
    'REJECT',
    'REJECT-DROP',
    'PASS',
    'COMPATIBLE',
    'GLOBAL',
  ]);
  for (const proxy of config.proxies ?? []) {
    if (!isConfigMap(proxy) || typeof proxy.name !== 'string') configError('订阅节点必须有 name');
    if (targets.has(proxy.name)) configError(`节点或代理组重名：${proxy.name}`);
    targets.add(proxy.name);
  }
  for (const group of config['proxy-groups']) {
    if (typeof group.type !== 'string') configError(`${group.name} 缺少代理组 type`);
    for (const name of requireArray(group.proxies ?? [], `${group.name}.proxies`)) {
      if (!targets.has(name)) configError(`${group.name} 引用了不存在的代理或组：${name}`);
    }
    for (const name of requireArray(group.use ?? [], `${group.name}.use`)) {
      if (!Object.hasOwn(config['proxy-providers'] ?? {}, name)) {
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
