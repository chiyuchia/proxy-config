/**
 * @file 组合节点的地区标签、序号、保留关键词和订阅名。
 * 保留 Viking 原旗帜与展示代码，所有已识别节点固定保留序号。
 */

import { parseVikingName } from './identify.ts';
import { extractRetainKeywords } from './keywords.ts';
import type { VikingName } from './identify.ts';
import type { ProxyNode } from '../types.ts';

/**
 * 将地区代码中的英文字母转为区域指示符，TW 按现有展示约定使用萨摩亚旗帜。
 *
 * @preserve
 * @param {string|null} [countryCode] 地区代码；假值使用通用地球图标。
 * @returns {string} 地区旗帜，或缺少代码时的 🌐。
 */
function getFlagEmoji(countryCode?: string | null): string {
  if (!countryCode) return '🌐';
  if (countryCode.toUpperCase() === 'TW') return '🇼🇸';
  return countryCode
    .toUpperCase()
    .replace(/[A-Z]/gu, (char) => String.fromCodePoint(char.charCodeAt(0) + 127397));
}

/**
 * 组合旗帜与地区代码，优先保留 Viking 名称自带的旗帜和展示代码。
 *
 * @preserve
 * @param {string} countryCode 已识别的标准地区代码。
 * @param {import('./identify.ts').VikingName|null} vikingName Viking 解析结果；null 使用标准地区展示。
 * @returns {string} 用空格连接的地区标签。
 */
function formatCountryLabel(countryCode: string, vikingName: VikingName | null): string {
  return [
    vikingName?.flag || getFlagEmoji(countryCode),
    vikingName ? vikingName.displayCode : countryCode,
  ].join(' ');
}

/**
 * 组合地区标签、至少两位序号、内置保留关键词以及订阅名，不修改节点。
 * Viking 后缀按原名解析，仅在其地区与识别结果一致时采用。
 *
 * @preserve
 * @param {Object} proxy 待命名的节点。
 * @param {string} proxy.name 原节点名，用于提取关键词和解析 Viking 格式。
 * @param {string} [proxy._subName] 追加到名称末尾的订阅名；假值不追加。
 * @param {string} countryCode 已识别的标准地区代码。
 * @param {number} sequence 当前订阅及地区分组中的序号，从 1 开始。
 * @returns {string} 格式化后的完整节点名称。
 * @throws {SyntaxError} 内置关键词无法编译为正则时抛出。
 */
export function formatProxyName(proxy: ProxyNode, countryCode: string, sequence: number): string {
  const parsedName = parseVikingName(proxy.name);
  const vikingName = parsedName?.countryCode === countryCode ? parsedName : null;
  const subName = proxy._subName || '';
  const countryLabel = formatCountryLabel(countryCode, vikingName);
  const baseName = [countryLabel, String(sequence).padStart(2, '0')].filter(Boolean).join(' ');
  /**
   * 在名称后追加当前节点的订阅名，忽略空片段。
   *
   * @preserve
   * @param {string} name 需要保留的名称或关键词片段。
   * @returns {string} 用空格连接的片段与订阅名。
   */
  const appendSubName = (name: string): string => [name, subName].filter(Boolean).join(' ');
  /**
   * 用管道分隔非空命名片段。
   *
   * @preserve
   * @param {...string} parts 按输出顺序传入的地区序号和名称后缀。
   * @returns {string} 用“ | ”连接且不含空片段的名称。
   */
  const joinNameParts = (...parts: string[]): string => parts.filter(Boolean).join(' | ');

  if (vikingName) return joinNameParts(baseName, appendSubName(vikingName.suffix));

  const retained = extractRetainKeywords(proxy.name);
  return joinNameParts(baseName, appendSubName(retained.join(' ')));
}
