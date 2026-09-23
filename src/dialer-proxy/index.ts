/**
 * @file 为来源订阅中的节点设置 dialer-proxy，保留节点顺序与其他字段。
 * 自建仅处理 SS 节点，其余来源处理全部节点；美国使用美西中转，其他地区使用亚太中转。
 */

import { identifyCountryFromName } from '../rename/identify.ts';
import type { ProxyNode } from '../types.ts';

/**
 * 按节点名称识别地区，就地设置符合条件节点的 dialer-proxy，保留原名称和输入顺序。
 * 订阅名 _subName 为“精品节点”时视为自建，仅处理实际 type 为 ss 的节点（不区分大小写）。
 * 其他协议的自建节点保持原样，包括已有中转字段；其他来源节点不限协议。
 * 美国节点使用美西中转，其他地区及无法识别地区的节点使用亚太中转。
 * @preserve
 * @param {Array<Object>} proxies 来源订阅节点，name 为字符串。
 * @returns {Array<Object>} 新数组，元素仍为原节点对象；符合条件节点的中转字段已被覆盖。
 */
export function assignDialerProxy<T extends ProxyNode>(proxies: T[]): T[] {
  return proxies.map((proxy) => {
    const isSelfHosted = proxy._subName === '精品节点';
    if (isSelfHosted && proxy.type?.toLowerCase() !== 'ss') return proxy;

    proxy['dialer-proxy'] =
      identifyCountryFromName(proxy.name) === 'US' ? '🛡️ 美西中转' : '🛡️ 亚太中转';
    return proxy;
  });
}
