/**
 * @file 在配置合并后执行节点分组与最终校验，识别声明的客户端运行时 provider。
 * 校验通过后就地更新成员及独立测速副本并移除内部声明，保留原有 provider、规则与订阅节点。
 */

import { updateGroupMembers } from './group-members.ts';
import { generateBenchmarkMembers } from './benchmark-members.ts';
import { validateFinalConfig, validateOverwriteStructure } from './validation.ts';
import type { OverwrittenConfig, ProxyConfig } from '../shared/types.ts';

/**
 * 就地更新代理组成员及声明的独立测速副本，校验本地配置和运行时 provider 引用。
 * 候选配置校验通过后才写回并移除组内和顶层内部声明；失败时不修改输入。
 * @preserve
 * @param {Object} config 本次合并、注入节点后的配置对象，会被就地修改。
 * @returns {Object} 传入的同一个配置对象，顶层与组内均已移除 x-substore 声明。
 * @throws {Error} 成员声明或最终配置无效，包括直接再次覆写已移除声明的最终配置。
 */
export function overwriteConfig<T extends ProxyConfig>(config: T): OverwrittenConfig<T> {
  validateOverwriteStructure(config);
  const sourceGroups = config['proxy-groups'] ?? [];
  const proxies = config.proxies ?? [];
  const benchmarkMembers = generateBenchmarkMembers(
    sourceGroups,
    updateGroupMembers(sourceGroups, proxies),
    proxies,
  );
  const candidate = {
    ...config,
    ...(benchmarkMembers.addedProxies.length
      ? { proxies: [...proxies, ...benchmarkMembers.addedProxies] }
      : {}),
    'proxy-groups': benchmarkMembers.groups,
  };

  validateFinalConfig(candidate);
  config['proxy-groups'] = candidate['proxy-groups'];
  if (benchmarkMembers.addedProxies.length) config.proxies = candidate.proxies;
  delete config['x-substore'];

  // 校验通过后才写回，返回类型反映已移除内部声明的后置条件。
  return config as OverwrittenConfig<T>;
}
