/**
 * @file 解析配置来源参数，并行读取公共配置与指定客户端差异。
 * 通过调用者提供的 HTTP 和 YAML 能力读取来源，校验响应及客户端后执行合并。
 */

import { mergeConfigDocuments } from './index.js';
import { configError } from './value.js';

const DEFAULT_CONFIG_URL =
  'https://raw.githubusercontent.com/chiyuchia/proxy-config/master/configs';

/** 解析客户端、配置来源 URL 与请求超时参数。 */
export function resolveConfigOptions(args) {
  const client = typeof args.client === 'string' ? args.client.trim().toLowerCase() : '';
  if (!['mihomo', 'stash'].includes(client)) configError('请设置 client=mihomo 或 client=stash');
  const timeout = args.timeout === undefined ? 10000 : Number(args.timeout);
  if (!Number.isFinite(timeout) || timeout <= 0) configError('timeout 必须是正数（毫秒）');
  const root = args.configBaseUrl ?? DEFAULT_CONFIG_URL;
  if (typeof root !== 'string') configError('configBaseUrl 必须是 URL 字符串');
  const directory = root.replace(/\/+$/, '');
  return {
    client,
    timeout,
    baseUrl: args.baseUrl ?? `${directory}/base.yaml`,
    profileUrl: args.profileUrl ?? `${directory}/${client}.yaml`,
  };
}

export async function readConfigSource(url, label, timeout, { get, parseYaml }) {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
    configError(`${label} 必须使用 HTTP(S) URL`);
  }
  const response = await get({ url, timeout });
  const status = Number(response?.statusCode ?? response?.status);
  if (!(status >= 200 && status < 300)) configError(`${label} 下载失败：HTTP ${status}`);
  if (typeof response.body !== 'string' || !response.body.trim()) configError(`${label} 内容为空`);
  try {
    return parseYaml(response.body);
  } catch (error) {
    configError(`${label} YAML 解析失败：${error.message}`);
  }
}

/** 并行读取两个独立 YAML，验证客户端后交给纯合并逻辑。 */
export async function loadMergedConfig(config, args, runtime) {
  const { client, timeout, baseUrl, profileUrl } = resolveConfigOptions(args);
  const [base, profile] = await Promise.all([
    readConfigSource(baseUrl, 'base.yaml', timeout, runtime),
    readConfigSource(profileUrl, `${client}.yaml`, timeout, runtime),
  ]);
  if (profile?.$profile !== client) configError(`客户端差异与 client=${client} 不一致`);
  return mergeConfigDocuments(base, profile, config?.proxies);
}
