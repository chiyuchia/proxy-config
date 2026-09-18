/**
 * 订阅转换后的二次覆写逻辑。
 * 这里只调整策略组的 `proxies` 列表，不改动规则本身：
 * - 普通手动策略组追加订阅中的全部节点；
 * - 带 `filter` 的策略组按筛选规则追加匹配到的节点；
 * - `全球直连` 保持手工维护，不在这里注入节点；
 * - `中转` 组和机场亚太组只从未使用 `dialer-proxy` 的节点中挑选，避免混入链式代理。
 * - `良心云 Hy2` 和 `良心云 亚太` 组按实际协议重建成员，分别仅保留 Hy2 和 VLESS 节点。
 * - 机场亚太组按筛选结果重建成员，避免保留旧地区或已改为链式代理的节点。
 * - 合并节点时自动去重，避免脚本重复执行后出现重复项。
 */
function hasText(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function compileGroupFilter(filterText) {
  if (!hasText(filterText)) {
    return null;
  }

  let flags = '';
  // Mihomo 的 `(?i)` 这类内联 flag 需要先提取出来，JS RegExp 不完全兼容这种写法。
  const normalizedPattern = filterText.replace(/\(\?([dgimsuvy]+)\)/g, (_, inlineFlags) => {
    flags = [...new Set(`${flags}${inlineFlags}`)].join('');
    return '';
  });

  try {
    return new RegExp(normalizedPattern, flags);
  } catch (error) {
    console.log(`[config-overwrite] 跳过无效 filter: ${filterText}, ${error.message}`);
    return null;
  }
}

function isAirportAsiaGroup(groupName) {
  return ['✈️ VikingLinks 亚太', '✈️ 良心云 亚太', '✈️ 吹雪云 亚太'].includes(groupName);
}

function getCandidateProxies(groupName, allProxies, transitProxies) {
  // 机场亚太组虽不含“中转”字样，仍只注入可直接使用的节点。
  const requiresTransit = groupName.includes('中转') || isAirportAsiaGroup(groupName);
  return requiresTransit ? transitProxies : allProxies;
}

function matchesGroupFilter(proxyName, groupFilter) {
  // 带 `g/y` 标记的正则会复用状态，测试前重置游标，保证每个节点都从头匹配。
  groupFilter.lastIndex = 0;
  return groupFilter.test(proxyName);
}

function getExtraProxyNames(group, candidateProxies) {
  // 没有 `filter` 时，沿用原来的全量注入行为。
  if (!hasText(group?.filter)) {
    return candidateProxies.map(({ name }) => name);
  }

  const groupFilter = compileGroupFilter(group.filter);
  if (!groupFilter) {
    // 无效 `filter` 不做兜底全量注入，避免误把所有节点塞进组里。
    return [];
  }

  return candidateProxies
    .filter((proxy) => matchesGroupFilter(proxy.name, groupFilter))
    .map(({ name }) => name);
}

function mergeProxyNames(existingProxies, extraProxies) {
  // 保留原有顺序，并在追加新节点时顺手去重。
  return [...new Set([...(existingProxies ?? []), ...extraProxies])];
}

function buildOixCloudProvider(url, existingProvider) {
  if (!hasText(url)) {
    return null;
  }

  if (existingProvider) {
    return {
      ...existingProvider,
      url,
    };
  }

  return {
    type: 'http',
    url,
    path: './proxy_provider/oixCloud.yaml',
    interval: 86400,
    proxy: 'DIRECT',
    'health-check': {
      enable: true,
      interval: 600,
      url: 'http://www.gstatic.com/generate_204',
    },
  };
}

function main(config) {
  // 防御性兜底：某些订阅模板可能没有生成 `proxy-groups` 或 `proxies`。
  const originalProxyGroups = config?.['proxy-groups'] ?? [];
  const proxies = config?.proxies ?? [];

  const allProxies = proxies.filter((proxy) => proxy?.name);
  const transitProxies = allProxies.filter((proxy) => !proxy['dialer-proxy']);

  config['proxy-groups'] = originalProxyGroups.map((group) => {
    const groupName = group?.name ?? '';

    // `全球直连` 保持手工维护，不在覆写脚本里自动扩充。
    if (groupName.includes('全球直连')) {
      return group;
    }

    if (groupName === '✈️ 良心云 Hy2' || groupName === '✈️ 良心云 亚太') {
      // 节点名称不一定包含协议，按实际类型筛选；重建列表以移除过期或协议已变更的成员。
      const allowedTypes = groupName === '✈️ 良心云 Hy2' ? ['hysteria2', 'hy2'] : ['vless'];
      const protocolProxies = transitProxies.filter((proxy) =>
        allowedTypes.includes(String(proxy.type).toLowerCase())
      );
      return {
        ...group,
        proxies: mergeProxyNames([], getExtraProxyNames(group, protocolProxies)),
      };
    }

    const candidateProxies = getCandidateProxies(groupName, allProxies, transitProxies);
    const extraProxies = getExtraProxyNames(group, candidateProxies);
    // 专用组不保留旧成员，确保地区或节点的 dialer-proxy 变更后仍满足中转条件。
    const rebuildTransitGroup = isAirportAsiaGroup(groupName);

    return {
      ...group,
      proxies: mergeProxyNames(rebuildTransitGroup ? [] : group?.proxies, extraProxies),
    };
  });

  const oixCloudEdgePath = $arguments?.oixCloudEdgePath || '';
  const existingProxyProviders = config?.['proxy-providers'] ?? {};
  const oixCloudProvider = buildOixCloudProvider(
    oixCloudEdgePath,
    existingProxyProviders.oixCloud
  );
  if (oixCloudProvider) {
    config['proxy-providers'] = {
      ...existingProxyProviders,
      oixCloud: oixCloudProvider,
    };
  }

  return config;
}
