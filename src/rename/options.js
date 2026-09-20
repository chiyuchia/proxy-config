/**
 * @file 解析重命名参数及其默认值，生成过滤正则、保留词和输出字段。
 * 保留 Sub-Store 的布尔值与字符串语义；参数用法统一维护在 README.md。
 */

import { HOT_REGIONS, REGIONS_BY_CODE } from './regions.js';

const DEFAULT_FILTER_WORDS = [
  '过期',
  '剩余',
  '官网',
  '套餐',
  '重置',
  '到期',
  'Traffic',
  'Expire',
  '一元机场',
  '客户端',
  '网站',
];
const VALID_OUTPUT_FIELDS = new Set(['FG', 'ZH', 'EN', 'QC']);

function parseHotRegions(value) {
  if (!value) return null;
  const codes = String(value)
    .toUpperCase()
    .split('|')
    .map((code) => code.trim())
    .filter(Boolean);
  const matched = new Set(codes.filter((code) => REGIONS_BY_CODE.has(code)));
  return matched.size > 0 ? matched : HOT_REGIONS;
}

function parseFilterPattern(value) {
  // 只有显式空值禁用过滤；false/0 仍应用内置过滤词。
  if (value !== undefined && String(value).trim() === '') return null;
  const customWords = value
    ? decodeURIComponent(String(value))
        .split('|')
        .map((word) => word.trim())
        .filter(Boolean)
    : [];
  return new RegExp(
    [...DEFAULT_FILTER_WORDS, ...customWords]
      .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|'),
    'i',
  );
}

function parseRetainKeywords(value) {
  if (value === undefined) return [];
  const text = String(value).trim();
  if (text === '0' || text.toLowerCase() === 'false') return null;
  return text
    .split('|')
    .map((word) => word.trim())
    .filter((word) => word && word !== '1' && word.toLowerCase() !== 'true');
}

/**
 * 保留 Sub-Store 既有参数语义：remove/one 按 JavaScript 真值处理，
 * filter/block 解码 URL 文本，retain 则单独识别字符串 false/0。
 */
export function parseRenameOptions(args = {}) {
  const outputFields = (args?.out ? String(args.out) : 'FG|EN')
    .split('|')
    .map((field) => field.trim().toUpperCase())
    .filter((field) => VALID_OUTPUT_FIELDS.has(field));

  return {
    removeOriginalName: args?.remove === undefined ? true : !!args.remove,
    removeUniqueSequence: !!args?.one,
    hotRegions: parseHotRegions(args?.hot),
    filterPattern: parseFilterPattern(args?.filter),
    blockPattern: args?.block ? new RegExp(decodeURIComponent(String(args.block)), 'gi') : null,
    retainKeywords: parseRetainKeywords(args?.retain),
    outputFields: outputFields.length > 0 ? outputFields : ['FG', 'EN'],
  };
}
