/**
 * @file Sub-Store 订阅中转设置入口，在来源订阅中处理节点，再供配置文件注入使用。
 */

import { assignDialerProxy } from '../dialer-proxy/index.ts';
import type { ProxyNode } from '../types.ts';

/**
 * 按节点名称识别地区，为自建 SS 节点和其他来源节点设置中转，无需脚本参数。
 * @preserve
 * @param {Array<Object>} proxies 来源订阅节点，自建非 SS 节点保持原样，其余就地更新 dialer-proxy。
 * @param {string} targetPlatform Sub-Store 传入的目标平台，本脚本不使用。
 * @param {Object} context Sub-Store 传入的处理上下文，本脚本不使用。
 * @returns {Array<Object>} 保持输入顺序的新数组，元素引用及节点名称保持不变。
 */
export function operator(
  proxies: ProxyNode[],
  targetPlatform: string,
  context: unknown,
): ProxyNode[] {
  return assignDialerProxy(proxies);
}
