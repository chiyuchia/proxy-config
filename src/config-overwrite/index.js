/**
 * @file 在配置合并后执行节点分组与可选的 oixCloud provider URL 注入。
 * 按组内声明就地更新成员和 provider，移除内部声明，保留原有规则与订阅节点。
 */

import { updateGroupMembers } from './group-members.js';
import { buildOixCloudProvider } from './provider.js';

export function overwriteConfig(config, args = {}) {
  config['proxy-groups'] = updateGroupMembers(
    config?.['proxy-groups'] ?? [],
    config?.proxies ?? [],
  );

  const providers = config?.['proxy-providers'] ?? {};
  const oixCloud = buildOixCloudProvider(args?.oixCloudEdgePath || '', providers.oixCloud);
  if (oixCloud) {
    config['proxy-providers'] = { ...providers, oixCloud };
  }

  return config;
}
