/**
 * @file 实现配置映射、数组和代理组的合并与补丁操作。
 * 映射递归合并，代理组按名称合并，按既定补丁顺序保留候选优先级。
 */

import {
  checkConfigKey,
  configError,
  copyConfigValue,
  isConfigMap,
  requireArray,
} from './value.js';
import { checkGroupNames } from './validation.js';

function isDeletePatch(value) {
  return isConfigMap(value) && Object.hasOwn(value, '$delete');
}

function validateDeletePatch(patch, path) {
  if (patch.$delete !== true || Object.keys(patch).length !== 1) {
    configError(`${path} 删除字段时只能填写 {$delete: true}`);
  }
}

function patchConfigArray(original, patch, path) {
  const allowed = ['$remove', '$prepend', '$append', '$insert-before'];
  for (const key of Object.keys(patch)) {
    if (!allowed.includes(key)) configError(`${path} 未知数组操作：${key}`);
  }
  let result = copyConfigValue(requireArray(original, path));
  if (Object.hasOwn(patch, '$remove')) {
    const removed = requireArray(patch.$remove, `${path}.$remove`);
    result = result.filter(
      (item) => !removed.some((value) => JSON.stringify(item) === JSON.stringify(value)),
    );
  }
  if (Object.hasOwn(patch, '$prepend')) {
    result = [...copyConfigValue(requireArray(patch.$prepend, `${path}.$prepend`)), ...result];
  }
  if (Object.hasOwn(patch, '$append')) {
    result.push(...copyConfigValue(requireArray(patch.$append, `${path}.$append`)));
  }
  if (Object.hasOwn(patch, '$insert-before')) {
    if (!isConfigMap(patch['$insert-before'])) configError(`${path}.$insert-before 必须是映射`);
    for (const [anchor, values] of Object.entries(patch['$insert-before'])) {
      const index = result.indexOf(anchor);
      if (index < 0) configError(`${path} 找不到插入位置：${anchor}`);
      result.splice(
        index,
        0,
        ...copyConfigValue(requireArray(values, `${path}.$insert-before.${anchor}`)),
      );
    }
  }
  return result;
}

export function mergeConfigValue(original, patch, path = '') {
  if (!isConfigMap(patch)) return copyConfigValue(patch);
  if (Object.keys(patch).some((key) => key.startsWith('$'))) {
    return patchConfigArray(original, patch, path);
  }
  const result = isConfigMap(original) ? copyConfigValue(original) : {};
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

function mergeProxyGroups(original, patches) {
  checkGroupNames(original, 'base.proxy-groups');
  checkGroupNames(patches, 'profile.proxy-groups');
  const result = copyConfigValue(original);
  for (const patch of patches) {
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
    );
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
