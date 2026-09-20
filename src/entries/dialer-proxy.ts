/**
 * @file Sub-Store 订阅中转设置入口，在来源订阅中处理节点，再供配置文件注入使用。
 */

import { assignDialerProxy } from '../dialer-proxy/index.ts';
import type { ProxyNode } from '../types.ts';

/**
 * 读取 Sub-Store 的 $arguments.mode，为来源订阅节点设置中转。
 * @preserve
 * @param {Array<Object>} proxies 来源订阅节点，命中的节点会就地更新 dialer-proxy。
 * @param {string} targetPlatform Sub-Store 传入的目标平台，本脚本不使用。
 * @param {Object} context Sub-Store 传入的处理上下文，本脚本不使用。
 * @returns {Array<Object>} 保持输入顺序的新数组，元素引用及节点名称保持不变。
 * @throws {Error} mode 缺失或不是 self-hosted、edge。
 */
export function operator(
  proxies: ProxyNode[],
  targetPlatform: string,
  context: unknown,
): ProxyNode[] {
  return assignDialerProxy(proxies, typeof $arguments === 'undefined' ? {} : $arguments);
}
