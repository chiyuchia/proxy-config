/**
 * @file 解析配置来源参数，并行读取公共配置与指定客户端差异。
 * 通过调用者提供的 HTTP 和 YAML 能力读取来源，校验响应及客户端后执行合并。
 */

import { mergeConfigDocuments } from './index.js';
import { configError } from './value.js';

const DEFAULT_CONFIG_URL =
  'https://raw.githubusercontent.com/chiyuchia/proxy-config/master/configs';

/**
 * 规范化客户端名称和超时值，并按单独地址优先于公共目录的规则解析配置来源。
 * 此处不验证最终地址的协议，HTTP(S) 检查在读取来源时执行。
 *
 * @preserve
 * @param {Object<string, *>} args 脚本参数对象，不修改原对象。
 * @param {string} args.client 必填客户端名称，去除首尾空白并转小写后须为 mihomo 或 stash。
 * @param {*} [args.timeout=10000] 请求超时毫秒数，经 Number 转换后须为有限正数。
 * @param {string|null} [args.configBaseUrl] 配置目录；省略或为 null 时使用仓库 master/configs 地址。
 * @param {*} [args.baseUrl] 公共配置独立地址；非 null/undefined 时优先使用，格式稍后检查。
 * @param {*} [args.profileUrl] 客户端差异独立地址；非 null/undefined 时优先使用，格式稍后检查。
 * @returns {{client: string, timeout: number, baseUrl: *, profileUrl: *}} 客户端、超时和两个来源地址。
 * @throws {Error} 客户端不支持、超时无法转为有限正数或公共目录不是字符串时抛出配置错误。
 */
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

/**
 * 发起一次 HTTP GET，检查成功状态及非空响应体后解析独立 YAML 来源。
 * 下载异常原样传播，同步 YAML 解析异常添加来源说明后抛出。
 *
 * @preserve
 * @param {string} url 来源地址，须以 HTTP(S) 协议开头。
 * @param {string} label 用于错误信息的来源标签，例如 base.yaml。
 * @param {number} timeout 传给 HTTP 运行时的请求超时毫秒数，本函数不再次验证其范围。
 * @param {Object} runtime 由调用方提供的 HTTP 和 YAML 能力。
 * @param {function(Object): Promise<Object>} runtime.get 接收 url、timeout 并返回 HTTP 响应的函数。
 * @param {function(string): *} runtime.parseYaml 同步解析响应文本并返回配置值的函数。
 * @returns {Promise<*>} YAML 解析得到的值；来源标记及配置结构由后续步骤检查。
 * @throws {Error} 地址协议无效、下载失败、响应为空或 YAML 解析失败时拒绝返回的 Promise。
 */
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

/**
 * 并行下载公共配置与客户端差异，核对客户端标记后合并，并仅保留输入中的注入节点。
 * 会通过运行时发出两个读取请求，不修改输入配置或参数对象。
 *
 * @preserve
 * @param {Object<string, *>|null|undefined} config 输入配置，可为空；仅读取其 proxies 字段。
 * @param {Object<string, *>} args 来源参数，包含必填 client 及 resolveConfigOptions 支持的可选项。
 * @param {Object} runtime 由调用方提供的来源读取能力。
 * @param {function(Object): Promise<Object>} runtime.get 接收 url、timeout 并返回 HTTP 响应的函数。
 * @param {function(string): *} runtime.parseYaml 同步解析各份 YAML 文本的函数。
 * @returns {Promise<Object<string, *>>} 校验并合并后的新配置，其容器与输入配置独立。
 * @throws {Error} 参数、下载、解析、客户端标记、补丁或配置校验失败时拒绝返回的 Promise。
 */
export async function loadMergedConfig(config, args, runtime) {
  const { client, timeout, baseUrl, profileUrl } = resolveConfigOptions(args);
  const [base, profile] = await Promise.all([
    readConfigSource(baseUrl, 'base.yaml', timeout, runtime),
    readConfigSource(profileUrl, `${client}.yaml`, timeout, runtime),
  ]);
  if (profile?.$profile !== client) configError(`客户端差异与 client=${client} 不一致`);
  return mergeConfigDocuments(base, profile, config?.proxies);
}
