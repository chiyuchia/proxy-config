/**
 * @file 根据显式订阅 URL 创建或更新 oixCloud provider。
 * 已有 provider 仅补入 URL；没有定义时使用独立订阅的默认设置。
 */

export function buildOixCloudProvider(url, existingProvider) {
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
