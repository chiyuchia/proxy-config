/**
 * @file 校验合并后的代理组、节点、provider 与规则引用。
 * 拒绝重复名称、缺失字段和无效引用，避免输出无法使用的客户端配置。
 */

import { configError, isConfigMap, requireArray } from './value.ts';
import { readRuntimeProxyProviders } from '../runtime-providers.ts';
import type { ConfigMap } from '../types.ts';

/** 客户端内置策略及自动生成的 GLOBAL 组；GLOBAL 也允许由配置显式定义。 */
export const BUILTIN_TARGETS = new Set([
  'DIRECT',
  'REJECT',
  'REJECT-DROP',
  'PASS',
  'PASS-RULE',
  'COMPATIBLE',
  'GLOBAL',
]);

/**
 * 逻辑规则按括号之外的逗号拆分，其他规则沿用普通逗号拆分。
 * 不将普通正则规则中的转义括号误认为逻辑条件边界。
 * @preserve
 * @param {string} rule 原始规则字符串。
 * @returns {string[]} 去除字段首尾空白的顶层字段，不验证完整条件语法。
 */
function splitRuleFields(rule: string): string[] {
  if (!/^\s*(?:AND|OR|NOT)\s*,/.test(rule)) {
    return rule.split(',').map((part) => part.trim());
  }
  const fields: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < rule.length; index += 1) {
    if (rule[index] === '(') depth += 1;
    else if (rule[index] === ')') depth -= 1;
    else if (rule[index] === ',' && depth === 0) {
      fields.push(rule.slice(start, index).trim());
      start = index + 1;
    }
  }
  fields.push(rule.slice(start).trim());
  return fields;
}

/**
 * 检查规则中的策略与顶层 RULE-SET 引用，供合并和最终覆写共用。
 * 识别规则末尾的 no-resolve、no-track 选项，不解析客户端的完整规则语法。
 * @preserve
 * @param {*} rules 规则字符串数组，不修改输入。
 * @param {Set<string>} targets 可引用的节点、组及内置策略名称。
 * @param {Object} providers 已定义的 rule-provider 映射。
 * @param {Function} [fail=configError] 接收错误原因并抛出异常的函数。
 * @returns {void} 引用有效时正常返回。
 * @throws {Error} 规则列表、规则值或引用无效时抛出指定模块的配置错误。
 */
export function validateRuleReferences(
  rules: unknown,
  targets: Set<string>,
  providers: ConfigMap,
  fail: (message: string) => never = configError,
): void {
  if (!Array.isArray(rules)) fail('rules 必须是数组');
  for (const [index, rule] of rules.entries()) {
    if (typeof rule !== 'string') fail(`rules[${index}] 必须是规则字符串`);
    const parts = splitRuleFields(rule);
    const requiredFields = ['MATCH', 'FINAL'].includes(parts[0]) ? 2 : 3;
    while (
      parts.length > requiredFields &&
      ['no-resolve', 'no-track'].includes(parts.at(-1) ?? '')
    ) {
      parts.pop();
    }
    const target = parts.at(-1) ?? '';
    if (!targets.has(target)) fail(`rules[${index}] 规则引用了不存在的策略：${target}`);
    if (parts[0] === 'RULE-SET' && !Object.hasOwn(providers, parts[1])) {
      fail(`rules[${index}] 规则引用了不存在的 rule-provider：${parts[1]}`);
    }
  }
}

/**
 * 检查代理组列表及名称的有效性，收集名称并拒绝同一列表中的重复项。
 * 名称只用 trim 判断是否为空，重复比较仍使用原始字符串，不修改任何组。
 *
 * @preserve
 * @param {*} groups 待校验的代理组数组，每个元素须为带非空字符串 name 的映射。
 * @param {string} label 错误信息中的来源说明，例如 base.proxy-groups。
 * @returns {Set<string>} 按首次出现顺序收集的原始组名集合。
 * @throws {Error} 输入不是数组、组缺少有效名称或组名重复时抛出配置错误。
 */
export function checkGroupNames(groups: unknown, label: string): Set<string> {
  const names = new Set<string>();
  for (const group of requireArray(groups, label)) {
    if (!isConfigMap(group) || typeof group.name !== 'string' || !group.name.trim()) {
      configError(`${label} 的每个代理组必须有 name`);
    }
    if (names.has(group.name)) configError(`${label} 代理组重名：${group.name}`);
    names.add(group.name);
  }
  return names;
}

/**
 * 校验当前配置的名称、组 type、成员、provider 和规则引用，以及运行时 provider 声明。
 * 只检查已提供的数据，不修改配置，也不校验节点的 dialer-proxy 或覆写阶段的成员声明。
 *
 * @preserve
 * @param {Object<string, *>} config 含 proxy-groups 与 rules 的配置；节点和 provider 定义可省略。
 * @returns {void} 当前配置通过上述结构与引用检查时正常返回。
 * @throws {Error} 名称冲突、必需字段或列表类型无效，或引用目标不存在时抛出配置错误。
 */
export function validateMergedConfig(config: ConfigMap): void {
  const runtimeProviders = readRuntimeProxyProviders(config, configError);
  const groupNames = checkGroupNames(config['proxy-groups'], '合并结果');
  const targets = new Set([...groupNames, ...BUILTIN_TARGETS]);
  for (const proxy of (config.proxies ?? []) as unknown[]) {
    if (!isConfigMap(proxy) || typeof proxy.name !== 'string') configError('订阅节点必须有 name');
    if (targets.has(proxy.name)) configError(`节点或代理组重名：${proxy.name}`);
    targets.add(proxy.name);
  }
  for (const group of config['proxy-groups'] as Array<ConfigMap & { name: string }>) {
    if (typeof group.type !== 'string') configError(`${group.name} 缺少代理组 type`);
    for (const name of requireArray(group.proxies ?? [], `${group.name}.proxies`)) {
      if (typeof name !== 'string' || !targets.has(name)) {
        configError(`${group.name} 引用了不存在的代理或组：${name}`);
      }
    }
    for (const name of requireArray(group.use ?? [], `${group.name}.use`)) {
      if (
        typeof name !== 'string' ||
        (!Object.hasOwn(config['proxy-providers'] ?? {}, name) && !runtimeProviders.has(name))
      ) {
        configError(`${group.name} 引用了不存在的 proxy-provider：${name}`);
      }
    }
  }
  validateRuleReferences(config.rules, targets, (config['rule-providers'] ?? {}) as ConfigMap);
}
