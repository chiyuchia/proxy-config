/**
 * @file 校验配置中声明的节点成员生成策略，不根据代理组名称推断行为。
 * x-substore 仅用于合并与覆写之间传递指令，最终客户端配置中移除。
 */

import type { ConfigMap, ProxyGroup } from './types.ts';
import { isHttpUrl } from './http-url.ts';

/** 成员生成方式，必须在模板中显式声明。 */
export type MemberMode = 'append' | 'replace' | 'manual';

/** 为同一方向生成独立节点测速记录所需的已校验参数。 */
export interface BenchmarkPolicy {
  label: string;
  url: string;
  timeout: number | undefined;
}

/** 通过校验并规范化后的成员生成策略。 */
export interface MemberPolicy {
  mode: MemberMode;
  excludeDialer: boolean;
  types: Set<string> | null;
  benchmark: BenchmarkPolicy | null;
}

const MEMBER_MODES = new Set<string>(['append', 'replace', 'manual']);
const MEMBER_FIELDS = new Set(['mode', 'exclude-dialer', 'types', 'benchmark']);

/**
 * 抛出包含代理组名称和字段路径的成员声明错误。
 * @preserve
 * @param {Object|null|undefined} group 出错的组；无名称时使用“未命名代理组”。
 * @param {string} field 出错字段的路径。
 * @param {string} message 错误原因。
 * @returns {never} 始终抛出错误，不正常返回。
 * @throws {Error} 带 config-overwrite 前缀的声明校验错误。
 */
function policyError(group: ProxyGroup | null | undefined, field: string, message: string): never {
  throw new Error(`[config-overwrite] ${group?.name || '未命名代理组'}.${field} ${message}`);
}

/**
 * 确认声明字段是非 null 的对象且不是数组，失败时说明应从合并模板生成配置。
 * @preserve
 * @param {*} value 待校验的字段值。
 * @param {Object|null|undefined} group 字段所属的代理组，用于错误定位。
 * @param {string} field 字段路径。
 * @returns {void} 校验通过时不返回值。
 * @throws {Error} 字段缺失、为 null、数组或非对象值。
 */
function requireMap(
  value: unknown,
  group: ProxyGroup | null | undefined,
  field: string,
): asserts value is ConfigMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    policyError(group, field, '必须为映射；请从合并后的模板生成，不要重复覆写最终配置');
  }
}

/**
 * 读取独立测速标签及组级测速参数，未声明时返回 null，不修改原配置。
 * @preserve
 * @param {Object} group 提供 url 和可选毫秒 timeout 的 url-test 代理组。
 * @param {Object} policy 已通过容器检查的成员策略。
 * @returns {Object|null} 标签去除首尾空白；timeout 转为秒，缺省时为 undefined。
 * @throws {Error} 标签、组类型、模式、中转排除开关或测速参数无效。
 */
function readBenchmarkPolicy(group: ProxyGroup, policy: ConfigMap): BenchmarkPolicy | null {
  if (!Object.hasOwn(policy, 'benchmark')) return null;
  const field = 'x-substore.members.benchmark';
  if (typeof policy.benchmark !== 'string' || !policy.benchmark.trim()) {
    policyError(group, field, '必须为非空字符串标签');
  }
  if (policy.mode !== 'replace' || group.type !== 'url-test') {
    policyError(group, field, '仅可用于 mode: replace 且 type: url-test 的组');
  }
  if (policy['exclude-dialer'] !== true) {
    policyError(group, field, '要求 exclude-dialer: true，避免复制已设置中转的节点');
  }
  if (!isHttpUrl(group.url)) {
    policyError(group, 'url', '必须为有效的 HTTP(S) 地址，以生成独立测速节点');
  }
  const timeout = group.timeout;
  if (
    Object.hasOwn(group, 'timeout') &&
    (typeof timeout !== 'number' || !Number.isFinite(timeout) || timeout <= 0)
  ) {
    policyError(group, 'timeout', '必须为正有限数字，单位为毫秒');
  }
  return {
    label: policy.benchmark.trim(),
    // isHttpUrl 已检查字符串，保留 URL 原值以匹配客户端按 URL 保存的测速结果。
    url: group.url as string,
    timeout: typeof timeout === 'number' ? timeout / 1000 : undefined,
  };
}

/**
 * 校验并读取 x-substore.members，规范化协议列表及可选的中转排除开关。
 * 每组必须显式声明 mode；可选限制只作用于当前注入节点，不修改原声明。
 * @preserve
 * @param {Object} group 含 x-substore.members 映射的代理组。
 * @returns {Object} 成员策略；excludeDialer 默认为 false，types 去除首尾空白并转为小写集合，
 *   types 和 benchmark 省略时为 null；benchmark 含标签、URL 及可选的秒级 timeout。
 * @throws {Error} 声明缺失、字段未知，或成员限制与测速参数的类型或值无效。
 */
export function readMemberPolicy(group: ProxyGroup): MemberPolicy {
  const metadata = group?.['x-substore'];
  requireMap(metadata, group, 'x-substore');
  for (const key of Object.keys(metadata)) {
    if (key !== 'members') policyError(group, `x-substore.${key}`, '是未知字段');
  }

  const policy = metadata.members;
  const field = 'x-substore.members';
  requireMap(policy, group, field);
  for (const key of Object.keys(policy)) {
    if (!MEMBER_FIELDS.has(key)) policyError(group, `${field}.${key}`, '是未知字段');
  }
  if (!MEMBER_MODES.has(policy.mode as string)) {
    policyError(group, `${field}.mode`, '必须为 append、replace 或 manual');
  }
  if (Object.hasOwn(policy, 'exclude-dialer') && typeof policy['exclude-dialer'] !== 'boolean') {
    policyError(group, `${field}.exclude-dialer`, '必须为布尔值');
  }
  let types: Set<string> | null = null;
  if (Object.hasOwn(policy, 'types')) {
    if (
      !Array.isArray(policy.types) ||
      policy.types.length === 0 ||
      policy.types.some((type) => typeof type !== 'string' || !type.trim())
    ) {
      policyError(group, `${field}.types`, '必须为非空协议名称数组；不限协议时省略该字段');
    }
    // 上方逐项确认了非空字符串，保留原有校验顺序后再收窄数组元素类型。
    types = new Set((policy.types as string[]).map((type) => type.trim().toLowerCase()));
  }
  return {
    mode: policy.mode as MemberMode,
    excludeDialer: (policy['exclude-dialer'] as boolean | undefined) ?? false,
    types,
    benchmark: readBenchmarkPolicy(group, policy),
  };
}
