/**
 * @file 从节点名称识别地区。
 * 按既定优先级匹配别名、地区名、旗帜和代码，仅使用名称，不访问网络。
 */

import { REGION_ALIASES } from './aliases.ts';
import { REGIONS } from './regions.ts';
import type { ProxyNode } from '../types.ts';

/**
 * 先替换地区别名，再依次匹配中文名、国旗、英文全称和地区代码。
 * 各阶段均按地区表顺序返回首个命中；别名替换后的代码匹配忽略大小写并限制字母边界。
 *
 * @preserve
 * @param {string} name 待识别的节点名称。
 * @returns {string|null} 命中的标准地区代码；没有匹配时返回 null。
 */
export function matchNameToCode(name: string): string | null {
  let processed = name;
  for (const [target, pattern] of Object.entries(REGION_ALIASES)) {
    if (pattern.test(processed)) processed = processed.replace(pattern, target);
  }

  for (const field of ['chineseName', 'flag', 'englishName'] as const) {
    for (const region of REGIONS) {
      if (processed.includes(region[field])) return region.code;
    }
  }
  for (const region of REGIONS) {
    const pattern = new RegExp(`(?<![A-Za-z])${region.code}(?![A-Za-z])`, 'i');
    if (pattern.test(processed)) return region.code;
  }
  return null;
}

/**
 * 从节点名称剥离域名并匹配地区。
 * 与服务器地址和订阅来源无关，不访问网络。
 *
 * @preserve
 * @param {string} name 待识别的节点名称。
 * @returns {string|null} 命中的标准地区代码；无法识别时返回 null。
 */
export function identifyCountryFromName(name: string): string | null {
  const withoutDomains = name.replace(/[a-zA-Z0-9]([a-zA-Z0-9-]*\.)+[a-zA-Z]+/g, '');
  return matchNameToCode(withoutDomains);
}

/**
 * 仅从原节点名称识别地区，先剥离域名再匹配地区。
 * 不修改节点；server 为假值时直接返回 null，不执行名称识别。
 *
 * @preserve
 * @param {Object} proxy 待识别的节点。
 * @param {string} proxy.name 原节点名。
 * @param {string} [proxy.server] 节点服务器；仅用于判断是否允许识别，不查询其地理位置。
 * @returns {string|null} 命中的标准地区代码；无法识别时返回 null。
 */
export function identifyCountry(proxy: ProxyNode): string | null {
  if (!proxy.server) return null;
  return identifyCountryFromName(proxy.name);
}
