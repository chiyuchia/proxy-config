/**
 * @file Sub-Store 配置覆写入口，提供 main(config)。
 * 读取脚本参数，在配置合并与节点注入后更新代理组成员和可选 provider URL。
 */

import { overwriteConfig } from '../config-overwrite/index.ts';
import type { OverwrittenConfig, ProxyConfig } from '../types.ts';

/**
 * 读取 Sub-Store 的 $arguments，执行成员生成和可选的 provider URL 注入。
 * @preserve
 * @param {Object} config 已完成合并和节点注入的配置，会就地更新代理组及 provider。
 * @returns {Object} 同一个配置对象，最终代理组已移除内部生成声明。
 * @throws {Error} 任一成员声明缺失或不符合要求。
 */
export function main(config: ProxyConfig): OverwrittenConfig {
  return overwriteConfig(config, typeof $arguments === 'undefined' ? {} : $arguments);
}
