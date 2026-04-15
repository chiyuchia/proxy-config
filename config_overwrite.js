/**
 * 订阅转换后的二次覆写逻辑。
 * 这里只调整策略组的 `proxies` 列表，不改动规则本身：
 * - 普通手动策略组追加订阅中的全部节点；
 * - `filter` 组交给上游规则自动匹配；
 * - `全球直连` 保持手工维护，不在这里注入节点；
 * - `中转` 组只追加未使用 `dialer-proxy` 的节点，避免混入链式代理。
 * - 合并节点时自动去重，避免脚本重复执行后出现重复项。
 */
function main(config) {
  // 防御性兜底：某些订阅模板可能没有生成 `proxy-groups` 或 `proxies`。
  const originalProxyGroups = config?.['proxy-groups'] ?? [];
  const proxies = config?.proxies ?? [];

  // 节点名列表只计算一次，避免每个策略组都重复遍历整份节点数据。
  const allProxyNames = proxies.map(({ name }) => name);
  const transitProxyNames = proxies
    .filter((proxy) => !proxy['dialer-proxy'])
    .map(({ name }) => name);

  config['proxy-groups'] = originalProxyGroups.map((group) => {
    const groupName = group?.name ?? '';

    // 带 `filter` 的分组通常由规则模板自动选节点；`全球直连` 也保持原样。
    if (group.filter || groupName.includes('全球直连')) {
      return group;
    }

    // `中转` 组只保留可直接使用的节点，其他手动策略组则追加全部节点。
    const extraProxies = groupName.includes('中转') ? transitProxyNames : allProxyNames;

    return {
      ...group,
      proxies: [...new Set([...(group?.proxies ?? []), ...extraProxies])],
    };
  });
  return config;
}
