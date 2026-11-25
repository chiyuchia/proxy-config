/**
 * @file 共享的配置与 Sub-Store 运行时类型。
 * 未由本项目处理的协议和客户端字段以 unknown 保留，外部 YAML 仍需运行时校验。
 */

/** 尚未经过具体字段校验的配置映射。 */
export type ConfigMap = Record<string, unknown>;

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

/** 本地 provider 配置；经结构与 HTTP URL 检查后原样保留。 */
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

/** 保留输入的其他已知字段，更新组类型。 */
export type OverwrittenConfig<T extends ProxyConfig = ProxyConfig> = Omit<T, 'proxy-groups'> &
  ProxyConfig & { 'proxy-groups': FinalProxyGroup[] };

/** 核心模块只依赖日志写入能力。 */
export interface Logger {
  log: (...values: unknown[]) => void;
}
