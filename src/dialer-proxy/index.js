/**
 * @file 为来源订阅中的节点设置 dialer-proxy，保留节点顺序与其他字段。
 * 自建模式按原始名称分配中转；Edge 模式供 oixCloud Edge 和一元机场共用。
 */

export function assignDialerProxy(proxies, args = {}) {
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
