/** @file Sub-Store 在执行独立脚本时注入的全局对象，仅供静态类型检查。 */

import type { ConfigRuntime, ScriptArguments } from './types.ts';

declare global {
  const $arguments: ScriptArguments | null | undefined;
  const $substore: { http: Pick<ConfigRuntime, 'get'> };
  const ProxyUtils: { yaml: { safeLoad: ConfigRuntime['parseYaml'] } };
}
