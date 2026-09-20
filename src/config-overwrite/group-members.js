/**
 * @file 按配置声明的生成方式、协议限制、链式代理限制及 filter 更新成员。
 * 保留候选顺序，移除只供 Sub-Store 使用的生成策略，不依据组名决定行为。
 */

import { readMemberPolicy } from './member-policy.js';

/**
 * 判断值是否为包含非空白字符的字符串。
 * @preserve
 * @param {*} value 待检查的值。
 * @returns {boolean} 仅非空白字符串返回 true。
 */
function hasText(value) {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * 将组筛选表达式的内联标记转换为 JavaScript 正则标记并编译。
 * 编译失败时记录日志，返回 null，避免将无效筛选当作全量匹配。
 * @preserve
 * @param {string} filterText 非空的节点名称筛选表达式。
 * @returns {RegExp|null} 编译后的正则；语法或标记无效时为 null。
 */
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

/**
 * 按组的 filter 筛选候选节点名称，每个节点独立执行正则匹配。
 * @preserve
 * @param {Object} group 代理组；filter 缺失或为空白时接受全部候选。
 * @param {Array<Object>} candidates 已通过协议及中转限制的节点，需包含 name。
 * @returns {string[]} 按候选顺序返回匹配名称；无效正则返回空数组，尚未去重。
 */
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

/**
 * 合并已有成员与新增名称，按首次出现的位置去重。
 * @preserve
 * @param {string[]|null|undefined} existing 已有成员，空值按空数组处理。
 * @param {string[]} added 待追加的节点名称。
 * @returns {string[]} 新建的有序成员数组，不修改输入数组。
 */
function mergeProxyNames(existing, added) {
  return [...new Set([...(existing ?? []), ...added])];
}

/**
 * 检查节点是否满足中转排除及实际协议限制，不匹配节点名称或递归检查组。
 * @preserve
 * @param {Object} proxy 待检查的节点，使用 type 和 dialer-proxy 字段。
 * @param {{excludeDialer: boolean, types: Set<string>|null}} policy 已校验的策略；types 为 null 时不限协议。
 * @returns {boolean} 两项限制均满足时返回 true；dialer-proxy 按真值判断。
 */
function matchesPolicy(proxy, policy) {
  return (
    (!policy.excludeDialer || !proxy['dialer-proxy']) &&
    (!policy.types || policy.types.has(String(proxy.type).toLowerCase()))
  );
}

/**
 * 按 append、replace 或 manual 策略生成一个组，并剥离 x-substore 声明。
 * append 的已有真实节点也受协议和中转限制，filter 仅筛选动态成员；manual 保留原成员。
 * @preserve
 * @param {Object} group 含原始固定候选及筛选条件的代理组。
 * @param {{mode: string, excludeDialer: boolean, types: Set<string>|null}} policy 已校验并规范化的成员策略。
 * @param {Array<Object>} allProxies 当前具有有效名称的注入节点，按原输入顺序排列。
 * @param {Map<string, Object>} proxiesByName 节点名称索引，用于识别已有成员中的真实节点。
 * @returns {Object} 新建的代理组对象；不修改输入，未更新的嵌套字段保留引用。
 */
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

/**
 * 先校验全部成员策略，再按组声明生成最终成员，不修改输入组或订阅节点。
 * @preserve
 * @param {Array<Object>} groups 按最终展示顺序排列、各自带有 x-substore.members 的组。
 * @param {Array<Object|null>} proxies 当前注入节点；空节点和名称为空的节点跳过。
 * @returns {Array<Object>} 顺序不变、移除内部声明后的新代理组数组。
 * @throws {Error} 任一组的成员声明缺失、包含未知字段或字段值无效。
 */
export function updateGroupMembers(groups, proxies) {
  const policies = groups.map(readMemberPolicy);
  const allProxies = proxies.filter((proxy) => proxy?.name);
  const proxiesByName = new Map(allProxies.map((proxy) => [proxy.name, proxy]));
  return groups.map((group, index) =>
    updateGroup(group, policies[index], allProxies, proxiesByName),
  );
}
