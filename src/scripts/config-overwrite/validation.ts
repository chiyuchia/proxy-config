/**
 * @file 校验节点注入和覆写完成后的配置，阻止无效名称、引用、中转环路及 HTTP 地址输出。
 * 仅检查本地配置和显式依赖，不请求远程 provider 或展开客户端动态成员。
 */

import { BUILTIN_TARGETS, validateRuleReferences } from '../shared/rules.ts';
import { isConfigMap } from '../shared/value.ts';
import { readRuntimeProxyProviders } from '../shared/runtime-providers.ts';
import type { ConfigMap, ProxyConfig } from '../shared/types.ts';

/**
 * 抛出可在 Sub-Store 定位的最终配置错误，不输出节点凭据或 provider 地址。
 * @preserve
 * @param {string} message 字段路径、名称及错误原因，不应包含配置全文或订阅 URL。
 * @returns {never} 始终抛出异常。
 * @throws {Error} 带 config-overwrite 前缀的最终配置校验错误。
 */
function validationError(message: string): never {
  throw new Error(`[config-overwrite] 最终配置校验失败：${message}`);
}

/**
 * 校验可选列表的容器类型；仅缺省值按空数组处理。
 * @preserve
 * @param {*} value 原始字段值。
 * @param {string} path 错误定位使用的字段路径。
 * @returns {Array<*>} 原数组；省略字段时返回空数组，不修改输入。
 * @throws {Error} 字段已提供但不是数组。
 */
function readList(value: unknown, path: string): unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) validationError(`${path} 必须是数组`);
  return value;
}

/**
 * 校验非空名称或字段字符串，保留原始字符串以确保精确引用匹配。
 * @preserve
 * @param {*} value 待校验的字段值。
 * @param {string} path 错误定位使用的字段路径。
 * @returns {string} 未修剪、未改名的原始字符串。
 * @throws {Error} 字段不是字符串或只有空白。
 */
function readText(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    validationError(`${path} 必须是非空字符串`);
  }
  return value;
}

/**
 * 读取 provider 定义，确认顶层及每个 provider 均为映射。
 * @preserve
 * @param {*} value 原始 provider 字段；省略时视为空映射。
 * @param {string} path proxy-providers 或 rule-providers。
 * @returns {Object<string, Object>} 原映射或空映射，不复制或修改 provider。
 * @throws {Error} 容器、名称或 provider 定义类型无效。
 */
function readProviders(value: unknown, path: string): Record<string, ConfigMap> {
  if (value === undefined) return {};
  if (!isConfigMap(value)) validationError(`${path} 必须是映射`);
  for (const [name, provider] of Object.entries(value)) {
    readText(name, `${path} 的名称`);
    if (!isConfigMap(provider)) validationError(`${path}[${name}] 必须是映射`);
  }
  return value as Record<string, ConfigMap>;
}

/**
 * 在分组计算前检查其依赖的输入形状，避免无效字段触发原生数组或字符串异常。
 * 不检查引用、重名、环路及 provider 地址，允许覆写移除旧成员或补入缺失地址。
 * @preserve
 * @param {*} config 待覆写或待最终校验的配置，不修改输入。
 * @returns {void} 结构有效时正常返回，并收窄配置类型。
 * @throws {Error} 配置、节点、组、成员列表或 provider 容器类型无效。
 */
export function validateOverwriteStructure(config: unknown): asserts config is ProxyConfig {
  if (!isConfigMap(config)) validationError('配置必须是映射');
  for (const field of ['proxies', 'proxy-groups']) {
    for (const [index, item] of readList(config[field], field).entries()) {
      const path = `${field}[${index}]`;
      if (!isConfigMap(item)) validationError(`${path} 必须是映射`);
      const name = readText(item.name, `${path}.name`);
      if (field === 'proxy-groups') {
        readText(item.type, `${path}[${name}].type`);
        for (const memberField of ['proxies', 'use']) {
          readList(item[memberField], `${path}[${name}].${memberField}`).forEach((ref, i) => {
            readText(ref, `${path}[${name}].${memberField}[${i}]`);
          });
        }
      }
    }
  }
  readProviders(config['proxy-providers'], 'proxy-providers');
  readProviders(config['rule-providers'], 'rule-providers');
}

