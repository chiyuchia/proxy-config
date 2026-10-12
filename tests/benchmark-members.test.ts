/**
 * @file 验证独立方向测速副本的声明、复用、字段转换、名称冲突与失败原子性。
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { overwriteConfig } from '../src/scripts/config-overwrite/index.ts';
import { readMemberPolicy } from '../src/scripts/shared/member-policy.ts';
import type { ConfigMap, ProxyConfig, ProxyGroup, ProxyNode } from '../src/scripts/shared/types.ts';

/**
 * 构造带独立测速声明的代理组，允许覆盖字段以验证错误分支。
 * @param {string} name 代理组名称。
 * @param {Object} [fields={}] 覆盖的组字段。
 * @param {Object} [members={}] 覆盖的成员声明字段。
 * @returns {Object} 新建的组，默认 SG 方向、五秒超时，重建并排除链式节点。
 */
function benchmarkGroup(
  name: string,
  fields: Partial<ProxyGroup> = {},
  members: ConfigMap = {},
): ProxyGroup {
  return {
    name,
    type: 'url-test',
    url: 'https://sg.example.com/',
    timeout: 5000,
    'x-substore': {
      members: { mode: 'replace', 'exclude-dialer': true, benchmark: 'SG', ...members },
    },
    ...fields,
  };
}

/**
 * 检查失败覆写保留配置值、组与节点数组、节点对象及声明引用。
 * @param {Object} config 预期无法覆写的输入配置。
 * @param {RegExp} error 预期错误内容。
 * @returns {void} 所有保留断言通过时正常返回。
 */
function assertUnchangedOnFailure(config: ProxyConfig, error: RegExp): void {
  const before = structuredClone(config);
  const proxies = config.proxies;
  const firstProxy = proxies?.[0];
  const groups = config['proxy-groups'];
  const firstGroup = groups?.[0];
  const metadata = firstGroup?.['x-substore'];
  const runtimeMetadata = config['x-substore'];
  assert.throws(() => overwriteConfig(config), error);
  assert.deepEqual(config, before);
  assert.equal(config.proxies, proxies);
  assert.equal(config.proxies?.[0], firstProxy);
  assert.equal(config['proxy-groups'], groups);
  assert.equal(config['proxy-groups']?.[0], firstGroup);
  assert.equal(config['proxy-groups']?.[0]['x-substore'], metadata);
  assert.equal(config['x-substore'], runtimeMetadata);
}

test('direction aliases reuse original fields without mutating nodes or leaking into ordinary groups', () => {
  const transport = Object.freeze({ mode: 'packet' });
  const original: ProxyNode = Object.freeze({
    name: 'Viking HK Go',
    type: 'trojan',
    server: 'hk.example.com',
    password: 'fixture-only',
    'benchmark-url': 'https://old.example.com/',
    'benchmark-timeout': 17,
    'benchmark-disabled': true,
    transport,
  });
  const proxies = [original];
  const config: ProxyConfig = {
    proxies,
    'proxy-groups': [
      benchmarkGroup('SG 香港', { filter: '^Viking HK Go$' }),
      benchmarkGroup('SG 亚太'),
      benchmarkGroup('JP 香港', { url: 'https://jp.example.com/' }, { benchmark: 'JP' }),
      {
        name: '普通组',
        type: 'select',
        'x-substore': { members: { mode: 'append' } },
      },
    ],
  };

  assert.equal(overwriteConfig(config), config);
  assert.notEqual(config.proxies, proxies);
  assert.equal(config.proxies![0], original);
  assert.equal(proxies.length, 1);
  assert.deepEqual(
    config['proxy-groups']!.map((group) => group.proxies),
    [
      ['Viking HK Go [SG测速]'],
      ['Viking HK Go [SG测速]'],
      ['Viking HK Go [JP测速]'],
      ['Viking HK Go'],
    ],
  );
  assert.equal(config.proxies!.length, 3);
  for (const [index, label, url] of [
    [1, 'SG', 'https://sg.example.com/'],
    [2, 'JP', 'https://jp.example.com/'],
  ] as const) {
    assert.equal(config.proxies![index].transport, transport);
    assert.deepEqual(config.proxies![index], {
      ...original,
      name: `${original.name} [${label}测速]`,
      'benchmark-url': url,
      'benchmark-timeout': 5,
      'benchmark-disabled': false,
    });
  }
  assert.equal(original['benchmark-timeout'], 17);
  assert.equal(original['benchmark-disabled'], true);
  assert.ok(config['proxy-groups']!.every((group) => !Object.hasOwn(group, 'x-substore')));
});

