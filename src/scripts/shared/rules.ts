/**
 * @file 构建合并与运行时覆写共用的内置策略和规则引用校验。
 * 由调用方提供报错函数，不依赖任何特定处理阶段。
 */

import type { ConfigMap } from './types.ts';

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
 * @param {Function} fail 接收错误原因并抛出异常的函数，由调用方明确提供。
 * @returns {void} 引用有效时正常返回。
 * @throws {Error} 规则列表、规则值或引用无效时抛出调用方指定的配置错误。
 */
export function validateRuleReferences(
  rules: unknown,
  targets: Set<string>,
  providers: ConfigMap,
  fail: (message: string) => never,
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