/**
 * 校验方括号主机中的 IPv6 地址，支持一次零压缩和末尾嵌入的 IPv4。
 * @preserve
 * @param {string} address 已移除方括号和可选 zone 的地址。
 * @returns {boolean} 分段格式、数量和 IPv4 数值有效时为 true，不修改输入。
 */
function isIpv6(address: string): boolean {
  const halves = address.split('::');
  if (halves.length > 2) return false;
  const words = halves.flatMap((half) => (half ? half.split(':') : []));
  let units = words.length;
  const last = words.at(-1) ?? '';
  if (last.includes('.')) {
    if (!address.endsWith(last)) return false;
    const octets = last.split('.');
    if (
      octets.length !== 4 ||
      octets.some((part) => !/^(?:0|[1-9]\d{0,2})$/.test(part) || Number(part) > 255)
    )
      return false;
    words.pop();
    units += 1;
  }
  if (words.some((word) => !/^[\da-f]{1,4}$/i.test(word))) return false;
  return halves.length === 2 ? units < 8 : units === 8;
}

/**
 * 检查 HTTP(S) 绝对地址的基本格式，不依赖 URL 全局对象，也不进行网络访问。
 * 允许认证信息、内网主机、方括号 IPv6、端口和查询参数；不检查 DNS 或资源可达性。
 * @preserve
 * @param {*} value provider 的 url 字段。
 * @returns {boolean} 协议、主机和端口格式有效时为 true。
 */
