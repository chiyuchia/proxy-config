/**
 * @file 从节点名称识别地区。
 * 按既定优先级匹配别名、地区名、旗帜和代码，仅使用名称，不访问网络。
 */

import { REGION_ALIASES } from './aliases.ts';
import { REGIONS } from './regions.ts';
import type { Region } from './regions.ts';
import type { ProxyNode } from '../types.ts';

interface RegionMatcher {
  region: Region;
  longerChineseNames: string[];
  englishPattern: RegExp;
  codePattern: RegExp;
}

/**
 * 转义字符串中的正则元字符，使带括号或点号的地区名按字面匹配。
 *
 * @preserve
 * @param {string} value 待转义的原始文本。
 * @returns {string} 可安全拼接进正则表达式的转义文本。
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 为英文地区名构建忽略大小写且限制字母边界的正则，兼容空格省略与驼峰分词。
 *
 * @preserve
 * @param {string} englishName 地区表中的标准英文名。
 * @returns {RegExp} 限制前后非英文字母的不区分大小写正则。
 */
function createEnglishNamePattern(englishName: string): RegExp {
  const flexibleSpacing = escapeRegExp(englishName)
    .replace(/ /g, '\\s*')
    .replace(/([a-z])([A-Z])/g, '$1\\s*$2');
  return new RegExp(`(?<![A-Za-z])${flexibleSpacing}(?![A-Za-z])`, 'i');
}

const REGION_MATCHERS: RegionMatcher[] = REGIONS.map((region) => ({
  region,
  longerChineseNames: REGIONS.filter(
    (other) => other.code !== region.code && other.chineseName.includes(region.chineseName),
  ).map((other) => other.chineseName),
  englishPattern: createEnglishNamePattern(region.englishName),
  codePattern: new RegExp(`(?<![A-Za-z])${escapeRegExp(region.code)}(?![A-Za-z])`, 'i'),
}));

/**
 * 先替换地区别名，再依次匹配中文名、国旗、英文全称和地区代码。
 * 各阶段均按地区表顺序返回首个命中；英文全称和地区代码忽略大小写并限制字母边界。
 *
 * @preserve
 * @param {string} name 待识别的节点名称。
 * @returns {string|null} 命中的标准地区代码；没有匹配时返回 null。
 */
export function matchNameToCode(name: string): string | null {
  let processed = name;
  for (const [target, pattern] of Object.entries(REGION_ALIASES)) {
    processed = processed.replace(pattern, target);
  }

  for (const { region, longerChineseNames } of REGION_MATCHERS) {
    if (!processed.includes(region.chineseName)) continue;
    const masked = longerChineseNames.reduce(
      (text, longer) => text.replaceAll(longer, '\0'),
      processed,
    );
    if (masked.includes(region.chineseName)) return region.code;
  }
  for (const { region } of REGION_MATCHERS) {
    if (processed.includes(region.flag)) return region.code;
  }
  for (const { region, englishPattern } of REGION_MATCHERS) {
    if (englishPattern.test(processed)) return region.code;
  }
  for (const { region, codePattern } of REGION_MATCHERS) {
    if (codePattern.test(processed)) return region.code;
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
