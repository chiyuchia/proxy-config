/**
 * @file 为来源订阅中的节点设置 dialer-proxy，保留节点顺序与其他字段。
 * 自建模式按原始名称分配中转；Edge 模式供 oixCloud Edge 和一元机场共用。
 */

import type { ProxyNode, ScriptArguments } from '../types.ts';

/**
 * 按来源模式就地设置节点的 dialer-proxy，保留原节点名称和输入顺序。
 * edge 为全部节点设置 Edge 中转；self-hosted 仅处理名称含“落地”的节点，
 * 其中含大写 SG 的使用亚太中转，其余使用美西中转，未命中的节点保留原字段。
 * @preserve
 * @param {Array<Object>} proxies 来源订阅节点；self-hosted 模式要求 name 为字符串。
 * @param {Object} [args={}] 中转脚本参数。
 * @param {'self-hosted'|'edge'} args.mode 必填的中转模式，无默认模式。
 * @returns {Array<Object>} 新数组，元素仍为原节点对象；命中节点的中转字段已被覆盖。
 * @throws {Error} mode 缺失或不受支持；模式校验失败时不会修改任何节点。
 */
export function assignDialerProxy<T extends ProxyNode>(
  proxies: T[],
  args: ScriptArguments | null = {},
): T[] {
  const mode = args?.mode;
  if (mode !== 'self-hosted' && mode !== 'edge') {
    throw new Error('[dialer-proxy] mode 必须为 self-hosted 或 edge');
  }

  return proxies.map((proxy) => {
    if (mode === 'edge') {
      proxy['dialer-proxy'] = '🛡️ Edge 中转';
    } else if (proxy.name.includes('落地')) {
      // 保留原脚本的大小写敏感子串判断，不额外推断地区或订阅来源。
      proxy['dialer-proxy'] = proxy.name.includes('SG') ? '🛡️ 亚太中转' : '🛡️ 美西中转';
    }
    return proxy;
  });
}
