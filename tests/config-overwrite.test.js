/**
 * @file 验证配置覆写的节点筛选、成员更新与 provider 注入行为。
 * 覆盖无效筛选、正则状态、协议限制、重复执行及已有 provider 设置保留。
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { overwriteConfig } from '../src/config-overwrite/index.js';

function members(config, name) {
  return config['proxy-groups'].find((group) => group.name === name).proxies;
}

test('invalid filters do not inject all nodes and dedicated groups drop stale members', (t) => {
  t.mock.method(console, 'log', () => {});
  const config = {
    proxies: [{ name: 'HK 01', type: 'vless' }],
    'proxy-groups': [
      { name: '普通筛选组', filter: '[', proxies: ['DIRECT'] },
      { name: '✈️ 良心云 亚太', filter: '[', proxies: ['旧成员'] },
    ],
  };

  overwriteConfig(config);

  assert.deepEqual(members(config, '普通筛选组'), ['DIRECT']);
  assert.deepEqual(members(config, '✈️ 良心云 亚太'), []);
  assert.equal(console.log.mock.calls.length, 2);
});

test('inline flags match each node independently, including stateful g/y filters', () => {
  const config = {
    proxies: [{ name: 'HK 01' }, { name: 'HK 02' }, { name: 'JP 01' }, { name: 'hk 03' }],
    'proxy-groups': [
      { name: 'global', filter: '(?i)(?g)HK' },
      { name: 'sticky', filter: '(?iy)HK' },
    ],
  };

  overwriteConfig(config);

  assert.deepEqual(members(config, 'global'), ['HK 01', 'HK 02', 'hk 03']);
  assert.deepEqual(members(config, 'sticky'), ['HK 01', 'HK 02', 'hk 03']);
});

test('ordinary groups append once in order and direct groups retain manual members', () => {
  const direct = { name: '🎯 全球直连', proxies: ['DIRECT', 'DIRECT'] };
  const config = {
    proxies: [
      { name: 'JP 02' },
      { name: 'HK 01' },
      { name: 'JP 02' },
      { name: '链式节点', 'dialer-proxy': '中转' },
      { name: '' },
      null,
    ],
    'proxy-groups': [
      { name: '普通组', proxies: ['DIRECT', 'HK 01', 'DIRECT'] },
      { name: '中转', proxies: ['DIRECT'] },
      direct,
    ],
    rules: ['MATCH,普通组'],
  };
  const rules = config.rules;
  const proxies = config.proxies;

  assert.equal(overwriteConfig(config), config);
  const firstGroups = structuredClone(config['proxy-groups']);
  overwriteConfig(config);

  assert.deepEqual(members(config, '普通组'), ['DIRECT', 'HK 01', 'JP 02', '链式节点']);
  assert.deepEqual(members(config, '中转'), ['DIRECT', 'JP 02', 'HK 01']);
  assert.deepEqual(config['proxy-groups'], firstGroups);
  assert.equal(config['proxy-groups'][2], direct);
  assert.equal(config.rules, rules);
  assert.equal(config.proxies, proxies);
});

test('dedicated groups rebuild from actual protocols and current direct nodes', () => {
  const vless = { name: '良心云 HK CT Hy2', type: 'VLESS' };
  const hy2 = { name: '良心云 SG CT VLESS', type: 'hy2' };
  const hysteria2 = { name: '良心云 JP CT', type: 'HYSTERIA2' };
  const viking = { name: 'VikingLinks HK Go', type: 'trojan' };
  const blowing = { name: '吹雪云 SG 电信', type: 'ss' };
  const config = {
    proxies: [vless, hy2, hysteria2, viking, blowing],
    'proxy-groups': [
      { name: '✈️ 良心云 亚太', filter: '良心云', proxies: ['旧地区节点'] },
      { name: '✈️ 良心云 Hy2', filter: '良心云', proxies: ['旧协议节点'] },
      { name: '✈️ VikingLinks 亚太', filter: 'VikingLinks', proxies: ['旧地区节点'] },
      { name: '✈️ 吹雪云 亚太', filter: '吹雪云', proxies: ['旧地区节点'] },
    ],
  };

  overwriteConfig(config);
  assert.deepEqual(members(config, '✈️ 良心云 亚太'), [vless.name]);
  assert.deepEqual(members(config, '✈️ 良心云 Hy2'), [hy2.name, hysteria2.name]);
  assert.deepEqual(members(config, '✈️ VikingLinks 亚太'), [viking.name]);
  assert.deepEqual(members(config, '✈️ 吹雪云 亚太'), [blowing.name]);

  vless.type = 'hysteria2';
  hy2['dialer-proxy'] = '中转';
  viking['dialer-proxy'] = '中转';
  blowing.name = '已改名节点';
  config.proxies = [vless, hy2, viking, blowing];
  overwriteConfig(config);

  assert.deepEqual(members(config, '✈️ 良心云 亚太'), []);
  assert.deepEqual(members(config, '✈️ 良心云 Hy2'), [vless.name]);
  assert.deepEqual(members(config, '✈️ VikingLinks 亚太'), []);
  assert.deepEqual(members(config, '✈️ 吹雪云 亚太'), []);
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

  assert.deepEqual(config['proxy-providers'].oixCloud, {
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
  const config = {};
  overwriteConfig(config);
  assert.deepEqual(config, { 'proxy-groups': [] });

  overwriteConfig(config, { oixCloudEdgePath: 'https://example.com/subscription' });
  assert.deepEqual(config['proxy-providers'].oixCloud, {
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
