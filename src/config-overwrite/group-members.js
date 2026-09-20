/**
 * @file 根据节点名称、实际协议与链式代理状态更新代理组成员。
 * 普通组按原顺序合并去重，专用组重建成员，全球直连组保留手工配置。
 */

const AIRPORT_ASIA_GROUPS = new Set(['✈️ VikingLinks 亚太', '✈️ 良心云 亚太', '✈️ 吹雪云 亚太']);

const GROUP_PROTOCOLS = new Map([
  ['✈️ 良心云 Hy2', ['hysteria2', 'hy2']],
  ['✈️ 良心云 亚太', ['vless']],
]);

function hasText(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function compileGroupFilter(filterText) {
  let flags = '';
  // Mihomo 支持的内联标记（如 (?i)）需转成 JavaScript RegExp 的 flags。
  const pattern = filterText.replace(/\(\?([dgimsuvy]+)\)/g, (_, inlineFlags) => {
    flags = [...new Set(`${flags}${inlineFlags}`)].join('');
    return '';
  });

  try {
    return new RegExp(pattern, flags);
  } catch (error) {
    console.log(`[config-overwrite] 跳过无效 filter: ${filterText}, ${error.message}`);
    return null;
  }
}

function matchingProxyNames(group, candidates) {
  if (!hasText(group?.filter)) {
    return candidates.map(({ name }) => name);
  }

  const filter = compileGroupFilter(group.filter);
  // 无效筛选不能退回全量注入，否则可能将所有节点误放进专用组。
  if (!filter) return [];

  return candidates
    .filter(({ name }) => {
      // g/y 正则携带游标；每个节点都必须从头匹配。
      filter.lastIndex = 0;
      return filter.test(name);
    })
    .map(({ name }) => name);
}

function mergeProxyNames(existing, added) {
  return [...new Set([...(existing ?? []), ...added])];
}

function updateGroup(group, allProxies, directProxies) {
  const name = group?.name ?? '';
  if (name.includes('全球直连')) return group;

  const allowedTypes = GROUP_PROTOCOLS.get(name);
  const isAsiaGroup = AIRPORT_ASIA_GROUPS.has(name);
  const rebuildMembers = isAsiaGroup || allowedTypes !== undefined;
  const requiresDirect = name.includes('中转') || rebuildMembers;
  let candidates = requiresDirect ? directProxies : allProxies;

  if (allowedTypes) {
    // 协议以节点 type 为准，名称中的 Hy2/VLESS 等字样不能作为依据。
    candidates = candidates.filter((proxy) =>
      allowedTypes.includes(String(proxy.type).toLowerCase()),
    );
  }

  // 机场亚太组和协议专用组每次重建，清除地区、协议或链式代理状态已变的旧成员。
  const existing = rebuildMembers ? [] : group?.proxies;
  return {
    ...group,
    proxies: mergeProxyNames(existing, matchingProxyNames(group, candidates)),
  };
}

/** 保留组的顺序与设置，只更新节点成员。 */
export function updateGroupMembers(groups, proxies) {
  const allProxies = proxies.filter((proxy) => proxy?.name);
  const directProxies = allProxies.filter((proxy) => !proxy['dialer-proxy']);
  return groups.map((group) => updateGroup(group, allProxies, directProxies));
}
