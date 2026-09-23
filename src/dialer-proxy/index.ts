/**
 * @file 为来源订阅中的节点设置 dialer-proxy，保留节点顺序与其他字段。
 * 所有输入节点统一按名称识别地区，美国使用美西中转，其他地区使用亚太中转。
 */

import { identifyCountryFromName } from '../rename/identify.ts';
import type { ProxyNode } from '../types.ts';

/**
 * 按节点名称识别地区，就地设置全部节点的 dialer-proxy，保留原名称和输入顺序。
 * 美国节点使用美西中转，其他地区及无法识别地区的节点使用亚太中转。
 * @preserve
 * @param {Array<Object>} proxies 来源订阅节点，name 为字符串。
 * @returns {Array<Object>} 新数组，元素仍为原节点对象；全部节点的中转字段已被覆盖。
 */
export function assignDialerProxy<T extends ProxyNode>(proxies: T[]): T[] {
  return proxies.map((proxy) => {
    proxy['dialer-proxy'] =
      identifyCountryFromName(proxy.name) === 'US' ? '🛡️ 美西中转' : '🛡️ 亚太中转';
    return proxy;
  });
}
