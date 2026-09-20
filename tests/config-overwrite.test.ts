/**
 * @file 验证配置覆写的节点筛选、成员更新与 provider 注入行为。
 * 覆盖声明式成员策略、严格验证、正则状态、输入保留及已有 provider 设置保留。
 */

import assert from 'node:assert/strict';
import test, { type Mock } from 'node:test';
import { updateGroupMembers } from '../src/config-overwrite/group-members.ts';
import { overwriteConfig } from '../src/config-overwrite/index.ts';
import type { ProxyConfig, ProxyGroup, ProxyNode } from '../src/types.ts';

/**
 * 从测试配置中读取指定代理组的成员，供结果断言使用。
 * @param {Object} config 含 proxy-groups 的待检查配置。
 * @param {string} name 必须存在的代理组名称。
 * @returns {string[]|undefined} 该组的 proxies 字段。
 */
function members(config: ProxyConfig, name: string): string[] | undefined {
  return config['proxy-groups']!.find((group) => group.name === name)!.proxies;
}

/**
 * 构造成员生成声明；允许传入无效值以覆盖声明校验的失败场景。
 * @param {*} mode 成员生成模式或测试用的无效模式值。
 * @param {Object} [options={}] 合并到 members 中的附加字段。
 * @returns {Object} 可展开到代理组上的 x-substore 声明。
 */
function policy(
  mode: unknown,
  options: Record<string, unknown> = {},
): Pick<ProxyGroup, 'x-substore'> {
  return { 'x-substore': { members: { mode, ...options } } };
}

/**
 * 原地递归冻结无循环的测试数据，使被测代码的意外修改立即报错。
 * @param {*} value 待冻结的对象、数组或原始值。
 * @returns {*} 同一输入值；对象及其后代均已冻结。
 */
function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
  return value;
}

test('invalid filters do not add nodes and replace groups drop stale members', (t) => {
  t.mock.method(console, 'log', () => {});
  const config = {
    proxies: [{ name: 'HK 01', type: 'vless' }],
    'proxy-groups': [
      { name: '普通筛选组', filter: '[', proxies: ['DIRECT'], ...policy('append') },
      { name: '任意重建组', filter: '[', proxies: ['旧成员'], ...policy('replace') },
    ],
  };

  overwriteConfig(config);

  assert.deepEqual(members(config, '普通筛选组'), ['DIRECT']);
  assert.deepEqual(members(config, '任意重建组'), []);
  assert.equal((console.log as Mock<typeof console.log>).mock.calls.length, 2);
});

test('inline flags match each node independently, including stateful g/y filters', () => {
  const config = {
    proxies: [{ name: 'HK 01' }, { name: 'HK 02' }, { name: 'JP 01' }, { name: 'hk 03' }],
    'proxy-groups': [
      { name: 'global', filter: '(?i)(?g)HK', ...policy('append') },
      { name: 'sticky', filter: '(?iy)HK', ...policy('replace') },
    ],
  };

  overwriteConfig(config);

  assert.deepEqual(members(config, 'global'), ['HK 01', 'HK 02', 'hk 03']);
  assert.deepEqual(members(config, 'sticky'), ['HK 01', 'HK 02', 'hk 03']);
});

