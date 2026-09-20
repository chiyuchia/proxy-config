/**
 * @file Sub-Store 订阅中转设置入口，在来源订阅中处理节点，再供配置文件注入使用。
 */

import { assignDialerProxy } from '../dialer-proxy/index.js';

export function operator(proxies, targetPlatform, context) {
  return assignDialerProxy(proxies, typeof $arguments === 'undefined' ? {} : $arguments);
}
