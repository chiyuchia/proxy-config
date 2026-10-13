/**
 * @file 验证 SG、JP 方向中转的机场优先级、地区筛选及独立测速节点。
 * 从配置源码合并后执行覆写，检查两端最终成员与未注入候选时的行为。
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { parse } from 'yaml';
import { mergeConfigDocuments } from '../tools/merge-config/index.ts';
import { overwriteConfig } from '../src/scripts/config-overwrite/index.ts';
import type { MergedConfig, ProxyGroup, ProxyNode } from '../src/scripts/shared/types.ts';

const clients = ['mihomo', 'stash'] as const;
type Client = (typeof clients)[number];
const directions = [
  { code: 'SG', region: '新加坡', url: 'https://sgp-ping.vultr.com/favicon.ico?v=2' },
  { code: 'JP', region: '日本', url: 'https://hnd-jp-ping.vultr.com/favicon.ico?v=2' },
] as const;

const relayFixtures = [
  ['VikingLinks', 'HK', 'VikingLinks HK Go', 'ss'],
  ['VikingLinks', 'SG', 'VikingLinks SG IEPL', 'ss'],
  ['VikingLinks', 'JP', 'VikingLinks JP SH', 'ss'],
  ['VikingLinks', 'TW', 'VikingLinks TW Go', 'ss'],
  ['吹雪云', 'HK', '吹雪云 HK 电信', 'ss'],
  ['吹雪云', 'SG', '吹雪云 SG 电信', 'vless'],
  ['吹雪云', 'JP', '吹雪云 JP 电信', 'trojan'],
  ['吹雪云', 'TW', '吹雪云 TW 电信', 'ss'],
  ['良心云', 'HK', '良心云 HK CT', 'vless'],
  ['良心云', 'SG', '良心云 SG CTCU', 'VLESS'],
  ['良心云', 'JP', '良心云 JP CTCUCM', 'vless'],
  ['良心云', 'TW', '良心云 TW CT', 'vless'],
  ['oixCloud Optimized', 'HK', '香港 IXP', 'ss'],
  ['oixCloud Optimized', 'SG', 'CIA Singapore', 'ss'],
  ['oixCloud Optimized', 'JP', '🇯🇵 IXP', 'ss'],
  ['oixCloud Optimized', 'TW', 'CIA 台灣', 'ss'],
] as const;

/**
 * 读取两份独立 YAML 源并注入测试节点，不依赖已构建的 dist 文件。
 * @param {string} client 要合并的客户端。
 * @param {Object[]} [proxies=[]] 注入节点，直接交给覆写以检查输入保留。
 * @returns {Object} 具有成员声明的合并配置。
 */
function sourceConfig(client: Client, proxies: ProxyNode[] = []): MergedConfig {
  const readSource = (name: string): unknown =>
    parse(fs.readFileSync(new URL(`../src/configs/${name}.yaml`, import.meta.url), 'utf8'), {
      merge: true,
      uniqueKeys: true,
    });
  const config = mergeConfigDocuments(readSource('base'), readSource(client));
  config.proxies = proxies;
  return config;
}

/**
 * 按业务约定列出机场顺序，Stash 不包含 oixCloud。
 * @param {string} client 要验证的客户端。
 * @returns {string[]} 当前客户端的机场优先级。
 */
function airportsFor(client: Client): string[] {
  return [
    'VikingLinks',
    '吹雪云',
    ...(client === 'mihomo' ? ['oixCloud Optimized'] : []),
    '良心云',
  ];
}

/**
 * 获取具名代理组，缺失时立即给出该名称的断言信息。
 * @param {Object} config 合并或覆写后的配置。
 * @param {string} name 组名。
 * @returns {Object} 对应的代理组。
 */
function group(config: Pick<MergedConfig, 'proxy-groups'>, name: string): ProxyGroup {
  const result = config['proxy-groups'].find((candidate) => candidate.name === name);
  assert.ok(result, `missing group: ${name}`);
  return result;
}

/**
 * 创建含可用中转、被排除中转和自建落地的测试节点。
 * @returns {Object[]} 节点名称和附加连接字段各自独立的输入数组。
 */
