/**
 * @file 从节点名称识别地区并解析 Viking 的线路与服务商格式。
 * 按既定优先级匹配别名、地区名、旗帜和代码，仅使用名称，不访问网络。
 */

import { REGION_ALIASES } from './aliases.ts';
import { REGIONS, REGIONS_BY_CODE } from './regions.ts';
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
 * 将地区代码转为大写，并把展示用的 UK 映射为标准代码 GB。
 *
 * @preserve
 * @param {*} code 待归一化的代码；假值按空字符串处理。
 * @returns {string|null} 地区表中存在的标准代码；未知代码返回 null。
 */
function normalizeCountryCode(code: unknown): string | null {
  const upper = String(code || '').toUpperCase();
  if (REGIONS_BY_CODE.has(upper)) return upper;
  return upper === 'UK' ? 'GB' : null;
}

/** Viking 格式解析得到的地区标记与命名后缀。 */
export interface VikingName {
  /** 用于识别和分组的标准地区代码。 */
  countryCode: string;
  /** 原名中的大写展示代码，保留 UK 等写法。 */
  displayCode: string;
  /** 原名开头的旗帜；未提供时为空字符串。 */
  flag: string;
  /** 用空格拼接的线路和服务商，不包含原序号。 */
  suffix: string;
}

/**
 * 解析 COUNTRY-NN-PROVIDER 或 COUNTRY-LINE-NN-PROVIDER 格式。
 * 不检查订阅来源；允许开头带国旗，序号为一至三位数字，服务商可包含连字符分段。
 *
 * @preserve
 * @param {*} name 原节点名；假值按空字符串处理，其余值转为字符串并去除首尾空白。
 * @returns {VikingName|null} 标准代码、展示代码、原旗帜及后缀；格式或地区无效时返回 null。
 */
export function parseVikingName(name: unknown): VikingName | null {
  const trimmed = String(name || '').trim();
  const flagMatch = trimmed.match(/^([\u{1F1E6}-\u{1F1FF}]{2})\s*/u);
  const rawName = flagMatch ? trimmed.slice(flagMatch[0].length) : trimmed;
  const parts = rawName
    .split('-')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 3 || !/^[A-Z]{2}$/i.test(parts[0])) return null;

  const displayCode = parts[0].toUpperCase();
  const countryCode = normalizeCountryCode(displayCode);
  if (!countryCode) return null;

  let line = '';
  let providerParts: string[] = [];
  if (/^\d{1,3}$/.test(parts[1])) {
    providerParts = parts.slice(2);
  } else if (parts.length >= 4 && /^\d{1,3}$/.test(parts[2])) {
    line = parts[1];
    providerParts = parts.slice(3);
  } else {
    return null;
  }
  const provider = providerParts.join(' ').replace(/\s+/g, ' ').trim();
  if (!provider) return null;

  return {
    countryCode,
    displayCode,
    flag: flagMatch?.[1] || '',
    suffix: [line, provider].filter(Boolean).join(' '),
  };
}

/**
 * 从节点名称识别地区：先尝试 Viking 格式，再剥离域名并匹配地区。
 * 与服务器地址和订阅来源无关，不访问网络。
 *
 * @preserve
 * @param {string} name 待识别的节点名称。
 * @returns {string|null} 命中的标准地区代码；无法识别时返回 null。
 */
export function identifyCountryFromName(name: string): string | null {
  // Viking 格式先于域名剥离解析，避免改变线路或提供商名称的分段。
  const vikingName = parseVikingName(name);
  const withoutDomains = name.replace(/[a-zA-Z0-9]([a-zA-Z0-9-]*\.)+[a-zA-Z]+/g, '');
  return vikingName?.countryCode || matchNameToCode(withoutDomains);
}

/**
 * 仅从节点名称识别地区：先移除屏蔽内容并尝试 Viking 格式，再剥离域名并匹配地区。
 * 不修改节点；server 为假值时直接返回 null，不执行名称识别。
 *
 * @preserve
 * @param {Object} proxy 待识别的节点。
 * @param {string} proxy.name 原节点名。
 * @param {string} [proxy.server] 节点服务器；仅用于判断是否允许识别，不查询其地理位置。
 * @param {RegExp|null} [blockPattern] 识别前移除名称片段的正则；省略或 null 时不屏蔽。
 * @returns {string|null} 命中的标准地区代码；无法识别时返回 null。
 */
export function identifyCountry(proxy: ProxyNode, blockPattern?: RegExp | null): string | null {
  if (!proxy.server) return null;
  const cleanName = blockPattern ? proxy.name.replace(blockPattern, '') : proxy.name;
  return identifyCountryFromName(cleanName);
}
