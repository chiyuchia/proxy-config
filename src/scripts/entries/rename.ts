/**
 * @file Sub-Store 订阅重命名入口，提供 async operator(proxies, targetPlatform, context)。
 * 适配日志对象，在来源订阅中按固定规则处理节点，再供配置文件注入使用。
 */

import { renameProxies } from '../rename/index.ts';
import type { ProxyNode } from '../shared/types.ts';

/**
 * 使用控制台日志，按节点名称识别地区并按固定规则整理名称，无需脚本参数。
 * @preserve
 * @param {Array<Object>} proxies 待重命名的订阅节点；已识别节点浅拷贝，未知节点保留引用。
 * @param {string} targetPlatform Sub-Store 传入的目标平台，本脚本不使用。
 * @param {Object} context Sub-Store 传入的处理上下文，本脚本不使用。
 * @returns {Promise<Array<Object>>} 过滤信息节点、按地区排序并完成命名的节点数组，未知地区节点保留原名。
 * @throws {Error} 重命名处理失败时，返回的 Promise 拒绝。
 */
export async function operator(
  proxies: ProxyNode[],
  targetPlatform: string,
  context: unknown,
): Promise<ProxyNode[]> {
  return renameProxies(proxies, console);
}
