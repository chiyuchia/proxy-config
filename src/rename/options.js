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

/**
 * 将 hot 参数转为允许保留的地区集合。
 * 真值中没有有效地区代码时使用内置热门集合；返回内置集合时不复制它。
 *
 * @preserve
 * @param {*} [value] hot 原始值；假值关闭筛选，真值按竖线分隔并忽略大小写。
 * @returns {Set<string>|null} 有效地区集合；关闭筛选时返回 null。
 */
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

/**
 * 将内置信息节点过滤词和自定义词合并为不区分大小写的字面匹配正则。
 * 仅显式值转为字符串并去空白后为空时禁用过滤；undefined、false 和 0 仍使用内置词表。
 *
 * @preserve
 * @param {*} [value] filter 原始值；真值先 URL 解码，再按竖线拆分自定义过滤词。
 * @returns {RegExp|null} 信息节点过滤正则；显式禁用时返回 null。
 * @throws {URIError} 自定义值包含无效的 URL 百分号编码时抛出。
 */
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

/**
 * 解析自定义保留关键词，独立识别 false/0 字符串并移除 true/1 开关词。
 * 不进行 URL 解码；空数组表示启用内置保留词且不追加自定义词。
 *
 * @preserve
 * @param {*} [value] retain 原始值；undefined 使用默认词表，字符串化后的 false 或 0 禁用保留。
 * @returns {string[]|null} 按竖线拆分并去空白的自定义关键词；禁用时返回 null。
 */
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
 * @preserve
 * @typedef {Object} RenameOptions
 * @property {boolean} removeOriginalName 是否移除原名，默认 true。
 * @property {boolean} removeUniqueSequence 是否移除唯一完整名称的 01 序号，默认 false。
 * @property {Set<string>|null} hotRegions 允许保留的地区集合；null 表示不按地区过滤。
 * @property {RegExp|null} filterPattern 信息节点过滤正则；null 表示不执行名称过滤。
 * @property {RegExp|null} blockPattern 识别地区前移除文本的正则；null 表示不屏蔽。
 * @property {string[]|null} retainKeywords 追加到内置词表的关键词；null 表示禁用保留词。
 * @property {string[]} outputFields 按输出顺序排列的 FG、ZH、EN、QC 字段，默认 FG、EN。
 */

/**
 * 将 Sub-Store 参数归一化为过滤、地区选择、关键词保留和命名选项。
 * remove/one 使用 JavaScript 真值语义，filter/block 解码 URL 文本，retain 单独识别 false/0。
 *
 * @preserve
 * @param {Object|null} [args={}] 原始脚本参数；null 同样使用默认值。
 * @param {*} [args.remove=true] 是否移除原名；只有 undefined 使用默认 true。
 * @param {*} [args.one=false] 是否移除唯一完整名称的 01 序号。
 * @param {*} [args.hot] 热门地区开关或竖线分隔代码；假值不筛选。
 * @param {*} [args.filter] 自定义信息节点过滤词；省略保留内置词表，空白字符串关闭过滤。
 * @param {*} [args.block] URL 编码的屏蔽正则；假值不屏蔽，启用时使用 gi 标记。
 * @param {*} [args.retain] 自定义保留词或开关；省略启用内置词，false/0 禁用。
 * @param {*} [args.out='FG|EN'] 竖线分隔输出字段；有效项为空时回退到 FG、EN。
 * @returns {RenameOptions} 已解析的重命名选项，不修改传入参数。
 * @throws {URIError} filter 或 block 包含无效 URL 编码时抛出。
 * @throws {SyntaxError} 解码后的 block 无法编译为正则时抛出。
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
