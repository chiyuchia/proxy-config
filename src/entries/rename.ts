/**
 * @file Sub-Store 订阅重命名入口，提供 async operator(proxies, targetPlatform, context)。
 * 适配脚本参数与日志对象，在来源订阅中处理节点，再供配置文件注入使用。
 */

import { renameProxies } from '../rename/index.ts';
import type { ProxyNode } from '../types.ts';

/**
 * 使用 Sub-Store 的 $arguments 和控制台日志，按节点名称识别地区并整理名称。
 * @preserve
 * @param {Array<Object>} proxies 待重命名的订阅节点；已识别节点浅拷贝，未知节点保留引用。
 * @param {string} targetPlatform Sub-Store 传入的目标平台，本脚本不使用。
 * @param {Object} context Sub-Store 传入的处理上下文，本脚本不使用。
 * @returns {Promise<Array<Object>>} 按地区排序、完成命名的节点数组；hot 可过滤地区，one 可能改写未知节点的原对象名称。
 * @throws {Error} 参数解码、正则构造或重命名处理失败时，返回的 Promise 拒绝。
 */
export async function operator(
  proxies: ProxyNode[],
  targetPlatform: string,
  context: unknown,
): Promise<ProxyNode[]> {
  return renameProxies(proxies, $arguments, console);
}