function injectedNodes(): ProxyNode[] {
  const valid = relayFixtures.map(([, , name, type], index) => ({
    name,
    type,
    server: `relay-${index}.example.com`,
    port: 443,
    password: 'test-only',
    udp: true,
  }));
  const excluded: ProxyNode[] = [
    { name: 'VikingLinks HK Gomami', type: 'ss' },
    { name: 'VikingLinks SG 普通', type: 'ss' },
    { name: 'VikingLinks KR Go', type: 'ss' },
    { name: 'VikingLinks US Go', type: 'ss' },
    { name: 'VikingLinks HK Go 链式', type: 'ss', 'dialer-proxy': 'DIRECT' },
    { name: '吹雪云 HK 移动', type: 'ss' },
    { name: '吹雪云 KR 电信', type: 'ss' },
    { name: '吹雪云 SG 电信 链式', type: 'ss', 'dialer-proxy': 'DIRECT' },
    { name: '良心云 HK CT Hy2', type: 'hysteria2' },
    { name: '良心云 HK CM', type: 'vless' },
    { name: '良心云 KR CT', type: 'vless' },
    { name: '良心云 JP CT 链式', type: 'vless', 'dialer-proxy': 'DIRECT' },
    { name: 'oixCloud Edge HK', type: 'ss' },
    { name: 'IXP KR', type: 'ss' },
    { name: 'CIA US', type: 'ss' },
    { name: 'IXP JP 链式', type: 'ss', 'dialer-proxy': 'DIRECT' },
    { name: '自建 SG 落地', type: 'ss', 'dialer-proxy': '🛡️ 新加坡中转' },
    { name: '自建 JP 落地', type: 'ss', 'dialer-proxy': '🛡️ 日本中转' },
  ];
  return [...valid, ...excluded];
}

test('directional selectors preserve airport priority before the ordered Asia-Pacific tail', () => {
  for (const client of clients) {
    const config = sourceConfig(client);
    const airports = airportsFor(client);
    for (const { code, region, url } of directions) {
      const expected = [
        ...airports.flatMap((airport) => [
          `✈️ ${airport} 香港 · ${code}`,
          `✈️ ${airport} ${region} · ${code}`,
        ]),
        ...airports.map((airport) => `✈️ ${airport} 亚太 · ${code}`),
      ];
      const selector = group(config, `🛡️ ${region}中转`);
      const fallback = group(config, `🛡️ ${region} Fallback`);
      assert.equal(selector.type, 'select');
      assert.deepEqual(selector['x-substore'], { members: { mode: 'manual' } });
      assert.deepEqual(selector.proxies, [fallback.name, ...expected]);
      assert.equal(fallback.type, 'fallback');
      assert.deepEqual(fallback['x-substore'], { members: { mode: 'manual' } });
      assert.deepEqual(fallback.proxies, expected, `${client}: ${region} fallback order`);

      for (const candidate of [fallback, ...expected.map((name) => group(config, name))]) {
        assert.equal(candidate.url, url, candidate.name);
        assert.equal(candidate.interval, candidate === fallback ? 60 : 300, candidate.name);
        assert.equal(candidate.timeout, 5000, candidate.name);
        assert.equal(candidate.lazy, false, candidate.name);
        assert.equal(candidate['expected-status'], 200, candidate.name);
        assert.equal(candidate['max-failed-times'], 3, candidate.name);
        if (candidate === fallback) continue;
        assert.equal(candidate.type, 'url-test', candidate.name);
        assert.equal(candidate.tolerance, 100, candidate.name);
        assert.deepEqual(candidate['x-substore'], {
          members: {
            mode: 'replace',
            'exclude-dialer': true,
            ...(candidate.name.includes('良心云') ? { types: ['vless'] } : {}),
            benchmark: code,
          },
        });
      }
    }
  }
});

