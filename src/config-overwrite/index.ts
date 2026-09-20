/**
 * @file 在配置合并后执行节点分组与可选的 oixCloud provider URL 注入。
 * 按组内声明就地更新成员和 provider，移除内部声明，保留原有规则与订阅节点。
 */

import { updateGroupMembers } from './group-members.ts';
import { buildOixCloudProvider } from './provider.ts';
import type { OverwrittenConfig, ProxyConfig, ScriptArguments } from '../types.ts';

/**
 * 就地更新代理组成员并移除内部声明，按参数补入 oixCloud provider 的订阅地址。
 * 成员声明全部校验成功后才替换组数组；保留规则和注入节点。
 * @preserve
 * @param {Object} config 本次合并、注入节点后的配置对象，会被就地修改。
 * @param {Object} [args={}] 覆写脚本参数。
 * @param {string} [args.oixCloudEdgePath] 可选订阅地址；缺失或为空白时不更新 provider。
 * @returns {Object} 传入的同一个配置对象，其中组已不再包含 x-substore 声明。
 * @throws {Error} 任一组的成员声明无效，包括直接再次覆写已移除声明的最终配置。
 */
export function overwriteConfig<T extends ProxyConfig>(
  config: T,
  args: ScriptArguments | null = {},
): OverwrittenConfig<T> {
  config['proxy-groups'] = updateGroupMembers(
    config?.['proxy-groups'] ?? [],
    config?.proxies ?? [],
  );

  const providers = config?.['proxy-providers'] ?? {};
  const oixCloud = buildOixCloudProvider(args?.oixCloudEdgePath || '', providers.oixCloud);
  if (oixCloud) {
    config['proxy-providers'] = { ...providers, oixCloud };
  }

  // 成员计算成功后已在原对象上写入组数组，返回类型反映这项后置条件。
  return config as OverwrittenConfig<T>;
}
