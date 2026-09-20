/**
 * @file 根据显式订阅 URL 创建或更新 oixCloud provider。
 * 已有 provider 仅补入 URL；没有定义时使用独立订阅的默认设置。
 */

import type { ProxyProvider } from '../types.ts';

/**
 * 创建 oixCloud provider，或复制已有配置并仅替换 URL，不修改输入对象。
 * @preserve
 * @param {*} url 订阅地址；非字符串或空白字符串表示不创建、不更新。
 * @param {Object|null|undefined} existingProvider 已有 provider，省略时使用默认 HTTP 和健康检查设置。
 * @returns {Object|null} 新 provider 对象；未提供有效地址时为 null。地址保持原值，不移除首尾空白。
 */
export function buildOixCloudProvider(
  url: unknown,
  existingProvider?: ProxyProvider | null,
): ProxyProvider | null {
  if (typeof url !== 'string' || url.trim() === '') return null;

  if (existingProvider) {
    return { ...existingProvider, url };
  }

  return {
    type: 'http',
    url,
    path: './proxy_provider/oixCloud.yaml',
    interval: 86400,
    proxy: 'DIRECT',
    'health-check': {
      enable: true,
      interval: 600,
      url: 'http://www.gstatic.com/generate_204',
    },
  };
}