test('append preserves candidate order and manual preserves duplicates without name conventions', () => {
  const manual = {
    name: '任意手工名单',
    proxies: ['DIRECT', 'DIRECT', '链式节点'],
    filter: 'never-match',
    ...policy('manual', { 'exclude-dialer': true, types: ['vless'] }),
  };
  const config = {
    proxies: [
      { name: 'JP 02' },
      { name: 'HK 01' },
      { name: 'JP 02' },
      { name: '链式节点', 'dialer-proxy': '中转' },
      { name: '' },
      null as unknown as ProxyNode, // 故意注入空节点，验证运行时会忽略它。
    ],
    'proxy-groups': [
      { name: '普通组', proxies: ['DIRECT', 'HK 01', 'DIRECT'], ...policy('append') },
      { name: '中转', proxies: ['DIRECT'], ...policy('append', { 'exclude-dialer': false }) },
      { name: '🎯 全球直连', proxies: ['DIRECT'], ...policy('append') },
      manual,
    ],
    rules: ['MATCH,普通组'],
  };
  const rules = config.rules;
  const proxies = config.proxies;

  assert.equal(overwriteConfig(config), config);
  assert.deepEqual(members(config, '普通组'), ['DIRECT', 'HK 01', 'JP 02', '链式节点']);
  assert.deepEqual(members(config, '中转'), ['DIRECT', 'JP 02', 'HK 01', '链式节点']);
  assert.deepEqual(members(config, '🎯 全球直连'), ['DIRECT', 'JP 02', 'HK 01', '链式节点']);
  assert.deepEqual(members(config, '任意手工名单'), ['DIRECT', 'DIRECT', '链式节点']);
  assert.ok(config['proxy-groups'].every((group) => !Object.hasOwn(group, 'x-substore')));
  assert.ok(Object.hasOwn(manual, 'x-substore'));
  assert.equal(config.rules, rules);
  assert.equal(config.proxies, proxies);
});

test('replace uses declared actual protocols and direct nodes on every fresh generation', () => {
  const vless: ProxyNode = { name: '良心云 HK CT Hy2', type: 'VLESS' };
  const hy2: ProxyNode = { name: '良心云 SG CT VLESS', type: 'hy2' };
  const hysteria2: ProxyNode = { name: '良心云 JP CT', type: 'HYSTERIA2' };
  const viking: ProxyNode = { name: 'VikingLinks HK Go', type: 'trojan' };
  const blowing: ProxyNode = { name: '吹雪云 SG 电信', type: 'ss' };
  const template = [
    {
      name: '任意 VLESS 名单',
      filter: '良心云',
      proxies: ['旧地区节点'],
      ...policy('replace', { 'exclude-dialer': true, types: ['VlEsS'] }),
    },
    {
      name: '任意 Hy2 名单',
      filter: '良心云',
      proxies: ['旧协议节点'],
      ...policy('replace', { 'exclude-dialer': true, types: ['hysteria2', 'HY2'] }),
    },
    {
      name: 'Viking 自定义名称',
      filter: 'VikingLinks',
      proxies: ['旧地区节点'],
      ...policy('replace', { 'exclude-dialer': true }),
    },
    {
      name: '吹雪自定义名称',
      filter: '吹雪云',
      proxies: ['旧地区节点'],
      ...policy('replace', { 'exclude-dialer': true }),
    },
  ];
  /**
   * 复制成员策略模板并注入当前节点，模拟每次从新合并配置开始生成。
   * @param {Object[]} proxies 本次生成使用的节点数组。
   * @returns {Object} 完成成员覆写的新配置，模板本身不变。
   */
  const generate = (proxies: ProxyNode[]) =>
    overwriteConfig({ proxies, 'proxy-groups': structuredClone(template) });
  const config = generate([vless, hy2, hysteria2, viking, blowing]);

  assert.deepEqual(members(config, '任意 VLESS 名单'), [vless.name]);
  assert.deepEqual(members(config, '任意 Hy2 名单'), [hy2.name, hysteria2.name]);
  assert.deepEqual(members(config, 'Viking 自定义名称'), [viking.name]);
  assert.deepEqual(members(config, '吹雪自定义名称'), [blowing.name]);
  assert.deepEqual(generate(config.proxies), config);

  vless.type = 'hysteria2';
  hy2['dialer-proxy'] = '中转';
  viking['dialer-proxy'] = '中转';
  blowing.name = '已改名节点';
  const changed = generate([vless, hy2, viking, blowing]);

  assert.deepEqual(members(changed, '任意 VLESS 名单'), []);
  assert.deepEqual(members(changed, '任意 Hy2 名单'), [vless.name]);
  assert.deepEqual(members(changed, 'Viking 自定义名称'), []);
  assert.deepEqual(members(changed, '吹雪自定义名称'), []);
});