test('directional pools filter original relays and share only same-direction benchmark copies', () => {
  for (const client of clients) {
    const originals = injectedNodes();
    const before = structuredClone(originals);
    const config = sourceConfig(client, originals);
    const ordinaryNames = config['proxy-groups']
      .filter(({ name }) => !/ · (SG|JP)$/.test(name))
      .map(({ name }) => name);
    const result = overwriteConfig(config);
    assert.deepEqual(originals, before, `${client}: source nodes are unchanged`);
    assert.deepEqual(result.proxies!.slice(0, originals.length), before);
    originals.forEach((proxy, index) => assert.equal(result.proxies![index], proxy));
    const aliases = result.proxies!.slice(originals.length);
    const aliasNames = new Set(aliases.map(({ name }) => name));
    assert.equal(aliasNames.size, aliases.length, 'overlapping pools reuse aliases');
    assert.equal(aliases.length, airportsFor(client).length * 4 * 2);

    for (const { code, region, url } of directions) {
      for (const airport of airportsFor(client)) {
        for (const [poolRegion, codes] of [
          ['香港', ['HK']],
          [region, [code]],
          ['亚太', ['HK', 'SG', 'JP', 'TW']],
        ] as [string, string[]][]) {
          const expected = relayFixtures
            .filter(([source, country]) => source === airport && codes.includes(country))
            .map(([, , name]) => `${name} [${code}测速]`);
          const pool = group(result, `✈️ ${airport} ${poolRegion} · ${code}`);
          assert.deepEqual(pool.proxies, expected, `${client}: ${pool.name}`);
          if (airport === 'oixCloud Optimized') assert.deepEqual(pool.use, ['oixCloud']);
        }
      }
      for (const alias of aliases.filter(({ name }) => name.endsWith(`[${code}测速]`))) {
        const original = originals.find(({ name }) => `${name} [${code}测速]` === alias.name);
        assert.ok(original);
        assert.ok(!original['dialer-proxy']);
        assert.deepEqual(alias, {
          ...original,
          name: alias.name,
          'benchmark-url': url,
          'benchmark-timeout': 5,
          'benchmark-disabled': false,
        });
      }
    }
    for (const name of ordinaryNames) {
      assert.ok(
        !group(result, name).proxies?.some((member) => aliasNames.has(member)),
        `${client}: generated copies must not leak into ${name}`,
      );
    }
    assert.ok(result['proxy-groups'].every((candidate) => !Object.hasOwn(candidate, 'x-substore')));
  }
});

test('one physical relay has independent SG and JP benchmark settings while keeping its name', () => {
  const original: ProxyNode = {
    name: 'VikingLinks HK Go',
    type: 'ss',
    server: 'same-relay.example.com',
    port: 443,
    password: 'test-only',
    'benchmark-url': 'https://previous.example.com/',
    'benchmark-timeout': 9,
    'benchmark-disabled': true,
  };
  for (const client of clients) {
    const before = structuredClone(original);
    const result = overwriteConfig(sourceConfig(client, [original]));
    assert.equal(result.proxies![0], original);
    assert.deepEqual(original, before);
    assert.equal(result.proxies!.length, 3, 'one shared alias per direction');
    const copies = directions.map(({ code, url }) => {
      const copy = result.proxies!.find(({ name }) => name === `${original.name} [${code}测速]`);
      assert.ok(copy);
      assert.notEqual(copy, original);
      assert.equal(copy.server, original.server);
      assert.equal(copy['benchmark-url'], url);
      assert.equal(copy['benchmark-timeout'], 5);
      assert.equal(copy['benchmark-disabled'], false);
      for (const region of ['香港', '亚太']) {
        assert.deepEqual(group(result, `✈️ VikingLinks ${region} · ${code}`).proxies, [copy.name]);
      }
      return copy;
    });
    assert.notEqual(copies[0], copies[1]);
    assert.deepEqual(group(result, '✈️ VikingLinks').proxies, [original.name]);
    assert.deepEqual(group(result, '✈️ VikingLinks 亚太').proxies, [original.name]);
  }
});

test('empty directional pools reject rather than silently adding direct transit', () => {
  for (const client of clients) {
    const result = overwriteConfig(sourceConfig(client));
    assert.deepEqual(result.proxies ?? [], []);
    for (const { code, region } of directions) {
      for (const airport of airportsFor(client)) {
        for (const poolRegion of ['香港', region, '亚太']) {
          const pool = group(result, `✈️ ${airport} ${poolRegion} · ${code}`);
          assert.deepEqual(pool.proxies, ['REJECT'], `${client}: ${pool.name}`);
          if (airport === 'oixCloud Optimized') assert.deepEqual(pool.use, ['oixCloud']);
        }
      }
      assert.ok(!group(result, `🛡️ ${region} Fallback`).proxies!.includes('DIRECT'));
    }
  }
});
