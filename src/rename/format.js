/**
 * @file 组合节点的地区标签、序号、保留关键词和订阅名。
 * 保留 Viking 原旗帜与展示代码，并按完整名称处理唯一节点的序号。
 */

import { parseVikingName } from './identify.js';
import { extractRetainKeywords } from './keywords.js';
import { REGIONS_BY_CODE } from './regions.js';

/**
 * 将地区代码中的英文字母转为区域指示符，TW 按现有展示约定使用萨摩亚旗帜。
 *
 * @preserve
 * @param {string|null} [countryCode] 地区代码；假值使用通用地球图标。
 * @returns {string} 地区旗帜，或缺少代码时的 🌐。
 */
function getFlagEmoji(countryCode) {
  if (!countryCode) return '🌐';
  if (countryCode.toUpperCase() === 'TW') return '🇼🇸';
  return countryCode
    .toUpperCase()
    .replace(/[A-Z]/gu, (char) => String.fromCodePoint(char.charCodeAt(0) + 127397));
}

/**
 * 按指定字段顺序组合地区标签，优先保留 Viking 名称自带的旗帜和展示代码。
 * 中文名和英文全称查不到地区记录时回退到传入代码。
 *
 * @preserve
 * @param {string} countryCode 已识别的标准地区代码。
 * @param {import('./identify.js').VikingName|null} vikingName Viking 解析结果；null 使用标准地区展示。
 * @param {string[]} outputFields 输出字段顺序，可包含 FG、ZH、EN、QC。
 * @returns {string} 用空格连接的地区标签。
 */
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

/**
 * 组合地区标签、至少两位序号、原名或保留关键词以及订阅名，不修改节点。
 * Viking 后缀按未经 block 清理的原名解析，仅在其地区与识别结果一致时采用。
 *
 * @preserve
 * @param {Object} proxy 待命名的节点。
 * @param {string} proxy.name 原节点名，用于保留原文、提取关键词和解析 Viking 格式。
 * @param {string} [proxy._subName] 追加到名称末尾的订阅名；假值不追加。
 * @param {string} countryCode 已识别的标准地区代码。
 * @param {number} sequence 当前订阅及地区分组中的序号，从 1 开始。
 * @param {import('./options.js').RenameOptions} options 已解析的输出格式和保留选项。
 * @returns {string} 格式化后的完整节点名称。
 * @throws {SyntaxError} 需要提取关键词且某个关键词无法编译为正则时抛出。
 */
export function formatProxyName(proxy, countryCode, sequence, options) {
  // 输出按原名解析 Viking 格式；block 只参与地区识别，不能影响后缀。
  const parsedName = parseVikingName(proxy.name);
  const vikingName = parsedName?.countryCode === countryCode ? parsedName : null;
  const subName = proxy._subName || '';
  const countryLabel = formatCountryLabel(countryCode, vikingName, options.outputFields);
  const baseName = [countryLabel, String(sequence).padStart(2, '0')].filter(Boolean).join(' ');
  /**
   * 在名称后追加当前节点的订阅名，忽略空片段。
   *
   * @preserve
   * @param {string} name 需要保留的名称或关键词片段。
   * @returns {string} 用空格连接的片段与订阅名。
   */
  const appendSubName = (name) => [name, subName].filter(Boolean).join(' ');
  /**
   * 用管道分隔非空命名片段。
   *
   * @preserve
   * @param {...string} parts 按输出顺序传入的地区序号和名称后缀。
   * @returns {string} 用“ | ”连接且不含空片段的名称。
   */
  const joinNameParts = (...parts) => parts.filter(Boolean).join(' | ');

  if (!options.removeOriginalName) return joinNameParts(baseName, appendSubName(proxy.name));
  if (!options.retainKeywords) return joinNameParts(baseName, subName);
  if (vikingName) return joinNameParts(baseName, appendSubName(vikingName.suffix));

  const retained = extractRetainKeywords(proxy.name, options.retainKeywords);
  return joinNameParts(baseName, appendSubName(retained.join(' ')));
}

/**
 * 按去掉两位序号后的完整名称计数，只为计数为一的名称移除 01 序号。
 * 后缀不同视为不同名称；直接修改传入节点对象的 name，其他序号保持原样。
 *
 * @preserve
 * @param {Array<{name: string}>} proxies 已完成命名和筛选的节点，亦可包含保留原名的未知地区节点。
 * @returns {void} 无返回值，修改结果保存在原节点对象中。
 */
export function removeUniqueSequence(proxies) {
  /**
   * 移除位于名称末尾或管道后缀之前的两位序号，用于归并完整名称。
   *
   * @preserve
   * @param {string} name 待计算归并键的完整名称。
   * @returns {string} 移除两位序号但保留原管道后缀的名称；不匹配时返回原文。
   */
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
