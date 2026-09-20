/**
 * @file 验证最终配置的结构、名称、引用、环路及 HTTP 地址，并确保失败不污染输入。
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { overwriteConfig } from '../src/config-overwrite/index.ts';
import { validateFinalConfig } from '../src/config-overwrite/validation.ts';
import type { ProxyConfig, ProxyGroup } from '../src/types.ts';

/**
 * 创建带手工成员声明的完整代理组，可直接用于覆写或最终校验。
 * @param {string} name 代理组名称。
 * @param {string[]} [proxies=['DIRECT']] 组内显式成员。
 * @returns {Object} 每次新建的 select 组及手工成员声明。
 */
function group(name: string, proxies: string[] = ['DIRECT']): ProxyGroup {
  return { name, type: 'select', proxies, 'x-substore': { members: { mode: 'manual' } } };
}

/**
 * 构造包含节点、策略组、两类 provider 和规则的合法配置。
 * @returns {Object} 可独立修改的测试配置。
 */
function fixture(): ProxyConfig {
  return {
    proxies: [{ name: '落地', 'dialer-proxy': '中转' }, { name: '入口' }],
    'proxy-groups': [group('主组', ['落地', '中转']), group('中转', ['入口'])],
    'proxy-providers': { subscription: { type: 'http', url: 'https://example.com/nodes' } },
    'rule-providers': { domains: { type: 'http', url: 'https://example.com/rules' } },
    rules: ['RULE-SET,domains,主组', 'MATCH,主组'],
  };
}

test('valid final config preserves values, built-ins, rule flags and shared DAG dependencies', () => {
  const config = fixture();
  config.proxies!.push(
    { name: '空中转', 'dialer-proxy': '' },
    { name: '直连中转', 'dialer-proxy': 'DIRECT' },
  );
  config['proxy-groups']!.push(
    group('内置策略', ['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS', 'PASS-RULE', 'COMPATIBLE']),
    { ...group('远程', []), use: ['subscription'] },
  );
  config.rules!.unshift('RULE-SET,domains,主组,no-resolve', 'SCRIPT,quic,REJECT,no-track');
  config.rules!.unshift('DOMAIN-REGEX,^example\\(,DIRECT');
  const before = structuredClone(config);
  validateFinalConfig(config);
  assert.deepEqual(config, before);
  assert.doesNotThrow(() => validateFinalConfig({}));
  assert.doesNotThrow(() =>
    validateFinalConfig({
      'proxy-groups': [group('no-track'), group('no-resolve')],
      rules: [
        'MATCH,no-track',
        'DOMAIN,example.com,no-resolve',
        'AND,((NETWORK,TCP),(DST-PORT,443)),no-track',
      ],
    }),
  );
});