test('benchmark copies only original members accepted by filter, actual protocol and dialer exclusion', () => {
  const proxies: ProxyNode[] = [
    { name: '良心云 HK CT', type: 'VLESS' },
    { name: '良心云 HK CT VLESS', type: 'hy2' },
    { name: '良心云 HK CT 中转', type: 'vless', 'dialer-proxy': 'DIRECT' },
    { name: '良心云 SG CT', type: 'vless' },
    { name: 'Viking HK Go', type: 'vless' },
  ];
  const config: ProxyConfig = {
    proxies,
    'proxy-groups': [
      benchmarkGroup(
        '协议筛选',
        { filter: '^良心云 HK CT', proxies: ['过期节点'] },
        {
          types: [' vLeSs '],
        },
      ),
    ],
  };
  overwriteConfig(config);
  assert.deepEqual(config['proxy-groups']![0].proxies, ['良心云 HK CT [SG测速]']);
  assert.equal(config.proxies!.length, proxies.length + 1);
  assert.ok(proxies.every((proxy, index) => config.proxies![index] === proxy));
});

test('omitted group timeout removes a source benchmark timeout only from the alias', () => {
  const group = benchmarkGroup('默认超时');
  delete group.timeout;
  const original: ProxyNode = { name: 'HK', 'benchmark-timeout': 17 };
  const config: ProxyConfig = { proxies: [original], 'proxy-groups': [group] };
  overwriteConfig(config);
  assert.equal(original['benchmark-timeout'], 17);
  assert.ok(!Object.hasOwn(config.proxies![1], 'benchmark-timeout'));
  assert.equal(readMemberPolicy(group).benchmark?.timeout, undefined);
});

test('benchmark labels are trimmed and millisecond timeout can retain fractional seconds', () => {
  const group = benchmarkGroup('方向', { timeout: 1250 }, { benchmark: ' SG ' });
  assert.deepEqual(readMemberPolicy(group).benchmark, {
    label: 'SG',
    url: 'https://sg.example.com/',
    timeout: 1.25,
  });
});

test('invalid benchmark declarations are rejected even before runtime member generation', () => {
  for (const benchmark of [undefined, null, false, 1, [], {}, '', ' \n ']) {
    assert.throws(
      () => readMemberPolicy(benchmarkGroup('无效标签', {}, { benchmark })),
      /benchmark.*非空字符串/,
    );
  }
  for (const mode of ['append', 'manual']) {
    assert.throws(
      () => readMemberPolicy(benchmarkGroup('无效模式', {}, { mode })),
      /benchmark.*replace/,
    );
  }
  for (const type of ['select', 'fallback']) {
    assert.throws(
      () => readMemberPolicy(benchmarkGroup('无效组', { type })),
      /benchmark.*url-test/,
    );
  }
  assert.throws(
    () => readMemberPolicy(benchmarkGroup('未排除中转', {}, { 'exclude-dialer': false })),
    /benchmark.*exclude-dialer/,
  );
  const noExclusion = benchmarkGroup('缺少排除', {}, { 'exclude-dialer': true });
  noExclusion['x-substore'] = { members: { mode: 'replace', benchmark: 'SG' } };
  assert.throws(() => readMemberPolicy(noExclusion), /benchmark.*exclude-dialer/);
  for (const url of [undefined, null, '', 'ftp://example.com/', 'https://', 'https://a:bad/']) {
    assert.throws(() => readMemberPolicy(benchmarkGroup('无效 URL', { url })), /url.*HTTP/);
  }
  for (const timeout of [undefined, null, '5000', 0, -1, Number.NaN, Infinity]) {
    assert.throws(
      () => readMemberPolicy(benchmarkGroup('无效超时', { timeout })),
      /timeout.*正有限数字/,
    );
  }
});

