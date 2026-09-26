/** @file 构建合并与运行时覆写共用的配置值类型判断。 */

import type { ConfigMap } from './types.ts';

/**
 * 通过对象类型标签判断值是否可按配置映射处理，不检查其键或内部成员。
 *
 * @preserve
 * @param {*} value 待判断的值，可为任意类型。
 * @returns {boolean} 对象类型标签为 `[object Object]` 时返回 true，否则返回 false。
 */
export function isConfigMap(value: unknown): value is ConfigMap {
  return Object.prototype.toString.call(value) === '[object Object]';
}
