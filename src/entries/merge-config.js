/**
 * @file Sub-Store 配置合并入口，提供 async main(config)。
 * 适配脚本参数、HTTP 和 YAML 全局对象；作为独立操作在 config-overwrite 前执行。
 */

import { loadMergedConfig } from '../merge-config/source.js';

export async function main(config) {
  const args = typeof $arguments === 'object' && $arguments ? $arguments : {};
  return loadMergedConfig(config, args, {
    get: (request) => $substore.http.get(request),
    parseYaml: (source) => ProxyUtils.yaml.safeLoad(source),
  });
}