test('final validation reports invalid containers, names and explicit references', async (t) => {
  const cases: [string, unknown, RegExp][] = [
    ['null config', null, /配置必须是映射/],
    ['invalid proxies', { proxies: {} }, /proxies.*数组/],
    ['null proxy', { proxies: [null] }, /proxies\[0\].*映射/],
    ['empty name', { proxies: [{ name: ' ' }] }, /proxies\[0\].name/],
    ['non-string name', { proxies: [{ name: 12 }] }, /proxies\[0\].name/],
    ['duplicate nodes', { proxies: [{ name: 'A' }, { name: 'A' }] }, /重名：A/],
    ['duplicate groups', { 'proxy-groups': [group('A'), group('A')] }, /重名：A/],
    ['node-group conflict', { proxies: [{ name: 'A' }], 'proxy-groups': [group('A')] }, /重名：A/],
    ['built-in node', { proxies: [{ name: 'DIRECT' }] }, /内置策略重名：DIRECT/],
    ['built-in group', { 'proxy-groups': [group('PASS-RULE')] }, /内置策略重名：PASS-RULE/],
    ['GLOBAL node', { proxies: [{ name: 'GLOBAL' }] }, /内置策略重名：GLOBAL/],
    ['invalid groups', { 'proxy-groups': 'groups' }, /proxy-groups.*数组/],
    ['null group', { 'proxy-groups': [null] }, /proxy-groups\[0\].*映射/],
    ['empty group name', { 'proxy-groups': [{ name: '' }] }, /\.name/],
    ['missing group type', { 'proxy-groups': [{ name: 'A' }] }, /A.*type/],
    ['blank group type', { 'proxy-groups': [{ ...group('A'), type: ' ' }] }, /A.*type/],
    [
      'invalid members',
      { 'proxy-groups': [{ ...group('A'), proxies: 'DIRECT' }] },
      /proxies.*数组/,
    ],
    ['invalid member value', { 'proxy-groups': [{ ...group('A'), proxies: [1] }] }, /proxies\[0\]/],
    ['unknown member', { 'proxy-groups': [group('A', ['missing'])] }, /A.*proxies.*missing/],
    ['invalid use', { 'proxy-groups': [{ ...group('A'), use: [true] }] }, /use\[0\]/],
    [
      'unknown provider',
      { 'proxy-groups': [{ ...group('A'), use: ['missing'] }] },
      /A.*use.*missing/,
    ],
    [
      'unknown dialer',
      { proxies: [{ name: 'A', 'dialer-proxy': 'missing' }] },
      /A.*dialer-proxy.*missing/,
    ],
    ['invalid dialer', { proxies: [{ name: 'A', 'dialer-proxy': true }] }, /A.*dialer-proxy/],
    ['blank dialer', { proxies: [{ name: 'A', 'dialer-proxy': ' ' }] }, /A.*dialer-proxy/],
    ['invalid proxy providers', { 'proxy-providers': [] }, /proxy-providers.*映射/],
    ['null provider', { 'proxy-providers': { bad: null } }, /proxy-providers\[bad\]/],
    ['invalid rule providers', { 'rule-providers': false }, /rule-providers.*映射/],
    ['invalid rules', { rules: null }, /rules.*数组/],
    ['invalid rule', { rules: [1] }, /rules\[0\]/],
    ['unknown rule target', { rules: ['MATCH,missing'] }, /rules\[0\].*missing/],
    ['unknown rule provider', { rules: ['RULE-SET,missing,DIRECT'] }, /rule-provider.*missing/],
  ];
  for (const [name, config, expected] of cases) {
    await t.test(name, () => {
      assert.throws(() => validateFinalConfig(config), expected);
    });
  }
});

test('cycle detection covers nodes, groups, mixed paths and implicit GLOBAL', async (t) => {
  const cases: [string, ProxyConfig, RegExp][] = [
    ['self dialer', { proxies: [{ name: 'A', 'dialer-proxy': 'A' }] }, /A → A/],
    [
      'two dialers',
      {
        proxies: [
          { name: 'A', 'dialer-proxy': 'B' },
          { name: 'B', 'dialer-proxy': 'A' },
        ],
      },
      /A → B → A/,
    ],
    ['self group', { 'proxy-groups': [group('A', ['A'])] }, /A → A/],
    ['two groups', { 'proxy-groups': [group('A', ['B']), group('B', ['A'])] }, /A → B → A/],
    [
      'mixed path',
      {
        proxies: [{ name: '落地', 'dialer-proxy': '中转' }],
        'proxy-groups': [group('中转', ['子组']), group('子组', ['落地'])],
      },
      /落地 → 中转 → 子组 → 落地/,
    ],
    ['implicit GLOBAL', { proxies: [{ name: 'A', 'dialer-proxy': 'GLOBAL' }] }, /A → GLOBAL → A/],
  ];
  for (const [name, config, expected] of cases) {
    await t.test(name, () => assert.throws(() => validateFinalConfig(config), expected));
  }
  assert.doesNotThrow(() =>
    validateFinalConfig({
      proxies: [{ name: 'A', 'dialer-proxy': 'GLOBAL' }],
      'proxy-groups': [group('GLOBAL')],
    }),
  );
});

test('long acyclic dialer chains do not exhaust the JavaScript call stack', () => {
  const proxies = Array.from({ length: 12000 }, (_, i) => ({
    name: `node-${i}`,
    'dialer-proxy': i === 11999 ? 'DIRECT' : `node-${i + 1}`,
  }));
  assert.doesNotThrow(() => validateFinalConfig({ proxies }));
});

test('HTTP provider validation accepts absolute addresses without requiring URL or network APIs', () => {
  const urls = [
    'https://example.com/subscription?token=encoded%20value&mode=full',
    'http://localhost:8080/nodes',
    'http://127.0.0.1:9090/nodes',
    'https://user:p%40ss@example.com/nodes',
    'HTTPS://example.com/nodes',
    'http://[::1]:8080/nodes',
    'http://[2001:db8::192.0.2.1]:000080/nodes',
    'http://[1:2:3:4:5:6:7:8]/nodes',
    'http://[fe80::1%25en0]/nodes',
    'https://订阅.example/节点',
  ];
  for (const field of ['proxy-providers', 'rule-providers']) {
    for (const url of urls) {
      assert.doesNotThrow(
        () => validateFinalConfig({ [field]: { remote: { type: 'http', url } } }),
        url,
      );
    }
    assert.doesNotThrow(() =>
      validateFinalConfig({
        [field]: {
          file: { type: 'file', path: './provider.yaml' },
          inline: { type: 'inline', payload: [] },
        },
      }),
    );
  }
});

