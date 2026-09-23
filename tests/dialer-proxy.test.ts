/**
 * @file 验证节点按地区设置中转，并检查独立 Sub-Store 发布入口。
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { assignDialerProxy } from '../src/dialer-proxy/index.ts';
import type { ProxyNode } from '../src/types.ts';

type DialerOperator = (
  proxies: ProxyNode[],
  targetPlatform?: string,
  context?: Record<string, unknown>,
) => ProxyNode[];

const script = fs.readFileSync(new URL('../scripts/dialer-proxy.js', import.meta.url), 'utf8');

/**
 * 在独立 VM 中加载中转发布脚本，取得不依赖源码模块加载器的入口。
 * @param {Object} [globals={}] 注入 VM 的 Sub-Store 全局对象与脚本参数。
 * @returns {Function} 接收节点、目标平台和上下文的 operator 函数。
 * @throws {Error} 发布脚本加载或执行失败时抛出。
 */
function loadOperator(globals: Record<string, unknown> = {}): DialerOperator {
  const context = vm.createContext(globals);
  vm.runInContext(script, context, { filename: 'scripts/dialer-proxy.js' });
  return (context as unknown as { operator: DialerOperator }).operator;
}

test('all supplied nodes use regional dialers while retaining names, fields and order', () => {
  const proxies = [
    { name: '自建 SG 落地', 'dialer-proxy': '旧中转', type: 'vless', port: 443 },
    { name: '自建 US 落地', type: 'hy2', _subName: '自建' },
    { name: '自建 sg 落地' },
    { name: '自建 新加坡 落地' },
    { name: '自建 SG 直连' },
    { name: '自建 US 直连', 'dialer-proxy': '手动中转' },
    { name: 'SG 01', _subName: 'oixCloud Edge', type: 'ss', password: 'test-only' },
    { name: 'JP 01', _subName: '一元机场', 'dialer-proxy': '旧中转' },
    { name: 'US 01', _subName: '一元机场', 'dialer-proxy': '旧中转' },
    { name: '德国 01', _subName: '美国订阅', server: 'us.example.com' },
    { name: '' },
  ];
  const before = structuredClone(proxies);
  const expectedDialers = [
    '🛡️ 亚太中转',
    '🛡️ 美西中转',
    '🛡️ 亚太中转',
    '🛡️ 亚太中转',
    '🛡️ 亚太中转',
    '🛡️ 美西中转',
    '🛡️ 亚太中转',
    '🛡️ 亚太中转',
    '🛡️ 美西中转',
    '🛡️ 亚太中转',
    '🛡️ 亚太中转',
  ];

  const result = assignDialerProxy(proxies);

  assert.deepEqual(
    result,
    before.map((proxy, i) => ({
      ...proxy,
      'dialer-proxy': expectedDialers[i],
    })),
  );
  assert.notEqual(result, proxies);
  result.forEach((proxy, i) => assert.equal(proxy, proxies[i]));
  assert.deepEqual(assignDialerProxy(proxies), result);
});

test('recognition uses names, supports region aliases and does not require a server', () => {
  const cases = [
    ['美国 01', '🛡️ 美西中转'],
    ['🇺🇸 01', '🛡️ 美西中转'],
    ['United States 01', '🛡️ 美西中转'],
    ['us_01', '🛡️ 美西中转'],
    ['USA 01', '🛡️ 美西中转'],
    ['洛杉矶 US 01', '🛡️ 美西中转'],
    ['西雅图 01', '🛡️ 美西中转'],
    ['LAX 01', '🛡️ 美西中转'],
    ['🇭🇰 US-Go-01-Provider', '🛡️ 美西中转'],
    ['HK-Go-01-US', '🛡️ 亚太中转'],
    ['日本 01', '🛡️ 亚太中转'],
    ['加拿大 01', '🛡️ 亚太中转'],
    ['Australia 01', '🛡️ 亚太中转'],
    ['RUS 01', '🛡️ 亚太中转'],
    ['未知节点', '🛡️ 亚太中转'],
    ['us.example.com 未知节点', '🛡️ 亚太中转'],
  ];

  for (const [name, expected] of cases) {
    for (const server of [undefined, 'hk.example.com']) {
      const proxies: ProxyNode[] = [{ name, server, _subName: 'US 订阅', country: 'US' }];
      const [result] = assignDialerProxy(proxies);
      assert.equal(result['dialer-proxy'], expected, name);
      assert.equal(result.name, name);
    }
  }
});

test('published operator runs standalone without arguments and ignores legacy modes', async () => {
  for (const globals of [
    {},
    { $arguments: { mode: 'self-hosted' } },
    { $arguments: { mode: 'edge' } },
  ]) {
    const operator = loadOperator(globals);
    const proxies = [
      { name: 'SG 落地' },
      { name: 'US 落地' },
      { name: 'SG 直连' },
      { name: '美国 01' },
      { name: '🇺🇸 02' },
      { name: '德国 01' },
      { name: '未知节点' },
    ];
    const expected = [
      '🛡️ 亚太中转',
      '🛡️ 美西中转',
      '🛡️ 亚太中转',
      '🛡️ 美西中转',
      '🛡️ 美西中转',
      '🛡️ 亚太中转',
      '🛡️ 亚太中转',
    ];
    for (const platform of ['ClashMeta', 'Stash']) {
      const result = await operator(structuredClone(proxies), platform, {});
      assert.deepEqual(
        JSON.parse(JSON.stringify(result)),
        proxies.map((proxy, i) => ({ ...proxy, 'dialer-proxy': expected[i] })),
      );
    }
    assert.equal(operator([], 'ClashMeta', {}).length, 0);
  }
});