function isHttpUrl(value: unknown): boolean {
  if (typeof value !== 'string' || /[\s\u0000-\u001f\u007f\\]/u.test(value)) return false;
  if (/%(?![\da-f]{2})/i.test(value)) return false;
  const match = /^https?:\/\/([^/?#]+)(?:[/?#].*)?$/i.exec(value);
  if (!match) return false;
  const authority = match[1];
  const at = authority.lastIndexOf('@');
  if (at !== authority.indexOf('@')) return false;
  if (at >= 0 && /[[\]<>"`{}|^]/.test(authority.slice(0, at))) return false;
  const hostPort = authority.slice(at + 1);
  const hostMatch = hostPort.startsWith('[')
    ? /^\[([\da-f:.]+)(?:%25[\w.-]+)?\](?::(\d+))?$/i.exec(hostPort)
    : /^([^:[\]<>"`{}|^%]+)(?::(\d+))?$/.exec(hostPort);
  if (!hostMatch) return false;
  if (hostPort.startsWith('[') && !isIpv6(hostMatch[1])) return false;
  const port = hostMatch[2];
  return port === undefined || Number(port) <= 65535;
}

/**
 * 对本地依赖图执行迭代深度优先遍历，报告完整循环路径。
 * 使用显式栈避免较长中转链耗尽 JavaScript 调用栈；不修改图。
 * @preserve
 * @param {Map<string, string[]>} graph 节点和策略组名称到其本地依赖的邻接表。
 * @returns {void} 图无环时正常返回。
 * @throws {Error} 遇到回到当前路径的依赖时抛出包含环路名称的错误。
 */
function validateAcyclic(graph: Map<string, string[]>): void {
  const completed = new Set<string>();
  const active = new Map<string, number>();
  for (const root of graph.keys()) {
    if (completed.has(root)) continue;
    const stack = [{ name: root, next: 0 }];
    active.set(root, 0);
    while (stack.length) {
      const frame = stack[stack.length - 1];
      const edges = graph.get(frame.name)!;
      if (frame.next === edges.length) {
        completed.add(frame.name);
        active.delete(frame.name);
        stack.pop();
        continue;
      }
      const target = edges[frame.next++];
      const start = active.get(target);
      if (start !== undefined) {
        const cycle = [...stack.slice(start).map(({ name }) => name), target];
        validationError(`代理依赖存在环路：${cycle.join(' → ')}`);
      }
      if (completed.has(target)) continue;
      active.set(target, stack.length);
      stack.push({ name: target, next: 0 });
    }
  }
}

/**
 * 检查覆写后的名称、组/规则/provider 引用、中转关系、依赖环路和 HTTP provider 地址。
 * GLOBAL 可显式定义为组；缺省 GLOBAL 按包含所有本地节点及组处理，防止中转回到自身。
 * 组的 use 可引用本地 provider 或顶层 x-substore 中明确声明的运行时 provider。
 * 不修改配置，不展开远程 provider 或 include-all 等客户端动态成员，也不验证协议完整语法。
 * @preserve
 * @param {*} config 已完成节点注入和分组计算、仍保留顶层运行时声明的候选配置。
 * @returns {void} 所有检查通过时正常返回。
 * @throws {Error} 名称、字段、引用、依赖或 HTTP 地址无效时抛出含定位信息的错误。
 */
export function validateFinalConfig(config: unknown): void {
  validateOverwriteStructure(config);
  const runtimeProviders = readRuntimeProxyProviders(config, validationError);
  const proxies = config.proxies ?? [];
  const groups = config['proxy-groups'] ?? [];
  const definitions = new Map<string, string>();
  for (const [field, entries] of [
    ['proxies', proxies],
    ['proxy-groups', groups],
  ] as const) {
    for (const [index, entry] of entries.entries()) {
      const path = `${field}[${index}].name`;
      if (
        BUILTIN_TARGETS.has(entry.name) &&
        !(field === 'proxy-groups' && entry.name === 'GLOBAL')
      ) {
        validationError(`${path} 与内置策略重名：${entry.name}`);
      }
      const previous = definitions.get(entry.name);
      if (previous) validationError(`${path} 与 ${previous} 重名：${entry.name}`);
      definitions.set(entry.name, path);
    }
  }

  const targets = new Set([...BUILTIN_TARGETS, ...definitions.keys()]);
  const graph = new Map([...definitions.keys()].map((name) => [name, [] as string[]]));
  if (!graph.has('GLOBAL')) graph.set('GLOBAL', [...definitions.keys()]);
  const proxyProviders = readProviders(config['proxy-providers'], 'proxy-providers');
  const ruleProviders = readProviders(config['rule-providers'], 'rule-providers');

  /**
   * 校验目标名称，并将本地节点或组引用记录为依赖边。
   * @preserve
   * @param {string} owner 发起引用的本地节点或组名。
   * @param {*} value 被引用的目标名称。
   * @param {string} path 错误定位使用的字段路径。
   * @returns {void} 引用有效时正常返回，并更新本次校验的内部依赖图。
   * @throws {Error} 引用不是非空字符串或找不到目标。
   */
  function addReference(owner: string, value: unknown, path: string): void {
    const target = readText(value, path);
    if (!targets.has(target)) validationError(`${path} 引用了不存在的代理或组：${target}`);
    if (graph.has(target)) graph.get(owner)!.push(target);
  }

  for (const proxy of proxies) {
    const dialer = proxy['dialer-proxy'];
    if (dialer !== undefined && dialer !== null && dialer !== '') {
      addReference(proxy.name, dialer, `proxies[${proxy.name}].dialer-proxy`);
    }
  }
  for (const group of groups) {
    for (const [index, name] of (group.proxies ?? []).entries()) {
      addReference(group.name, name, `proxy-groups[${group.name}].proxies[${index}]`);
    }
    for (const name of group.use ?? []) {
      if (!Object.hasOwn(proxyProviders, name) && !runtimeProviders.has(name)) {
        validationError(`proxy-groups[${group.name}].use 引用了不存在的 proxy-provider：${name}`);
      }
    }
  }
  validateRuleReferences(
    config.rules === undefined ? [] : config.rules,
    targets,
    ruleProviders,
    validationError,
  );
  validateAcyclic(graph);
  for (const [field, providers] of [
    ['proxy-providers', proxyProviders],
    ['rule-providers', ruleProviders],
  ] as const) {
    for (const [name, provider] of Object.entries(providers)) {
      if (provider.type === 'http' && !isHttpUrl(provider.url)) {
        validationError(`${field}[${name}].url 必须是包含有效主机的 HTTP(S) URL`);
      }
    }
  }
}