test('HTTP provider validation rejects malformed URLs without exposing subscription secrets', () => {
  const urls: unknown[] = [
    undefined,
    null,
    true,
    '',
    ' ',
    'not-a-url',
    'ftp://example.com/nodes',
    'https://',
    'https:///nodes',
    'https://?token=secret',
    'https://:443/nodes',
    'https://example.com:bad/nodes',
    'https://example.com:65536/nodes',
    'https://example.com\\secret',
    'https://example.com/has space',
    'https://example.com/nodes?token=%GG',
    'https://[broken]/nodes',
    'https://[:::]/nodes',
    'https://[1:2]/nodes',
    'https://[1:2:3:4:5:6:7:8:9]/nodes',
    'https://[::ffff:256.1.1.1]/nodes',
    'https://[192.0.2.1::]/nodes',
  ];
  for (const field of ['proxy-providers', 'rule-providers']) {
    for (const url of urls) {
      assert.throws(
        () => validateFinalConfig({ [field]: { private: { type: 'http', url } } }),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.ok(error.message.includes(`${field}[private].url`));
          if (typeof url === 'string' && url.length > 2) assert.ok(!error.message.includes(url));
          return true;
        },
      );
    }
  }
});

test('runtime providers permit explicit use references without defining local providers', () => {
  const config: ProxyConfig = {
    'x-substore': { 'runtime-proxy-providers': ['oixCloud', 'custom-runtime'] },
    'proxy-providers': { subscription: { type: 'http', url: 'https://example.com/nodes' } },
    'rule-providers': { 'custom-runtime': { type: 'inline', payload: [] } },
    'proxy-groups': [
      { ...group('运行时来源', []), use: ['oixCloud', 'custom-runtime', 'subscription'] },
    ],
    rules: ['RULE-SET,custom-runtime,运行时来源'],
  };
  const before = structuredClone(config);
  assert.doesNotThrow(() => validateFinalConfig(config));
  assert.deepEqual(config, before);

  for (const metadata of [undefined, {}, { 'runtime-proxy-providers': [] }]) {
    assert.doesNotThrow(() => validateFinalConfig({ 'x-substore': metadata }));
    assert.throws(
      () => validateFinalConfig({ ...config, 'x-substore': metadata }),
      /use.*oixCloud/,
    );
  }
});

test('runtime provider declarations are strict and cannot hide local provider definitions', async (t) => {
  const cases: [string, unknown][] = [
    ['null metadata', null],
    ['array metadata', []],
    ['scalar metadata', true],
    ['unknown metadata field', { 'runtime-proxy-providers': ['oixCloud'], typo: [] }],
    ['null provider list', { 'runtime-proxy-providers': null }],
    ['scalar provider list', { 'runtime-proxy-providers': 'oixCloud' }],
    ['map provider list', { 'runtime-proxy-providers': {} }],
    ['empty provider name', { 'runtime-proxy-providers': [''] }],
    ['blank provider name', { 'runtime-proxy-providers': ['  '] }],
    ['non-string provider name', { 'runtime-proxy-providers': ['oixCloud', 1] }],
    ['null provider name', { 'runtime-proxy-providers': [null] }],
    ['duplicate provider name', { 'runtime-proxy-providers': ['oixCloud', 'oixCloud'] }],
    ['local provider collision', { 'runtime-proxy-providers': ['subscription'] }],
  ];
  for (const [label, declaration] of cases) {
    await t.test(label, () => {
      const config = { ...fixture(), 'x-substore': declaration };
      const before = structuredClone(config);
      const groups = config['proxy-groups'];
      const providers = config['proxy-providers'];
      assert.throws(() => validateFinalConfig(config), /x-substore/);
      assert.throws(() => overwriteConfig(config), /x-substore/);
      assert.deepEqual(config, before);
      assert.equal(config['x-substore'], declaration);
      assert.equal(config['proxy-groups'], groups);
      assert.equal(config['proxy-providers'], providers);
    });
  }
});

