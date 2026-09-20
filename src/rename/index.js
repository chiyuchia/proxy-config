/**
 * @file 节点重命名主流程：过滤、地区识别、分组编号、命名与排序。
 * 参数和日志对象由调用者提供，未识别节点默认保留原名。
 */

import { parseRenameOptions } from './options.js';
import { identifyCountry } from './identify.js';
import { formatProxyName, removeUniqueSequence } from './format.js';
import { HOT_REGIONS } from './regions.js';

/**
 * 按热门地区、其他已识别地区、未知地区排序，已识别节点再按地区代码和最终名称排序。
 * 两个未知节点视为相等，以便稳定排序保留它们的输入顺序。
 *
 * @preserve
 * @param {{name: string}} a 待比较的前一个节点。
 * @param {{name: string}} b 待比较的后一个节点。
 * @param {Map<Object, string>} countries 按节点对象引用保存的已识别地区代码。
 * @returns {number} 负数表示 a 在前，正数表示 b 在前，0 表示排序等价。
 */
function compareProxiesByRegion(a, b, countries) {
  const countryA = countries.get(a);
  const countryB = countries.get(b);
  if (!countryA && !countryB) return 0;
  if (!countryA) return 1;
  if (!countryB) return -1;
  const hotA = HOT_REGIONS.has(countryA);
  const hotB = HOT_REGIONS.has(countryB);
  if (hotA && !hotB) return -1;
  if (!hotA && hotB) return 1;
  return countryA.localeCompare(countryB) || a.name.localeCompare(b.name);
}

/**
 * 过滤信息节点、识别地区，按订阅和地区编号命名，再进行 hot 筛选、排序和可选去序号。
 * 仅使用传入数据并通过 logger.log 输出处理日志，不读取 Sub-Store 全局变量或访问网络。
 * 已识别节点浅拷贝后改名，未知节点保留对象引用；启用 one 时可能修改未知节点的原对象名称。
 *
 * @preserve
 * @param {Object[]} proxies 输入节点数组，节点应包含 name，并可包含 server、_subName 及其他协议字段。
 * @param {Object|null} [args={}] 原始脚本参数，字段和默认值由 parseRenameOptions 定义。
 * @param {{log: function(...*): void}} [logger=console] 接收处理进度和重命名信息的日志对象。
 * @returns {Object[]} 筛选和排序后的新数组，保留节点的非名称字段。
 * @throws {URIError} filter 或 block 参数包含无效 URL 编码时抛出。
 * @throws {SyntaxError} block 或保留关键词无法编译为正则时抛出。
 */
export function renameProxies(proxies, args = {}, logger = console) {
  const options = parseRenameOptions(args);
  const hotOnly = options.hotRegions !== null;
  logger.log(
    `[geo-tag] 开始处理，共 ${proxies.length} 个节点，removeOriginalName=${options.removeOriginalName}，hotOnly=${hotOnly}`,
  );

  if (options.filterPattern) {
    const before = proxies.length;
    proxies = proxies.filter((proxy) => !options.filterPattern.test(proxy.name));
    logger.log(
      `[geo-tag] filter 过滤: ${before - proxies.length} 个节点被丢弃，剩余 ${proxies.length} 个`,
    );
  }

  // 逐节点识别；即便 server 相同也不共享识别结果。
  const countries = new Map();
  let nameHitCount = 0;
  for (const proxy of proxies) {
    const countryCode = identifyCountry(proxy, options.blockPattern);
    if (countryCode) {
      countries.set(proxy, countryCode);
      nameHitCount++;
      logger.log(`[geo-tag] 名称命中: ${proxy.name} → ${countryCode}`);
    }
  }
  logger.log(`[geo-tag] 名称命中 ${nameHitCount}/${proxies.length} 个节点`);

  // 序号按订阅和地区分别累计，先命名再过滤 hot，保留源节点的计数顺序。
  const sequenceByGroup = new Map();
  const renamedProxies = proxies.map((proxy) => {
    const countryCode = countries.get(proxy);
    if (!countryCode) return proxy;
    const key = `${proxy._subName || ''}|${countryCode}`;
    const sequence = (sequenceByGroup.get(key) || 0) + 1;
    sequenceByGroup.set(key, sequence);
    const name = formatProxyName(proxy, countryCode, sequence, options);
    logger.log(`[geo-tag] 重命名: ${proxy.name} → ${name}`);
    const renamed = { ...proxy, name };
    countries.set(renamed, countryCode);
    return renamed;
  });
  logger.log(`[geo-tag] 完成。名称命中: ${nameHitCount}，未识别: ${proxies.length - nameHitCount}`);

  const result = hotOnly
    ? renamedProxies.filter((proxy) => {
        const code = countries.get(proxy);
        return code && options.hotRegions.has(code);
      })
    : renamedProxies;
  if (hotOnly) logger.log(`[geo-tag] hot 过滤后剩余: ${result.length} 个节点`);

  result.sort((a, b) => compareProxiesByRegion(a, b, countries));
  if (options.removeUniqueSequence) removeUniqueSequence(result);
  return result;
}
