/**
 * @file 共享的配置与 Sub-Store 运行时类型。
 * 未由本项目处理的协议和客户端字段以 unknown 保留，外部 YAML 仍需运行时校验。
 */

/** 尚未经过具体字段校验的配置映射。 */
export type ConfigMap = Record<string, unknown>;

/** Sub-Store 传入的原始脚本参数，保留字符串及 JSON 值的原有语义。 */
export type ScriptArguments = Record<string, unknown>;

/** 订阅节点：仅约束本项目使用的字段，其他协议选项原样透传。 */
export interface ProxyNode {
  name: string;
  type?: string;
  server?: string;
  _subName?: string;
  'dialer-proxy'?: string;
  [key: string]: unknown;
}

/** 代理组：成员声明在覆写时校验，因此在此边界保留为 unknown。 */
export interface ProxyGroup {
  name: string;
  type?: string;
  proxies?: string[];
  filter?: string;
  use?: string[];
  'x-substore'?: unknown;
  [key: string]: unknown;
}

/** 覆写后的客户端代理组，内部成员声明已被移除。 */
export interface FinalProxyGroup extends ProxyGroup {
  'x-substore'?: never;
}

/** 本项目只更新 provider 的 URL，其他客户端选项原样保留。 */
export type ProxyProvider = Record<string, unknown>;

/** 配置处理入口使用的字段；允许初始空配置及客户端自定义字段。 */
export interface ProxyConfig {
  proxies?: ProxyNode[];
  'proxy-groups'?: ProxyGroup[];
  'proxy-providers'?: Record<string, ProxyProvider>;
  rules?: string[];
  [key: string]: unknown;
}

/** 通过合并阶段校验、具有组列表及规则列表的配置。 */
export interface MergedConfig extends ProxyConfig {
  'proxy-groups': ProxyGroup[];
  rules: string[];
}

/** 保留输入的其他已知字段，用最终组及 provider 类型替换被覆写字段。 */
export type OverwrittenConfig<T extends ProxyConfig = ProxyConfig> = Omit<
  T,
  'proxy-groups' | 'proxy-providers'
> &
  ProxyConfig & { 'proxy-groups': FinalProxyGroup[] };

/** 远程配置读取请求，timeout 单位为毫秒。 */
export interface HttpRequest {
  url: string;
  timeout: number;
}

/** 外部响应字段在读取来源时检查状态、类型和内容。 */
export interface HttpResponse {
  statusCode?: unknown;
  status?: unknown;
  body?: unknown;
}

/** 合并模块依赖的 HTTP 与 YAML 能力，避免核心逻辑绑定 Sub-Store 全局对象。 */
export interface ConfigRuntime {
  get: (request: HttpRequest) => Promise<HttpResponse | undefined>;
  parseYaml: (source: string) => unknown;
}

/** 核心模块只依赖日志写入能力。 */
export interface Logger {
  log: (...values: unknown[]) => void;
}
