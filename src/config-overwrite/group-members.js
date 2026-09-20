/**
 * @file 按配置声明的生成方式、协议限制、链式代理限制及 filter 更新成员。
 * 保留候选顺序，移除只供 Sub-Store 使用的生成策略，不依据组名决定行为。
 */

import { readMemberPolicy } from './member-policy.js';

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

function matchesPolicy(proxy, policy) {
  return (
    (!policy.excludeDialer || !proxy['dialer-proxy']) &&
    (!policy.types || policy.types.has(String(proxy.type).toLowerCase()))
  );
}

function updateGroup(group, policy, allProxies, proxiesByName) {
  const { 'x-substore': metadata, ...output } = group;
  if (policy.mode === 'manual') return output;

  const candidates = allProxies.filter((proxy) => matchesPolicy(proxy, policy));
  // 已有真实节点也须符合协议/中转限制；手工组引用与内置策略保留，filter 仅筛新增节点。
  const existing =
    policy.mode === 'replace'
      ? []
      : (group.proxies ?? []).filter((name) => {
          const proxy = proxiesByName.get(name);
          return !proxy || matchesPolicy(proxy, policy);
        });
  return {
    ...output,
    proxies: mergeProxyNames(existing, matchingProxyNames(group, candidates)),
  };
}

/** 先校验全部策略再计算结果，不修改输入组或订阅节点。 */
export function updateGroupMembers(groups, proxies) {
  const policies = groups.map(readMemberPolicy);
  const allProxies = proxies.filter((proxy) => proxy?.name);
  const proxiesByName = new Map(allProxies.map((proxy) => [proxy.name, proxy]));
  return groups.map((group, index) =>
    updateGroup(group, policies[index], allProxies, proxiesByName),
  );
}
