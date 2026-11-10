/**
 * @file 组合节点的地区标签、序号、保留关键词和订阅名。
 * 所有已识别节点使用统一地区标签并固定保留序号。
 */

import { extractRetainKeywords } from './keywords.ts';
import type { ProxyNode } from '../shared/types.ts';

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
 * 组合地区标签、至少两位序号、内置保留关键词以及订阅名，不修改节点。
 *
 * @preserve
 * @param {Object} proxy 待命名的节点。
 * @param {string} proxy.name 原节点名，用于提取关键词。
 * @param {string} [proxy._subName] 追加到名称末尾的订阅名；假值不追加。
 * @param {string} countryCode 已识别的标准地区代码。
 * @param {number} sequence 当前订阅及地区分组中的序号，从 1 开始。
 * @returns {string} 格式化后的完整节点名称。
 * @throws {SyntaxError} 内置关键词无法编译为正则时抛出。
 */
export function formatProxyName(proxy: ProxyNode, countryCode: string, sequence: number): string {
  const subName = proxy._subName || '';
  const countryLabel = [getFlagEmoji(countryCode), countryCode].join(' ');
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

  const retained = extractRetainKeywords(proxy.name);
  return joinNameParts(baseName, appendSubName(retained.join(' ')));
}
