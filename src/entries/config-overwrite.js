/**
 * @file Sub-Store 配置覆写入口，提供 main(config)。
 * 读取脚本参数，在配置合并与节点注入后更新代理组成员和可选 provider URL。
 */

import { overwriteConfig } from '../config-overwrite/index.js';

export function main(config) {
  return overwriteConfig(config, typeof $arguments === 'undefined' ? {} : $arguments);
}
