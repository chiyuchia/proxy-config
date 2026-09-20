/**
 * @file 组合节点的地区标签、序号、保留关键词和订阅名。
 * 保留 Viking 原旗帜与展示代码，并按完整名称处理唯一节点的序号。
 */

import { parseVikingName } from './identify.js';
import { extractRetainKeywords } from './keywords.js';
import { REGIONS_BY_CODE } from './regions.js';

function getFlagEmoji(countryCode) {
  if (!countryCode) return '🌐';
  if (countryCode.toUpperCase() === 'TW') return '🇼🇸';
  return countryCode
    .toUpperCase()
    .replace(/[A-Z]/gu, (char) => String.fromCodePoint(char.charCodeAt(0) + 127397));
}

function formatCountryLabel(countryCode, vikingName, outputFields) {
  const region = REGIONS_BY_CODE.get(countryCode);
  const values = {
    FG: vikingName?.flag || getFlagEmoji(countryCode),
    ZH: region?.chineseName || countryCode,
    QC: region?.englishName || countryCode,
    EN: vikingName ? vikingName.displayCode : countryCode,
  };
  return outputFields.map((field) => values[field]).join(' ');
}

export function formatProxyName(proxy, countryCode, sequence, options) {
  // 输出按原名解析 Viking 格式；block 只参与地区识别，不能影响后缀。
  const parsedName = parseVikingName(proxy.name);
  const vikingName = parsedName?.countryCode === countryCode ? parsedName : null;
  const subName = proxy._subName || '';
  const countryLabel = formatCountryLabel(countryCode, vikingName, options.outputFields);
  const baseName = [countryLabel, String(sequence).padStart(2, '0')].filter(Boolean).join(' ');
  const appendSubName = (name) => [name, subName].filter(Boolean).join(' ');
  const joinNameParts = (...parts) => parts.filter(Boolean).join(' | ');

  if (!options.removeOriginalName) return joinNameParts(baseName, appendSubName(proxy.name));
  if (!options.retainKeywords) return joinNameParts(baseName, subName);
  if (vikingName) return joinNameParts(baseName, appendSubName(vikingName.suffix));

  const retained = extractRetainKeywords(proxy.name, options.retainKeywords);
  return joinNameParts(baseName, appendSubName(retained.join(' ')));
}

/** 按去掉两位序号后的完整名称计数，后缀不同也视为不同名称。 */
export function removeUniqueSequence(proxies) {
  const withoutSequence = (name) =>
    name.replace(/\s+\d{2}(\s*\|.*)?$/, (_, suffix) => suffix || '');
  const nameCounts = new Map();
  for (const proxy of proxies) {
    const baseName = withoutSequence(proxy.name);
    nameCounts.set(baseName, (nameCounts.get(baseName) || 0) + 1);
  }
  for (const proxy of proxies) {
    if (nameCounts.get(withoutSequence(proxy.name)) === 1) {
      proxy.name = proxy.name.replace(/\s+01(\s*\|)/, '$1').replace(/\s+01$/, '');
    }
  }
}
