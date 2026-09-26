/**
 * @file 提供构建合并使用的 YAML 配置值深拷贝、数组检查和错误格式。
 * 仅接受映射、数组与普通标量，复制时拒绝可能影响对象原型的配置键。
 */

import { isConfigMap } from '../../src/scripts/shared/value.ts';
import type { ConfigMap } from '../../src/scripts/shared/types.ts';

/**
 * 添加合并模块前缀并抛出错误，中止当前配置处理。
 *
 * @preserve
 * @param {string} message 不含模块前缀的错误说明。
 * @returns {never} 始终抛出异常，不正常返回。
 * @throws {Error} 消息带有 `[merge-config]` 前缀的配置错误。
 */
export function configError(message: string): never {
  throw new Error(`[merge-config] ${message}`);
}

/**
 * 拒绝可能影响对象原型的配置键，不修改传入值。
 *
 * @preserve
 * @param {string} key 待复制或合并的映射键。
 * @returns {void} 键不在禁止列表中时正常返回。
 * @throws {Error} 键为 __proto__、constructor 或 prototype 时抛出配置错误。
 */
export function checkConfigKey(key: string): void {
  if (['__proto__', 'constructor', 'prototype'].includes(key)) {
    configError(`不允许的配置键：${key}`);
  }
}

/**
 * 递归复制配置映射和数组，保留允许的标量值，不修改输入或保留容器引用。
 *
 * @preserve
 * @param {*} value 待复制的无循环配置值，仅支持映射、数组、null、字符串、布尔值和有限数值。
 * @returns {Object<string, *>|Array<*>|string|boolean|number|null} 独立的容器副本或原标量值。
 * @throws {Error} 遇到禁止的映射键或不支持的值类型时抛出配置错误。
 */
export function copyConfigValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(copyConfigValue);
  if (isConfigMap(value)) {
    const result: ConfigMap = {};
    for (const [key, item] of Object.entries(value)) {
      checkConfigKey(key);
      result[key] = copyConfigValue(item);
    }
    return result;
  }
  if (value === null || ['string', 'boolean'].includes(typeof value)) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  configError('配置只能包含 YAML 映射、数组和普通标量');
}

/**
 * 校验值是否为数组，供调用方使用统一的配置路径错误信息。
 *
 * @preserve
 * @param {*} value 待校验的值，不检查数组元素类型。
 * @param {string} path 用于错误信息的字段路径或来源说明。
 * @returns {Array<*>} 传入的原数组引用，不创建副本。
 * @throws {Error} value 不是数组时抛出配置错误。
 */
export function requireArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) configError(`${path} 必须是数组`);
  return value;
}
