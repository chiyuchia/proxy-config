/**
 * @file 校验配置中声明的节点成员生成策略，不根据代理组名称推断行为。
 * x-substore 仅用于合并与覆写之间传递指令，最终客户端配置中移除。
 */

const MEMBER_MODES = new Set(['append', 'replace', 'manual']);
const MEMBER_FIELDS = new Set(['mode', 'exclude-dialer', 'types']);

/**
 * 抛出包含代理组名称和字段路径的成员声明错误。
 * @preserve
 * @param {Object|null|undefined} group 出错的组；无名称时使用“未命名代理组”。
 * @param {string} field 出错字段的路径。
 * @param {string} message 错误原因。
 * @returns {never} 始终抛出错误，不正常返回。
 * @throws {Error} 带 config-overwrite 前缀的声明校验错误。
 */
function policyError(group, field, message) {
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
function requireMap(value, group, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    policyError(group, field, '必须为映射；请从合并后的模板生成，不要重复覆写最终配置');
  }
}

/**
 * 校验并读取 x-substore.members，规范化协议列表及可选的中转排除开关。
 * 每组必须显式声明 mode；可选限制只作用于当前注入节点，不修改原声明。
 * @preserve
 * @param {Object} group 含 x-substore.members 映射的代理组。
 * @returns {{mode: 'append'|'replace'|'manual', excludeDialer: boolean, types: Set<string>|null}}
 *   成员策略；excludeDialer 默认为 false，types 去除首尾空白并转为小写集合，省略时为 null。
 * @throws {Error} 声明缺失、字段未知，或 mode、exclude-dialer、types 的类型或值无效。
 */
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