test('append clears ineligible existing nodes but preserves static groups and ignores their filter', () => {
  const config = {
    proxies: [
      { name: '已变为链式', type: 'vless', 'dialer-proxy': '上游组' },
      { name: '已变为 Hy2', type: 'hysteria2' },
      { name: '静态 JP', type: 'VLESS' },
      { name: '新增 HK', type: 'vless' },
      { name: '名称有 VLESS 的 HK', type: 'trojan' },
      { name: '无协议 HK' },
    ],
    'proxy-groups': [
      {
        name: '任意追加组',
        filter: 'HK',
        proxies: ['DIRECT', '子组', '已变为链式', '静态 JP', '已变为 Hy2', 'DIRECT'],
        ...policy('append', { 'exclude-dialer': true, types: ['vless'] }),
      },
      { name: '子组', proxies: ['DIRECT'], ...policy('manual') },
    ],
  };

  overwriteConfig(config);

  assert.deepEqual(members(config, '任意追加组'), ['DIRECT', '子组', '静态 JP', '新增 HK']);
});

test('renaming a group cannot change its declared member behavior', () => {
  const nodes = [
    { name: '直接节点', type: 'vless' },
    { name: '链式节点', type: 'hysteria2', 'dialer-proxy': '上游组' },
  ];
  const names = ['新建组', '中转', '🎯 全球直连', '✈️ 良心云 亚太', '✈️ 良心云 Hy2'];
  for (const mode of ['append', 'replace', 'manual'] as const) {
    const groups = names.map((name) => ({
      name,
      proxies: ['DIRECT', 'DIRECT'],
      ...policy(mode),
    }));
    const result: ProxyGroup[] = updateGroupMembers(groups, nodes);
    const expected = {
      append: ['DIRECT', '直接节点', '链式节点'],
      replace: ['直接节点', '链式节点'],
      manual: ['DIRECT', 'DIRECT'],
    }[mode];
    for (const group of result) assert.deepEqual(group.proxies, expected, `${mode}: ${group.name}`);
  }
});

test('member updates return clean groups without mutating source groups or proxy objects', () => {
  const groups = freezeDeep([
    { name: '追加组', proxies: ['DIRECT'], ...policy('append') },
    { name: '重建组', proxies: ['旧成员'], ...policy('replace') },
    { name: '手工组', proxies: ['DIRECT', 'DIRECT'], ...policy('manual') },
  ]);
  const proxies = freezeDeep([{ name: 'HK', type: 'vless', server: 'example.invalid' }]);
  const before = structuredClone({ groups, proxies });
  const result: ProxyGroup[] = updateGroupMembers(groups, proxies);

  assert.notEqual(result, groups);
  assert.deepEqual({ groups, proxies }, before);
  result.forEach((group, index) => {
    assert.notEqual(group, groups[index]);
    assert.equal(Object.hasOwn(group, 'x-substore'), false);
  });
  assert.deepEqual(
    result.map((group) => group.proxies),
    [['DIRECT', 'HK'], ['HK'], ['DIRECT', 'DIRECT']],
  );
});

test('serialized final output must be merged with declared policies again before overwriting', () => {
  const template = {
    proxies: [{ name: 'HK' }],
    'proxy-groups': [{ name: '需要声明的组', ...policy('append') }],
  };
  const first = overwriteConfig(structuredClone(template));
  const serialized = JSON.parse(JSON.stringify(first)) as ProxyConfig;
  const before = structuredClone(serialized);

  assert.throws(() => overwriteConfig(serialized), /config-overwrite/);
  assert.deepEqual(serialized, before);
  assert.deepEqual(overwriteConfig(structuredClone(template)), first);
});

