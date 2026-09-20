/**
 * @file 校验配置中声明的节点成员生成策略，不根据代理组名称推断行为。
 * x-substore 仅用于合并与覆写之间传递指令，最终客户端配置中移除。
 */

const MEMBER_MODES = new Set(['append', 'replace', 'manual']);
const MEMBER_FIELDS = new Set(['mode', 'exclude-dialer', 'types']);

function policyError(group, field, message) {
  throw new Error(`[config-overwrite] ${group?.name || '未命名代理组'}.${field} ${message}`);
}

function requireMap(value, group, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    policyError(group, field, '必须为映射；请从合并后的模板生成，不要重复覆写最终配置');
  }
}

/** 每个组必须显式声明 mode；可选限制只作用于注入节点。 */
export function readMemberPolicy(group) {
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
  if (!MEMBER_MODES.has(policy.mode)) {
    policyError(group, `${field}.mode`, '必须为 append、replace 或 manual');
  }
  if (Object.hasOwn(policy, 'exclude-dialer') && typeof policy['exclude-dialer'] !== 'boolean') {
    policyError(group, `${field}.exclude-dialer`, '必须为布尔值');
  }
  let types = null;
  if (Object.hasOwn(policy, 'types')) {
    if (
      !Array.isArray(policy.types) ||
      policy.types.length === 0 ||
      policy.types.some((type) => typeof type !== 'string' || !type.trim())
    ) {
      policyError(group, `${field}.types`, '必须为非空协议名称数组；不限协议时省略该字段');
    }
    types = new Set(policy.types.map((type) => type.trim().toLowerCase()));
  }
  return { mode: policy.mode, excludeDialer: policy['exclude-dialer'] ?? false, types };
}
