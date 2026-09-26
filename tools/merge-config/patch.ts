/**
 * @file 实现配置映射、数组和代理组的合并与补丁操作。
 * 映射递归合并，代理组按名称合并，按既定补丁顺序保留候选优先级。
 */

import { checkConfigKey, configError, copyConfigValue, requireArray } from './value.ts';
import { isConfigMap } from '../../src/scripts/shared/value.ts';
import { checkGroupNames } from './validation.ts';
import type { ConfigMap } from '../../src/scripts/shared/types.ts';

type NamedConfigMap = ConfigMap & { name: string };

/**
 * 判断映射是否声明字段删除操作，仅检查自有 $delete 键，不验证其取值或额外字段。
 *
 * @preserve
 * @param {*} value 待识别的字段补丁值。
 * @returns {boolean} 值为配置映射且具有自有 $delete 键时返回 true。
 */
function isDeletePatch(value: unknown): value is ConfigMap {
  return isConfigMap(value) && Object.hasOwn(value, '$delete');
}

/**
 * 校验字段删除补丁必须恰好包含 `$delete: true`，不执行删除或修改补丁。
 *
 * @preserve
 * @param {Object<string, *>} patch 已识别为含 $delete 键的配置映射。
 * @param {string} path 用于错误信息的字段路径。
 * @returns {void} 删除标记及字段数量符合要求时正常返回。
 * @throws {Error} $delete 不为 true 或补丁包含其他字段时抛出配置错误。
 */
function validateDeletePatch(patch: ConfigMap, path: string): void {
  if (patch.$delete !== true || Object.keys(patch).length !== 1) {
    configError(`${path} 删除字段时只能填写 {$delete: true}`);
  }
}

/**
 * 复制原数组，依次执行删除、头部追加、尾部追加和指定成员前插入，不修改输入。
 * 删除项通过 JSON 序列化结果比较；插入锚点匹配第一个完全相同的现有字符串成员。
 *
 * @preserve
 * @param {Array<*>} original 待修改的现有数组，必须已存在。
 * @param {Object<string, *>} patch 仅含 $remove、$prepend、$append、$insert-before 的数组补丁。
 * @param {string} path 用于定位数组及操作错误的配置路径。
 * @returns {Array<*>} 应用补丁后的新数组，保留操作顺序，不自动去重或排序。
 * @throws {Error} 操作未知、字段类型不符、插入锚点不存在或待复制配置值无效时抛出错误。
 */
function patchConfigArray(original: unknown, patch: ConfigMap, path: string): unknown[] {
  const allowed = ['$remove', '$prepend', '$append', '$insert-before'];
  for (const key of Object.keys(patch)) {
    if (!allowed.includes(key)) configError(`${path} 未知数组操作：${key}`);
  }
  let result = copyConfigValue(requireArray(original, path)) as unknown[];
  if (Object.hasOwn(patch, '$remove')) {
    const removed = requireArray(patch.$remove, `${path}.$remove`);
    result = result.filter(
      (item) => !removed.some((value) => JSON.stringify(item) === JSON.stringify(value)),
    );
  }
  if (Object.hasOwn(patch, '$prepend')) {
    result = [
      ...(copyConfigValue(requireArray(patch.$prepend, `${path}.$prepend`)) as unknown[]),
      ...result,
    ];
  }
  if (Object.hasOwn(patch, '$append')) {
    result.push(...(copyConfigValue(requireArray(patch.$append, `${path}.$append`)) as unknown[]));
  }
  if (Object.hasOwn(patch, '$insert-before')) {
    if (!isConfigMap(patch['$insert-before'])) configError(`${path}.$insert-before 必须是映射`);
    for (const [anchor, values] of Object.entries(patch['$insert-before'])) {
      const index = result.indexOf(anchor);
      if (index < 0) configError(`${path} 找不到插入位置：${anchor}`);
      result.splice(
        index,
        0,
        ...(copyConfigValue(requireArray(values, `${path}.$insert-before.${anchor}`)) as unknown[]),
      );
    }
  }
  return result;
}