test('runtime providers are not available as nodes, dialers, rule targets or rule sets', async (t) => {
  const declaration = { 'runtime-proxy-providers': ['oixCloud'] };
  const cases: [string, ProxyConfig, RegExp][] = [
    ['group member', { 'proxy-groups': [group('主组', ['oixCloud'])] }, /proxies.*oixCloud/],
    ['dialer', { proxies: [{ name: 'A', 'dialer-proxy': 'oixCloud' }] }, /dialer-proxy.*oixCloud/],
    ['rule target', { rules: ['MATCH,oixCloud'] }, /rules.*oixCloud/],
    ['rule provider', { rules: ['RULE-SET,oixCloud,DIRECT'] }, /rule-provider.*oixCloud/],
    [
      'undeclared runtime provider',
      { 'proxy-groups': [{ ...group('主组'), use: ['another-runtime'] }] },
      /use.*another-runtime/,
    ],
  ];
  for (const [label, config, expected] of cases) {
    await t.test(label, () =>
      assert.throws(() => validateFinalConfig({ ...config, 'x-substore': declaration }), expected),
    );
  }
});

test('every locally defined HTTP provider still requires a valid URL regardless of its name', () => {
  for (const field of ['proxy-providers', 'rule-providers']) {
    for (const name of ['oixCloud', 'subscription']) {
      for (const url of [undefined, '', ' ', null, true, 'not-a-url', 'ftp://example.com/sub']) {
        assert.throws(
          () => validateFinalConfig({ [field]: { [name]: { type: 'http', url } } }),
          /url/,
        );
      }
      assert.doesNotThrow(() =>
        validateFinalConfig({
          [field]: { [name]: { type: 'http', url: 'https://example.com/sub' } },
        }),
      );
    }
  }
  assert.throws(
    () =>
      validateFinalConfig({
        'x-substore': { 'runtime-proxy-providers': ['oixCloud'] },
        'proxy-providers': { subscription: { type: 'http' } },
      }),
    /subscription.*url/,
  );
});

test('failed final validation preserves input references, declarations and provider settings', () => {
  const invalidInputs: ProxyConfig[] = [
    { proxies: [{ name: 'A' }, { name: 'A' }] },
    { proxies: [{ name: 'A', 'dialer-proxy': 'missing' }] },
    { proxies: [{ name: 'A', 'dialer-proxy': 'A' }] },
    { rules: ['MATCH,missing'] },
    { 'rule-providers': { bad: { type: 'http' } } },
    { 'proxy-providers': { oixCloud: { type: 'http' } } },
  ];
  for (const invalid of invalidInputs) {
    const declaration = { 'runtime-proxy-providers': ['custom-runtime'] };
    const config = { ...fixture(), ...invalid, 'x-substore': declaration };
    if (invalid.proxies) config.proxies = [...fixture().proxies!, ...invalid.proxies];
    const groups = config['proxy-groups'];
    const providers = config['proxy-providers'];
    const before = structuredClone(config);
    assert.throws(() => overwriteConfig(config), /config-overwrite/);
    assert.deepEqual(config, before);
    assert.equal(config['x-substore'], declaration);
    assert.equal(config['proxy-groups'], groups);
    assert.equal(config['proxy-providers'], providers);
  }
});

test('final checks run after member replacement and strip metadata only after success', () => {
  const config: ProxyConfig = {
    'x-substore': { 'runtime-proxy-providers': ['oixCloud'] },
    proxies: [{ name: 'A' }],
    'proxy-groups': [
      {
        ...group('主组', ['已经不存在的节点']),
        use: ['oixCloud'],
        'x-substore': { members: { mode: 'replace' } },
      },
    ],
    'proxy-providers': { subscription: { type: 'http', url: 'invalid' } },
    rules: ['MATCH,主组'],
  };
  const metadata = config['x-substore'];
  const groups = config['proxy-groups'];
  const providers = config['proxy-providers'];
  const proxies = config.proxies;
  const rules = config.rules;
  const before = structuredClone(config);
  assert.throws(() => overwriteConfig(config), /subscription.*url/);
  assert.deepEqual(config, before);
  assert.equal(config['x-substore'], metadata);
  assert.equal(config['proxy-groups'], groups);

  config['proxy-providers']!.subscription.url = 'https://example.com/nodes';
  assert.equal(overwriteConfig(config), config);
  assert.deepEqual(config['proxy-groups']![0].proxies, ['A']);
  assert.deepEqual(config['proxy-groups']![0].use, ['oixCloud']);
  assert.ok(!Object.hasOwn(config, 'x-substore'));
  assert.ok(!Object.hasOwn(config['proxy-groups']![0], 'x-substore'));
  assert.equal(config['proxy-providers'], providers);
  assert.equal(config.proxies, proxies);
  assert.equal(config.rules, rules);
});
