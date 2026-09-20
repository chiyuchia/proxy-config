/**
 * @file 仅由 tsc 检查的类型契约，不作为 Node.js 运行时测试执行。
 * 确保覆写输出不再承诺已移除的内部声明，同时保留节点和其他配置字段的类型。
 */

import type { overwriteConfig } from '../src/config-overwrite/index.ts';
import type { renameProxies } from '../src/rename/index.ts';
import type { ProxyNode } from '../src/types.ts';

/** 当被检查的类型不为 true 时，在类型检查阶段报错。 */
type Assert<T extends true> = T;

type Template = {
  'proxy-groups': {
    name: string;
    'x-substore': { members: { mode: 'append' } };
  }[];
  rules: ['MATCH,DIRECT'];
  label: 'custom';
};

type Output = ReturnType<typeof overwriteConfig<Template>>;
type TaggedNode = ProxyNode & { sourceId: number };

export type RemovedMemberDeclaration = Assert<
  Output['proxy-groups'][number]['x-substore'] extends undefined ? true : false
>;
export type PreservedRules = Assert<Output['rules'] extends Template['rules'] ? true : false>;
export type PreservedCustomField = Assert<Output['label'] extends 'custom' ? true : false>;
export type PreservedNodeFields = Assert<
  ReturnType<typeof renameProxies<TaggedNode>> extends TaggedNode[] ? true : false
>;
