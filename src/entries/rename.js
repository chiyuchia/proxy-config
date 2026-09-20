/**
 * @file Sub-Store 订阅重命名入口，提供 async operator(proxies, targetPlatform, context)。
 * 适配脚本参数与日志对象，在来源订阅中处理节点，再供配置文件注入使用。
 */

import { renameProxies } from '../rename/index.js';

export async function operator(proxies, targetPlatform, context) {
  return renameProxies(proxies, $arguments, console);
}
