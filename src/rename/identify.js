/**
 * @file 从节点名称识别地区并解析 Viking 的线路与服务商格式。
 * 按既定优先级匹配别名、地区名、旗帜和代码，仅使用名称，不访问网络。
 */

import { REGION_ALIASES } from './aliases.js';
import { REGIONS, REGIONS_BY_CODE } from './regions.js';

/** 中文名 → 国旗 → 英文全称 → 地区代码；各阶段均使用地区表原有顺序。 */
export function matchNameToCode(name) {
  let processed = name;
  for (const [target, pattern] of Object.entries(REGION_ALIASES)) {
    if (pattern.test(processed)) processed = processed.replace(pattern, target);
  }

  for (const field of ['chineseName', 'flag', 'englishName']) {
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

function normalizeCountryCode(code) {
  const upper = String(code || '').toUpperCase();
  if (REGIONS_BY_CODE.has(upper)) return upper;
  return upper === 'UK' ? 'GB' : null;
}

/**
 * VikingLinks：COUNTRY-NN-PROVIDER 或 COUNTRY-LINE-NN-PROVIDER。
 * 地区识别使用标准代码，输出保留 UK 等原展示码以及节点自带的旗帜。
 */
export function parseVikingName(name) {
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
  let providerParts = [];
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

export function identifyCountry(proxy, blockPattern) {
  if (!proxy.server) return null;
  const cleanName = blockPattern ? proxy.name.replace(blockPattern, '') : proxy.name;
  // Viking 格式先于域名剥离解析，避免改变线路或提供商名称的分段。
  const vikingName = parseVikingName(cleanName);
  const withoutDomains = cleanName.replace(/[a-zA-Z0-9]([a-zA-Z0-9-]*\.)+[a-zA-Z]+/g, '');
  return vikingName?.countryCode || matchNameToCode(withoutDomains);
}
