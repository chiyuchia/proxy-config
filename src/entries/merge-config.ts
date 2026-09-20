/**
 * @file Sub-Store 配置合并入口，提供 async main(config)。
 * 适配脚本参数、HTTP 和 YAML 全局对象；作为独立操作在 config-overwrite 前执行。
 */

import { loadMergedConfig } from '../merge-config/source.ts';
import type { MergedConfig, ProxyConfig } from '../types.ts';

/**
 * 适配 Sub-Store 的脚本参数、HTTP 和 YAML 接口，下载并合并公共配置与客户端差异。
 * @preserve
 * @param {Object|null|undefined} config 输入配置，仅保留其中注入的 proxies；不修改原对象。
 * @returns {Promise<Object>} 完成来源、补丁和引用校验的新配置，仍保留成员生成声明供后续覆写。
 * @throws {Error} 参数、远程请求、YAML 来源、补丁或引用无效时，返回的 Promise 拒绝。
 */
export async function main(config: ProxyConfig | null | undefined): Promise<MergedConfig> {
  const args = typeof $arguments === 'object' && $arguments ? $arguments : {};
  return loadMergedConfig(config, args, {
    /**
     * 转发配置文件的 HTTP GET 请求到 Sub-Store。
     * @preserve
     * @param {{url: string, timeout: number}} request 请求地址与超时毫秒数。
     * @returns {Promise<Object>} 包含响应体和状态信息的 HTTP 响应；请求错误向上传播。
     */
    get: (request) => $substore.http.get(request),
    /**
     * 使用 Sub-Store 提供的 YAML 解析器读取配置文本。
     * @preserve
     * @param {string} source 下载到的 YAML 文本。
     * @returns {*} 解析后的 YAML 值，结构由后续合并流程校验。
     * @throws {Error} YAML 文本无法解析。
     */
    parseYaml: (source) => ProxyUtils.yaml.safeLoad(source),
  });
}
