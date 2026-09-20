/**
 * @file 验证中转设置与原订阅脚本一致，并检查独立 Sub-Store 发布入口。
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { assignDialerProxy } from '../src/dialer-proxy/index.js';

const script = fs.readFileSync(new URL('../scripts/dialer-proxy.js', import.meta.url), 'utf8');

function loadOperator(globals = {}) {
  const context = vm.createContext(globals);
  vm.runInContext(script, context, { filename: 'scripts/dialer-proxy.js' });
  return context.operator;
}

test('self-hosted mode preserves the original case-sensitive landing-node rules', () => {
  const proxies = [
    { name: '自建 SG 落地', 'dialer-proxy': '旧中转', type: 'vless', port: 443 },
    { name: '自建 US 落地', type: 'hy2', _subName: '自建' },
    { name: '自建 sg 落地' },
    { name: '自建 新加坡 落地' },
    { name: '自建 SG 直连' },
    { name: '自建 US 直连', 'dialer-proxy': '手动中转' },
  ];
  const before = structuredClone(proxies);
  const expectedDialers = ['🛡️ 亚太中转', '🛡️ 美西中转', '🛡️ 美西中转', '🛡️ 美西中转'];

  const result = assignDialerProxy(proxies, { mode: 'self-hosted' });

  assert.deepEqual(result, [
    ...before.slice(0, 4).map((proxy, i) => ({ ...proxy, 'dialer-proxy': expectedDialers[i] })),
    ...before.slice(4),
  ]);
  assert.notEqual(result, proxies);
  result.forEach((proxy, i) => assert.equal(proxy, proxies[i]));
  assert.deepEqual(assignDialerProxy(proxies, { mode: 'self-hosted' }), result);
});

test('edge mode sets every supplied node without depending on names or subscription metadata', () => {
  const proxies = [
    { name: 'SG 01', _subName: 'oixCloud Edge', type: 'ss', password: 'test-only' },
    { name: 'JP 01', _subName: '一元机场', 'dialer-proxy': '旧中转' },
    { name: '其他订阅 SG 落地', 'dialer-proxy': '🛡️ 亚太中转' },
    { name: '' },
  ];
  const before = structuredClone(proxies);

  const result = assignDialerProxy(proxies, { mode: 'edge' });

  assert.deepEqual(
    result,
    before.map((proxy) => ({ ...proxy, 'dialer-proxy': '🛡️ Edge 中转' })),
  );
  result.forEach((proxy, i) => assert.equal(proxy, proxies[i]));
  assert.deepEqual(assignDialerProxy(proxies, { mode: 'edge' }), result);
});

test('missing or invalid modes fail before modifying nodes', () => {
  const proxies = [{ name: 'SG 落地', 'dialer-proxy': '手动中转' }];
  const before = structuredClone(proxies);
  for (const args of [undefined, null, {}, { mode: '' }, { mode: 'Edge' }, { mode: true }]) {
    assert.throws(() => assignDialerProxy(proxies, args), /mode 必须为 self-hosted 或 edge/);
    assert.deepEqual(proxies, before);
  }
});

test('published operator runs standalone with explicit modes and rejects missing arguments', async () => {
  for (const mode of ['self-hosted', 'edge']) {
    const operator = loadOperator({ $arguments: { mode } });
    const proxies = [{ name: 'SG 落地' }, { name: 'US 落地' }, { name: 'SG 直连' }];
    const expected = assignDialerProxy(structuredClone(proxies), { mode });
    for (const platform of ['ClashMeta', 'Stash']) {
      const result = await operator(structuredClone(proxies), platform, {});
      assert.deepEqual(JSON.parse(JSON.stringify(result)), expected);
    }
    assert.equal(operator([], 'ClashMeta', {}).length, 0);
  }
  assert.throws(() => loadOperator()([{ name: 'SG 落地' }]), /mode 必须为 self-hosted 或 edge/);
});
