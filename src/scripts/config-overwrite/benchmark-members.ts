/**
 * @file 为声明方向测速的组建立独立中转节点副本，避免客户端共享不同方向的测速记录。
 * 原始节点先经过现有成员筛选，再生成副本；普通组与运行时 provider 保持原处理边界。
 */

import { readMemberPolicy } from '../shared/member-policy.ts';
import type { BenchmarkPolicy } from '../shared/member-policy.ts';
import type { FinalProxyGroup, ProxyGroup, ProxyNode } from '../shared/types.ts';

/** 独立测速成员与本次需要追加的节点，尚未写回原配置。 */
interface BenchmarkMembers {
  groups: FinalProxyGroup[];
  addedProxies: ProxyNode[];
}

/**
 * 确认同一标签始终使用相同 URL 与超时，防止复用副本后隐式改变其他组的测试目标。
 * @preserve
 * @param {Array<Object>} groups 带成员声明的原始代理组，不修改输入。
 * @returns {Array<Object|null>} 与组顺序一致的测速策略；未声明的组为 null。
 * @throws {Error} 成员声明无效，或同一标签的 URL、timeout 不一致。
 */
function readBenchmarks(groups: ProxyGroup[]): (BenchmarkPolicy | null)[] {
  const labels = new Map<string, { policy: BenchmarkPolicy; groupName: string }>();
  return groups.map((group) => {
    const policy = readMemberPolicy(group).benchmark;
    if (!policy) return null;
    const previous = labels.get(policy.label);
    if (
      previous &&
      (previous.policy.url !== policy.url || previous.policy.timeout !== policy.timeout)
    ) {
      throw new Error(
        `[config-overwrite] ${group.name}.x-substore.members.benchmark 与 ${previous.groupName} ` +
          `的 ${policy.label} 标签测速参数冲突：同标签的 url 和 timeout 必须一致`,
      );
    }
    labels.set(policy.label, { policy, groupName: group.name });
    return policy;
  });
}

/**
 * 将已筛选的原始中转成员替换为独立测速副本名称，不修改任何输入对象。
 * 同原节点与标签仅生成一个副本，跨地区池复用；无候选的测速组使用 REJECT，保留 use。
 * @preserve
 * @param {Array<Object>} sourceGroups 保留 x-substore.members 的原始组，顺序与 groups 一致。
 * @param {Array<Object>} groups 已基于原节点完成成员筛选、移除声明的候选组。
 * @param {Array<Object>} proxies 原始注入节点，普通组成员不会获得新生成的副本。
 * @returns {Object} 候选组及待追加节点；无副本时 addedProxies 为空数组，不写回输入。
 * @throws {Error} 声明或测速参数无效、副本名称冲突，或筛选结果引用不存在的节点。
 */
export function generateBenchmarkMembers(
  sourceGroups: ProxyGroup[],
  groups: FinalProxyGroup[],
  proxies: ProxyNode[],
): BenchmarkMembers {
  const benchmarks = readBenchmarks(sourceGroups);
  const proxiesByName = new Map(proxies.map((proxy) => [proxy.name, proxy]));
  const names = new Set([...proxiesByName.keys(), ...sourceGroups.map(({ name }) => name)]);
  const aliases = new Map<string, Map<string, string>>();
  const addedProxies: ProxyNode[] = [];
  const updatedGroups = groups.map((group, index) => {
    const benchmark = benchmarks[index];
    if (!benchmark) return group;
    let labelAliases = aliases.get(benchmark.label);
    if (!labelAliases) {
      labelAliases = new Map();
      aliases.set(benchmark.label, labelAliases);
    }
    const members = (group.proxies ?? []).map((originalName) => {
      const existing = labelAliases.get(originalName);
      if (existing) return existing;
      const original = proxiesByName.get(originalName);
      if (!original) {
        throw new Error(
          `[config-overwrite] ${group.name}.proxies 的独立测速成员不是注入节点：${originalName}`,
        );
      }
      const name = `${original.name} [${benchmark.label}测速]`;
      if (names.has(name)) {
        throw new Error(`[config-overwrite] ${group.name} 生成的独立测速节点名称冲突：${name}`);
      }
      const alias: ProxyNode = {
        ...original,
        name,
        'benchmark-url': benchmark.url,
        'benchmark-disabled': false,
      };
      // 未指定超时时采用客户端默认值，不能继承原节点用于其他测试目标的超时设置。
      delete alias['benchmark-timeout'];
      if (benchmark.timeout !== undefined) alias['benchmark-timeout'] = benchmark.timeout;
      names.add(name);
      labelAliases.set(originalName, name);
      addedProxies.push(alias);
      return name;
    });
    return { ...group, proxies: members.length ? members : ['REJECT'] };
  });
  return { groups: updatedGroups, addedProxies };
}