/**
 * 递归合并配置映射，执行字段删除及数组补丁；标量和普通数组直接替换原值。
 * 根级 proxy-groups 按组名合并，其他普通映射按键合并，整个过程不修改两个输入。
 *
 * @preserve
 * @param {*} original 原配置值；新增字段时可为 undefined，数组补丁要求已有数组。
 * @param {*} patch 覆盖值或补丁映射；普通值必须能由 copyConfigValue 复制。
 * @param {string} [path=''] 当前配置路径；空字符串表示根级，同时用于错误定位。
 * @returns {Object<string, *>|Array<*>|string|boolean|number|null} 合并后的独立容器或替换标量。
 * @throws {Error} 配置键或值无效、补丁不合法、删除目标不存在或组操作失败时抛出错误。
 */
export function mergeConfigValue(original: unknown, patch: unknown, path: string = ''): unknown {
  if (!isConfigMap(patch)) return copyConfigValue(patch);
  if (Object.keys(patch).some((key) => key.startsWith('$'))) {
    return patchConfigArray(original, patch, path);
  }
  const result: ConfigMap = isConfigMap(original) ? (copyConfigValue(original) as ConfigMap) : {};
  for (const [key, value] of Object.entries(patch)) {
    checkConfigKey(key);
    const field = path ? `${path}.${key}` : key;
    if (isDeletePatch(value)) {
      validateDeletePatch(value, field);
      if (!Object.hasOwn(result, key)) configError(`${field} 不存在，无法删除`);
      delete result[key];
    } else if (!path && key === 'proxy-groups') {
      result[key] = mergeProxyGroups(result[key] ?? [], value);
    } else {
      result[key] = mergeConfigValue(result[key], value, field);
    }
  }
  return result;
}

/**
 * 按原始组名应用代理组补丁，支持字段合并、删除，以及 $before/$after 定位。
 * 未指定位置时保留已有组的位置、新组追加到末尾；所有操作作用于原列表的副本。
 *
 * @preserve
 * @param {Array<Object<string, *>>} original 原代理组列表，名称须有效且不重复。
 * @param {Array<Object<string, *>>} patches 按执行顺序排列的组补丁，每个组名在补丁中只能出现一次。
 * @returns {Array<Object<string, *>>} 合并并定位后的新代理组列表，不与输入共享容器。
 * @throws {Error} 组名、字段补丁、删除操作、定位操作或定位目标不合法时抛出配置错误。
 */
function mergeProxyGroups(original: unknown, patches: unknown): NamedConfigMap[] {
  checkGroupNames(original, 'base.proxy-groups');
  checkGroupNames(patches, 'profile.proxy-groups');
  const result = copyConfigValue(original) as NamedConfigMap[];
  for (const patch of patches as NamedConfigMap[]) {
    const { name, $before, $after, $delete, ...fields } = patch;
    const index = result.findIndex((group) => group.name === name);
    for (const key of Object.keys(fields)) {
      if (key.startsWith('$')) configError(`${name} 未知代理组操作：${key}`);
    }
    if (Object.hasOwn(patch, '$delete')) {
      if ($delete !== true || Object.keys(patch).length !== 2 || index < 0) {
        configError(`${name} 删除代理组时必须仅填写已有 name 和 $delete: true`);
      }
      result.splice(index, 1);
      continue;
    }
    if (Object.hasOwn(patch, '$before') && Object.hasOwn(patch, '$after')) {
      configError(`${name} 不能同时使用 $before 和 $after`);
    }
    const group = mergeConfigValue(
      index < 0 ? {} : result[index],
      { name, ...fields },
      `proxy-groups.${name}`,
    ) as NamedConfigMap;
    const position = Object.hasOwn(patch, '$before')
      ? '$before'
      : Object.hasOwn(patch, '$after')
        ? '$after'
        : null;
    if (position) {
      const anchor = position === '$before' ? $before : $after;
      if (typeof anchor !== 'string' || anchor === name) configError(`${name} 无效的 ${position}`);
      if (index >= 0) result.splice(index, 1);
      const anchorIndex = result.findIndex((item) => item.name === anchor);
      if (anchorIndex < 0) configError(`${name} 找不到代理组位置：${anchor}`);
      result.splice(anchorIndex + (position === '$after' ? 1 : 0), 0, group);
    } else if (index < 0) {
      result.push(group);
    } else {
      result[index] = group;
    }
  }
  return result;
}
