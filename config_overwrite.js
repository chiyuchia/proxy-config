/**
 * 订阅转换后的二次覆写逻辑。
 * 这里只调整策略组的 `proxies` 列表，不改动规则本身：
 * - 普通手动策略组追加订阅中的全部节点；
 * - 带 `filter` 的策略组按筛选规则追加匹配到的节点；
 * - `全球直连` 保持手工维护，不在这里注入节点；
 * - `中转` 组只从未使用 `dialer-proxy` 的节点中挑选，避免混入链式代理。
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

function getCandidateProxies(groupName, allProxies, transitProxies) {
  // 中转组只注入可直接使用的节点，避免把链式代理再次塞进中转组。
  return groupName.includes('中转') ? transitProxies : allProxies;
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

    const candidateProxies = getCandidateProxies(groupName, allProxies, transitProxies);
    const extraProxies = getExtraProxyNames(group, candidateProxies);

    return {
      ...group,
      proxies: mergeProxyNames(group?.proxies, extraProxies),
    };
  });
  return config;
}
