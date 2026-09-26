/**
 * @file 仅由 tsc 检查的类型契约，不作为 Node.js 运行时测试执行。
 * 确保覆写输出不再承诺已移除的内部声明，同时保留节点和其他配置字段的类型。
 */

import type { overwriteConfig } from '../src/scripts/config-overwrite/index.ts';
import type { renameProxies } from '../src/scripts/rename/index.ts';
import type { ProxyNode } from '../src/scripts/shared/types.ts';

/** 当被检查的类型不为 true 时，在类型检查阶段报错。 */
type Assert<T extends true> = T;

type Template = {
  'x-substore': { 'runtime-proxy-providers': ['oixCloud'] };
  'proxy-groups': {
    name: string;
    'x-substore': { members: { mode: 'append' } };
  }[];
  'proxy-providers': {
    subscription: { type: 'http'; url: 'https://example.com/nodes'; interval: 600 };
  };
  rules: ['MATCH,DIRECT'];
  label: 'custom';
};

type Output = ReturnType<typeof overwriteConfig<Template>>;
type TaggedNode = ProxyNode & { sourceId: number };

export type RemovedMemberDeclaration = Assert<
  Output['proxy-groups'][number]['x-substore'] extends undefined ? true : false
>;
export type RemovedRuntimeProviderDeclaration = Assert<
  Output['x-substore'] extends undefined ? true : false
>;
export type PreservedProviderFields = Assert<
  Output['proxy-providers'] extends Template['proxy-providers'] ? true : false
>;
export type PreservedRules = Assert<Output['rules'] extends Template['rules'] ? true : false>;
export type PreservedCustomField = Assert<Output['label'] extends 'custom' ? true : false>;
export type PreservedNodeFields = Assert<
  ReturnType<typeof renameProxies<TaggedNode>> extends TaggedNode[] ? true : false
>;