test('same-label URL or timeout conflicts fail atomically even with no current candidates', () => {
  for (const fields of [{ url: 'https://jp.example.com/' }, { timeout: 6000 }]) {
    const config: ProxyConfig = {
      proxies: [],
      'proxy-groups': [benchmarkGroup('第一个'), benchmarkGroup('冲突组', fields)],
    };
    assertUnchangedOnFailure(config, /冲突组.*第一个.*SG.*冲突/);
  }
  const noTimeout = benchmarkGroup('无超时');
  delete noTimeout.timeout;
  assertUnchangedOnFailure(
    { 'proxy-groups': [benchmarkGroup('有超时'), noTimeout] },
    /timeout.*一致/,
  );
});

test('alias collisions with injected nodes or groups fail without overwriting user definitions', () => {
  for (const collision of ['proxy', 'group']) {
    const config: ProxyConfig = {
      proxies: [
        { name: 'HK', type: 'trojan' },
        ...(collision === 'proxy' ? [{ name: 'HK [SG测速]', type: 'ss' }] : []),
      ],
      'proxy-groups': [
        benchmarkGroup('生成组', { filter: '^HK$' }),
        ...(collision === 'group'
          ? [{ name: 'HK [SG测速]', type: 'select', 'x-substore': { members: { mode: 'manual' } } }]
          : []),
      ],
    };
    assertUnchangedOnFailure(config, /名称冲突.*HK \[SG测速\]/);
  }
});

test('different source and label combinations cannot silently generate the same alias name', () => {
  const config: ProxyConfig = {
    proxies: [{ name: 'HK' }, { name: 'HK [A测速]' }],
    'proxy-groups': [
      benchmarkGroup('第一个', { filter: '^HK$' }, { benchmark: 'A测速] [B' }),
      benchmarkGroup('第二个', { filter: '^HK \\[A测速\\]$' }, { benchmark: 'B' }),
    ],
  };
  assertUnchangedOnFailure(config, /名称冲突.*HK \[A测速\] \[B测速\]/);
});

test('final validation failures leave generated aliases and all declarations uncommitted', () => {
  const config: ProxyConfig = {
    proxies: [{ name: 'HK', type: 'trojan' }],
    'proxy-groups': [benchmarkGroup('方向')],
    'x-substore': { 'runtime-proxy-providers': ['runtime'] },
    rules: ['MATCH,missing'],
  };
  assertUnchangedOnFailure(config, /missing/);
});

test('empty benchmark pools reject while ordinary pools and missing proxies keep original semantics', () => {
  const config: ProxyConfig = {
    'proxy-groups': [
      benchmarkGroup('空方向'),
      benchmarkGroup('运行时方向', { use: ['runtime'] }),
      {
        name: '普通空组',
        type: 'url-test',
        'x-substore': { members: { mode: 'replace' } },
      },
    ],
    'x-substore': { 'runtime-proxy-providers': ['runtime'] },
  };
  overwriteConfig(config);
  assert.deepEqual(
    config['proxy-groups']!.map((group) => group.proxies),
    [['REJECT'], ['REJECT'], []],
  );
  assert.deepEqual(config['proxy-groups']![1].use, ['runtime']);
  assert.ok(!Object.hasOwn(config, 'proxies'));

  const proxies: ProxyNode[] = [{ name: 'Unmatched' }];
  const unmatched: ProxyConfig = {
    proxies,
    'proxy-groups': [benchmarkGroup('未匹配', { filter: '^HK$' })],
  };
  overwriteConfig(unmatched);
  assert.equal(unmatched.proxies, proxies);
  assert.deepEqual(unmatched['proxy-groups']![0].proxies, ['REJECT']);
});
