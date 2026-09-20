/**
 * @file 提供 YAML 配置值的类型检查、深拷贝和统一错误格式。
 * 仅接受映射、数组与普通标量，复制时拒绝可能影响对象原型的配置键。
 */

export function isConfigMap(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

export function configError(message) {
  throw new Error(`[merge-config] ${message}`);
}

export function checkConfigKey(key) {
  if (['__proto__', 'constructor', 'prototype'].includes(key)) {
    configError(`不允许的配置键：${key}`);
  }
}

export function copyConfigValue(value) {
  if (Array.isArray(value)) return value.map(copyConfigValue);
  if (isConfigMap(value)) {
    const result = {};
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

export function requireArray(value, path) {
  if (!Array.isArray(value)) configError(`${path} 必须是数组`);
  return value;
}
