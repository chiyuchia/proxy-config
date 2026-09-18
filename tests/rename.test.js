const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const scriptPath = path.resolve(__dirname, '../scripts/rename.js');

async function rename(proxies, args = {}) {
  const externalCalls = [];
  const context = vm.createContext({
    $arguments: args,
    console: { log() {} },
    AbortController,
    fetch() {
      externalCalls.push('fetch');
      throw new Error('Network requests are forbidden during name recognition');
    },
    setTimeout() {
      externalCalls.push('setTimeout');
      return 1;
    },
    clearTimeout() {
      externalCalls.push('clearTimeout');
    },
  });
  vm.runInContext(fs.readFileSync(scriptPath, 'utf8'), context, {
    filename: scriptPath,
  });
  const result = await context.operator(proxies, 'ClashMeta', {});
  // A request failure may be caught by the script, so throwing in fetch alone
  // does not prove that node processing stayed offline.
  assert.deepEqual(externalCalls, [], 'renaming must not use network requests or timers');
  return JSON.parse(JSON.stringify(result));
}

function node(id, name, extra = {}) {
  return { id, name, server: '192.0.2.1', port: 443, type: 'vless', ...extra };
}

test('unknown names keep their original names for IPv4, IPv6 and domain servers', async () => {
  const proxies = [
    node('ipv4', '未知节点 A'),
    node('ipv6', '未知节点 B', { server: '2001:db8::1' }),
    node('domain', 'example.jp 未知节点 C', { server: 'us.example.com' }),
    node('no-server', '香港', { server: undefined }),
  ];

  assert.deepEqual(await rename(proxies, { token: 'unused-legacy-token' }),
    JSON.parse(JSON.stringify(proxies)));
});

test('recognizes country names, flags, city aliases and country codes, then sorts by region', async () => {
  const result = await rename([
    node('english', 'Germany'),
    node('code', 'US_1'),
    node('flag', '🇸🇬'),
    node('city', 'Tokyo'),
    node('chinese', '香港'),
  ], { out: 'EN', retain: false });

  assert.deepEqual(result.map(({ id, name }) => [id, name]), [
    ['chinese', 'HK 01'],
    ['city', 'JP 01'],
    ['flag', 'SG 01'],
    ['code', 'US 01'],
    ['english', 'DE 01'],
  ]);
});

test('nodes sharing an endpoint keep independent name recognition and hot filtering', async () => {
  const proxies = [
    node('unknown', '未知节点'),
    node('hong-kong', '香港'),
    node('japan', '日本'),
    node('germany', '德国'),
  ];
  const args = { out: 'EN', retain: false };

  assert.deepEqual((await rename(proxies, args)).map(({ id, name }) => [id, name]), [
    ['hong-kong', 'HK 01'],
    ['japan', 'JP 01'],
    ['germany', 'DE 01'],
    ['unknown', '未知节点'],
  ]);
  assert.deepEqual((await rename(proxies, { ...args, hot: true })).map(p => p.id),
    ['hong-kong', 'japan']);
  assert.deepEqual((await rename(proxies, { ...args, hot: 'HK' })).map(p => p.id),
    ['hong-kong']);
});

test('renumbers within each subscription and retains provider, line and custom keywords', async () => {
  const result = await rename([
    node('viking-sh', '🇯🇵 JP-SH-12-GCP', { _subName: 'VikingLinks' }),
    node('viking-go', 'JP-Go-09-Hytron', { _subName: 'VikingLinks' }),
    node('liangxin', '🇯🇵日本高速01|CTCU|0.5x', { _subName: '良心云' }),
    node('custom', '东京 IPLC 99', { _subName: '示例订阅' }),
  ], { retain: 'IPLC' });

  assert.deepEqual(Object.fromEntries(result.map(p => [p.id, p.name])), {
    'viking-sh': '🇯🇵 JP 01 | SH GCP VikingLinks',
    'viking-go': '🇯🇵 JP 02 | Go Hytron VikingLinks',
    liangxin: '🇯🇵 JP 01 | 高速 CTCU 0.5x 良心云',
    custom: '🇯🇵 JP 01 | 东京 IPLC 示例订阅',
  });
});

test('block removes misleading text only for recognition and preserves the original output name', async () => {
  const original = node('blocked', '香港品牌 东京', { _subName: '示例订阅' });
  const result = await rename([original], { block: '香港品牌', remove: false });

  assert.equal(result[0].name, '🇯🇵 JP 01 | 香港品牌 东京 示例订阅');
  assert.equal(original.name, '香港品牌 东京');
});
