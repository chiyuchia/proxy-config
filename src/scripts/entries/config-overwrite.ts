/**
 * @file Sub-Store 配置覆写入口，提供 main(config)。
 * 在加载客户端模板与节点注入后更新成员，检查本地配置及声明的运行时 provider 引用。
 */

import { overwriteConfig } from '../config-overwrite/index.ts';
import type { OverwrittenConfig, ProxyConfig } from '../shared/types.ts';

/**
 * 执行成员生成和最终配置校验；本入口不需要脚本参数。
 * @preserve
 * @param {Object} config 已加载模板并注入节点的配置，校验通过后就地更新，失败时保持不变。
 * @returns {Object} 同一个配置对象，顶层与组内的内部声明均已移除。
 * @throws {Error} 任一成员声明或最终配置无效；异常向 Sub-Store 传播，阻止本次输出。
 */
export function main(config: ProxyConfig): OverwrittenConfig {
  return overwriteConfig(config);
}