test('all group declarations are validated before any config or provider mutation', async (t) => {
  const cases: [string, Record<string, unknown>, string][] = [
    ['missing extension', {}, 'x-substore'],
    ['null extension', { 'x-substore': null }, 'x-substore'],
    ['array extension', { 'x-substore': [] }, 'x-substore'],
    ['scalar extension', { 'x-substore': true }, 'x-substore'],
    ['missing members', { 'x-substore': {} }, 'members'],
    ['null members', { 'x-substore': { members: null } }, 'members'],
    ['array members', { 'x-substore': { members: [] } }, 'members'],
    ['scalar members', { 'x-substore': { members: 'append' } }, 'members'],
    ['missing mode', { 'x-substore': { members: {} } }, 'mode'],
    ['unknown mode', policy('unknown'), 'mode'],
    ['null mode', policy(null), 'mode'],
    ['wrong mode case', policy('APPEND'), 'mode'],
    ['string boolean', policy('append', { 'exclude-dialer': 'false' }), 'exclude-dialer'],
    ['numeric boolean', policy('append', { 'exclude-dialer': 0 }), 'exclude-dialer'],
    ['null boolean', policy('append', { 'exclude-dialer': null }), 'exclude-dialer'],
    ['string types', policy('append', { types: 'vless' }), 'types'],
    ['null types', policy('append', { types: null }), 'types'],
    ['empty types', policy('append', { types: [] }), 'types'],
    ['empty type', policy('append', { types: [''] }), 'types'],
    ['blank type', policy('append', { types: [' '] }), 'types'],
    ['non-string type', policy('append', { types: ['vless', 1] }), 'types'],
    ['null type', policy('append', { types: ['vless', null] }), 'types'],
    ['unknown member field', policy('append', { typo: true }), 'typo'],
    [
      'unknown extension field',
      { 'x-substore': { members: { mode: 'append' }, typo: true } },
      'typo',
    ],
  ];

  for (const [label, declaration, field] of cases) {
    await t.test(label, () => {
      const config = {
        proxies: [{ name: 'HK', type: 'vless' }],
        'proxy-groups': [
          { name: '先验证的正常组', proxies: ['DIRECT'], ...policy('append') },
          { name: '声明错误组', proxies: ['旧成员'], ...declaration },
        ],
        'proxy-providers': { oixCloud: { type: 'http', url: 'https://example.com/old' } },
      };
      const before = structuredClone(config);
      const groups = config['proxy-groups'];
      const providers = config['proxy-providers'];

      assert.throws(
        () => overwriteConfig(config, { oixCloudEdgePath: 'https://example.com/new' }),
        (error: unknown) => {
          const failure = error as Error;
          assert.match(failure.message, /config-overwrite/);
          assert.ok(failure.message.includes('声明错误组'), failure.message);
          assert.ok(failure.message.includes(field), failure.message);
          return true;
        },
      );

      assert.deepEqual(config, before);
      assert.equal(config['proxy-groups'], groups);
      assert.equal(config['proxy-providers'], providers);
    });
  }
});

test('provider URL injection preserves client settings and unrelated providers', () => {
  const oixCloud = {
    type: 'http',
    url: 'https://example.com/old',
    path: './custom.yaml',
    interval: 100,
    proxy: '自定义下载组',
    filter: 'IXP',
    'health-check': { enable: false, interval: 10, url: 'https://example.com/check' },
  };
  const other = { type: 'file', path: './other.yaml' };
  const config = { 'proxy-providers': { oixCloud, other } };

  overwriteConfig(config, { oixCloudEdgePath: 'https://example.com/new' });

  assert.deepEqual(config['proxy-providers']!.oixCloud, {
    ...oixCloud,
    url: 'https://example.com/new',
  });
  assert.equal(oixCloud.url, 'https://example.com/old');
  assert.equal(config['proxy-providers'].other, other);

  const providers = config['proxy-providers'];
  overwriteConfig(config, { oixCloudEdgePath: '  ' });
  assert.equal(config['proxy-providers'], providers);
});

test('provider defaults are only created when an explicit URL is supplied', () => {
  const config: ProxyConfig = {};
  overwriteConfig(config);
  assert.deepEqual(config, { 'proxy-groups': [] });

  overwriteConfig(config, { oixCloudEdgePath: 'https://example.com/subscription' });
  assert.deepEqual((config as ProxyConfig)['proxy-providers']!.oixCloud, {
    type: 'http',
    url: 'https://example.com/subscription',
    path: './proxy_provider/oixCloud.yaml',
    interval: 86400,
    proxy: 'DIRECT',
    'health-check': {
      enable: true,
      interval: 600,
      url: 'http://www.gstatic.com/generate_204',
    },
  });
});
