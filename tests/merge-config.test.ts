/**
 * @file 验证构建期配置合并、发布模板与 Sub-Store 覆写脚本的集成行为。
 * 覆盖补丁与引用校验，并检查 Mihomo 和 Stash 注入节点后的最终分组及候选顺序。
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { parse, stringify } from 'yaml';
import { mergeConfigDocuments } from '../tools/merge-config/index.ts';
import type {
  MergedConfig,
  ProxyGroup,
  ProxyNode,
  ScriptArguments,
} from '../src/scripts/shared/types.ts';

interface PublishedScripts {
  'dist/config-overwrite.js': typeof import('../src/scripts/entries/config-overwrite.ts');
  'dist/dialer-proxy.js': typeof import('../src/scripts/entries/dialer-proxy.ts');
  'dist/rename.js': typeof import('../src/scripts/entries/rename.ts');
}
interface FileRuntime {
  $content: string;
  $arguments: ScriptArguments;
  main?: unknown;
  compileGroupFilter?: unknown;
}
interface FixtureConfig extends MergedConfig {
  $base?: boolean;
  dns: { enable: boolean; nameserver: string[]; 'fake-ip-filter'?: string[] };
  'proxy-groups': (ProxyGroup & { proxies: string[] })[];
}

const root = fileURLToPath(new URL('..', import.meta.url));
const clients = ['mihomo', 'stash'] as const;

/**
 * 独立解析已发布的 YAML 模板或最终配置，拒绝重复键且不启用源码合并键。
 * @param {string} source 待解析的 YAML 或兼容的 JSON 文本。
 * @returns {*} 解析后的文档值，空文档返回解析器对应的空值。
 * @throws {Error} 文本语法错误或存在重复键时抛出。
 */
function parseYaml(source: string): unknown {
  return parse(source, { merge: false, uniqueKeys: true });
}

/**
 * 分别解析配置源码，展开文件内部的合并键并拒绝重复键。
 * @param {string} source 单份公共配置或客户端差异的 YAML 文本。
 * @returns {*} 解析后的配置源，不解析其他文件的锚点。
 * @throws {Error} YAML 语法错误、锚点未定义或键重复时抛出。
 */
function parseSourceYaml(source: string): unknown {
  return parse(source, { merge: true, uniqueKeys: true });
}

/**
 * 经 JSON 往返转换清除 VM 对象的跨上下文原型，便于深度比较。
 * @param {*} value 可进行 JSON 序列化且具有有效 JSON 结果的值。
 * @returns {*} JSON 表示对应的普通对象、数组或原始值。
 * @throws {Error} 输入无法序列化或无法解析为 JSON 时抛出。
 */
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * 在独立 VM 中加载仓库的发布脚本，并暴露其顶层入口供集成测试调用。
 * @param {string} file 相对于仓库根目录的脚本路径。
 * @param {Object} [globals={}] 注入的运行时全局对象，可覆盖默认 console。
 * @returns {import('node:vm').Context} 已执行脚本并包含入口函数的 VM 上下文。
 * @throws {Error} 文件读取、脚本解析或执行失败时抛出。
 */
function loadScript<K extends keyof PublishedScripts>(
  file: K,
  globals: Record<string, unknown> = {},
): PublishedScripts[K] {
  const context = vm.createContext({ console, ...globals });
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, {
    filename: file,
  });
  return context as unknown as PublishedScripts[K];
}

/**
 * 模拟 Sub-Store 的独立脚本作用域及解析、等待 main、序列化的文件处理流程。
 * 成功时更新 VM 中的 $content；脚本定义不会泄漏到 VM 全局作用域。
 * @param {string} file 相对于仓库根目录的发布脚本路径。
 * @param {import('node:vm').Context} context 已注入参数、内容及运行时依赖的 VM。
 * @returns {Promise<void>} 文件处理完成后兑现的 Promise。
 * @throws {Error} 文件读取失败时抛出；异步脚本或序列化错误使 Promise 拒绝。
 */
function runWrapped(file: string, context: vm.Context): Promise<void> {
  return vm.runInContext(
    `
    (async function () {
      ${fs.readFileSync(path.join(root, file), 'utf8')}
      let config = ProxyUtils.yaml.safeLoad($content);
      config = await main(config || {});
      $content = ProxyUtils.yaml.safeDump(config);
    })()
  `,
    context,
    { filename: `sub-store-wrapper:${file}` },
  );
}

/**
 * 创建文件脚本运行环境，以构建后的客户端模板为输入并记录成功序列化的输出。
 * 不注入 HTTP、Node.js 或 URL 全局对象，以检查覆写不依赖远程合并或本地运行时。
 * @param {string} client 已构建的客户端模板名称。
 * @returns {Object} 独立 VM 与成功序列化的配置列表，初始模板不计入输出列表。
 * @throws {Error} 发布模板不存在或读取失败时抛出。
 */
function fileRuntime(client: string): { context: FileRuntime; outputs: unknown[] } {
  const outputs: unknown[] = [];
  const context = vm.createContext({
    console,
    $content: fs.readFileSync(path.join(root, 'dist', `${client}.yaml`), 'utf8'),
    $arguments: {},
    ProxyUtils: {
      yaml: {
        safeLoad: parseYaml,
        /**
         * 记录成功到达序列化阶段的配置并输出 YAML。
         * @param {unknown} config 脚本返回的配置对象。
         * @returns {string} 序列化后的 YAML 文本。
         * @throws {Error} 配置无法序列化时抛出。
         */
        safeDump(config: unknown): string {
          outputs.push(config);
          return stringify(config);
        },
      },
    },
  }) as unknown as FileRuntime;
  return { context, outputs };
}

/**
 * 为合并单元测试创建独立的公共配置，包含可覆盖的 DNS、代理组及规则引用。
 * @returns {Object} 带 $base 标记且无注入节点的全新公共配置。
 */
function fixture(): FixtureConfig {
  return {
    $base: true,
    mode: 'rule',
    dns: {
      enable: true,
      nameserver: ['remove', 'anchor', 'keep'],
      'fake-ip-filter': ['localhost'],
    },
    'proxy-groups': [
      { name: 'Main', type: 'select', proxies: ['Airport', 'Region'] },
      { name: 'Airport', type: 'select', proxies: ['DIRECT'] },
      { name: 'Region', type: 'select', proxies: ['DIRECT'] },
    ],
    'proxy-providers': { subscription: { type: 'http', url: 'https://example.com/nodes' } },
    'rule-providers': {
      example: { type: 'http', behavior: 'domain', url: 'https://example.com/rules' },
    },
    rules: ['RULE-SET,example,Main', 'MATCH,Main'],
  };
}

/**
 * 调用源码合并入口，简化补丁和引用校验测试中的调用。
 * @param {Object} base 带 $base 标记的公共配置。
 * @param {Object} profile 带 $profile 标记的客户端差异配置。
 * @returns {Object} 完成合并与校验的新配置。
 * @throws {Error} 来源标记、补丁或合并后引用不合法时抛出。
 */
function merge(base: unknown, profile: unknown): MergedConfig {
  return mergeConfigDocuments(base, profile);
}

/**
 * 独立解析两个构建产物，再为它们注入同一批节点；不在测试运行时重新合并模板。
 * @param {Object[]} [proxies] 模拟 Sub-Store 注入的可选节点，复制后写入配置。
 * @returns {{mihomo: Object, stash: Object}} 由发布模板解析得到的两端配置。
 * @throws {Error} 发布模板读取或解析失败时抛出。
 */
function liveConfigs(proxies?: ProxyNode[]): Record<'mihomo' | 'stash', MergedConfig> {
  return Object.fromEntries(
    clients.map((client) => {
      const config = parseYaml(
        fs.readFileSync(path.join(root, 'dist', `${client}.yaml`), 'utf8'),
      ) as MergedConfig;
      if (proxies !== undefined) config.proxies = plain(proxies);
      return [client, config];
    }),
  ) as Record<'mihomo' | 'stash', MergedConfig>;
}

/**
 * 复制代理组并移除 Mihomo 独有的 oixCloud 差异，以比较两端共同定义及顺序。
 * @param {Object} config 含 proxy-groups 的客户端合并或最终配置。
 * @returns {Object[]} 去除独有组、其菜单引用和 oixCloud use 的代理组副本。
 */
function sharedGroups(config: MergedConfig): ProxyGroup[] {
  return plain(config['proxy-groups'])
    .filter(({ name }) => name !== '✈️ oixCloud Optimized')
    .map((group) => {
      if (group.proxies) {
        group.proxies = group.proxies.filter((name) => name !== '✈️ oixCloud Optimized');
      }
      if (group.use) {
        group.use = group.use.filter((name) => name !== 'oixCloud');
        if (!group.use.length) delete group.use;
      }
      return group;
    });
}

test('the local YAML parser resolves merge keys and rejects duplicate source keys', () => {
  const document = parseSourceYaml(`
defaults: &defaults
  interval: 60
  url: https://example.com/generate_204
group:
  <<: *defaults
  interval: 120
`) as { group: { interval: number; url: string } };
  assert.deepEqual(document.group, { interval: 120, url: 'https://example.com/generate_204' });
  assert.throws(() => parseSourceYaml('mode: rule\nmode: global\n'));
});

test('maps merge recursively, lists replace, fields delete, and sources stay untouched', () => {
  const base = fixture();
  const profile = {
    $profile: 'mihomo',
    dns: {
      nameserver: ['https://dns.example/dns-query'],
      'fake-ip-filter': { $delete: true },
    },
  };
  const originals = plain({ base, profile });
  const result = merge(base, profile);

  assert.deepEqual(plain(result.dns), {
    enable: true,
    nameserver: ['https://dns.example/dns-query'],
  });
  assert.equal('$base' in result, false);
  assert.equal('$profile' in result, false);
  assert.deepEqual({ base, profile }, originals);
  result['proxy-groups'][0].proxies!.push('DIRECT');
  assert.deepEqual({ base, profile }, originals, 'nested arrays must also be copied');
});

test('array edits apply remove, prepend, append, then insert-before in order', () => {
  const result = merge(fixture(), {
    $profile: 'stash',
    dns: {
      nameserver: {
        '$insert-before': { anchor: ['near-anchor'], last: ['near-last'] },
        $append: ['last'],
        $prepend: ['first'],
        $remove: ['remove'],
      },
    },
  });
  assert.deepEqual(plain((result.dns as FixtureConfig['dns']).nameserver), [
    'first',
    'near-anchor',
    'anchor',
    'keep',
    'near-last',
    'last',
  ]);
});

test('groups merge by name with stable positions, explicit placement, and deletion', () => {
  const result = merge(fixture(), {
    $profile: 'mihomo',
    'proxy-groups': [
      { name: 'Main', proxies: ['Airport'] },
      { name: 'Airport', type: 'url-test', interval: 60 },
      { name: 'Before', type: 'select', proxies: ['DIRECT'], $before: 'Airport' },
      { name: 'Tail', type: 'select', proxies: ['DIRECT'] },
      { name: 'After', type: 'select', proxies: ['DIRECT'], $after: 'Airport' },
      { name: 'Region', $delete: true },
    ],
  });
  const groups = plain(result['proxy-groups']);
  assert.deepEqual(
    groups.map(({ name }) => name),
    ['Main', 'Before', 'Airport', 'After', 'Tail'],
  );
  assert.deepEqual(groups[2], {
    name: 'Airport',
    type: 'url-test',
    proxies: ['DIRECT'],
    interval: 60,
  });
  assert.ok(groups.every((group) => !('$before' in group) && !('$after' in group)));
});

test('invalid array and group placement targets fail instead of changing precedence silently', () => {
  for (const patch of [
    { dns: { nameserver: { '$insert-before': { missing: ['first'] } } } },
    { dns: { nameserver: { $append: 'not-a-list' } } },
    { 'proxy-groups': [{ name: 'Airport', $before: 'Missing' }] },
    { 'proxy-groups': [{ name: 'Airport', $before: 'Main', $after: 'Region' }] },
  ]) {
    assert.throws(() => merge(fixture(), { $profile: 'mihomo', ...patch }));
  }
});

test('unsafe property names and unknown directives are rejected at nested paths', () => {
  for (const key of ['__proto__', 'constructor', 'prototype', '$apend']) {
    const profile: unknown = JSON.parse(`{"$profile":"mihomo","dns":{"${key}":{}}}`);
    assert.throws(() => merge(fixture(), profile), key);
  }
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
  assert.throws(() => merge({ ...fixture(), $unknown: true }, { $profile: 'mihomo' }));
});

test('duplicate group names and unresolved references fail final validation', () => {
  const duplicateBase = fixture();
  duplicateBase['proxy-groups'].push({ name: 'Airport', type: 'select', proxies: ['DIRECT'] });
  assert.throws(() => merge(duplicateBase, { $profile: 'mihomo' }));

  for (const patch of [
    { 'proxy-groups': [{ name: 'Airport' }, { name: 'Airport' }] },
    { 'proxy-groups': [{ name: 'Main', proxies: ['Missing'] }] },
    { 'proxy-groups': [{ name: 'Main', use: ['missing-provider'] }] },
    { 'proxy-groups': [{ name: 'Airport', $delete: true }] },
    { rules: ['RULE-SET,missing-provider,Main', 'MATCH,Main'] },
    { rules: ['MATCH,Missing'] },
  ]) {
    assert.throws(() => merge(fixture(), { $profile: 'mihomo', ...patch }));
  }
});

test('merge accepts explicitly declared runtime providers only as group use references', () => {
  const profile = {
    $profile: 'mihomo',
    'x-substore': { 'runtime-proxy-providers': ['runtime-subscription'] },
    'proxy-groups': [{ name: 'Main', use: ['subscription', 'runtime-subscription'] }],
  };
  const before = plain(profile);
  const result = merge(fixture(), profile);
  assert.deepEqual(result['x-substore'], profile['x-substore']);
  assert.deepEqual(result['proxy-groups'][0].use, ['subscription', 'runtime-subscription']);
  assert.equal(Object.hasOwn(result['proxy-providers']!, 'runtime-subscription'), false);
  assert.deepEqual(profile, before);

  for (const patch of [
    { 'proxy-groups': [{ name: 'Main', proxies: ['runtime-subscription'] }] },
    { rules: ['MATCH,runtime-subscription'] },
    { rules: ['RULE-SET,runtime-subscription,Main'] },
    { 'proxy-groups': [{ name: 'Main', use: ['runtime-subscriptino'] }] },
  ]) {
    assert.throws(() => merge(fixture(), { ...profile, ...patch }), /runtime-subscript/);
  }
  for (const name of ['oixCloud', 'runtime-subscription']) {
    assert.throws(
      () =>
        merge(fixture(), { $profile: 'mihomo', 'proxy-groups': [{ name: 'Main', use: [name] }] }),
      new RegExp(name),
    );
  }
});

test('merge validates runtime provider declarations without mutating either source', () => {
  for (const metadata of [
    null,
    [],
    'oixCloud',
    { 'runtime-proxy-provider': ['oixCloud'] },
    { 'runtime-proxy-providers': 'oixCloud' },
    { 'runtime-proxy-providers': [1] },
    { 'runtime-proxy-providers': [''] },
    { 'runtime-proxy-providers': ['  '] },
    { 'runtime-proxy-providers': ['oixCloud', 'oixCloud'] },
    { 'runtime-proxy-providers': ['subscription'] },
  ]) {
    const base = fixture();
    const profile = { $profile: 'mihomo', 'x-substore': metadata };
    const originals = plain({ base, profile });
    assert.throws(() => merge(base, profile), /x-substore|runtime-proxy-provider|subscription/);
    assert.deepEqual({ base, profile }, originals);
  }
  const result = merge(fixture(), {
    $profile: 'stash',
    'x-substore': { 'runtime-proxy-providers': [] },
  });
  assert.deepEqual(result['x-substore'], { 'runtime-proxy-providers': [] });
});

test('source markers are required and source templates cannot carry subscription nodes', () => {
  const base = fixture();
  delete base.$base;
  assert.throws(() => merge(base, { $profile: 'mihomo' }));
  assert.throws(() => merge(fixture(), {}));
  assert.throws(() => merge(fixture(), { $profile: 'other' }));
  assert.throws(() => merge({ ...fixture(), proxies: [] }, { $profile: 'mihomo' }));
  assert.throws(() => merge(fixture(), { $profile: 'mihomo', proxies: [] }));
});

test('merge resolves explicit injected members and copies nodes without mutating inputs', () => {
  const base = fixture();
  const profile = {
    $profile: 'mihomo',
    'proxy-groups': [{ name: 'Airport', proxies: ['Injected'] }],
  };
  const proxies = [{ name: 'Injected', type: 'ss', server: 'example.com' }];
  const originals = plain({ base, profile, proxies });
  const result = mergeConfigDocuments(base, profile, proxies);
  assert.deepEqual(result.proxies, proxies);
  assert.deepEqual(result['proxy-groups'][1].proxies, ['Injected']);
  result.proxies![0].name = 'Changed';
  assert.deepEqual({ base, profile, proxies }, originals);
  assert.throws(() => merge(base, profile), /Injected/);
});

test('built templates preserve source merge semantics without YAML merge-key support', () => {
  const base = parseSourceYaml(fs.readFileSync(path.join(root, 'src/configs/base.yaml'), 'utf8'));
  const built = liveConfigs();
  for (const client of clients) {
    const profile = parseSourceYaml(
      fs.readFileSync(path.join(root, 'src', 'configs', `${client}.yaml`), 'utf8'),
    );
    assert.deepEqual(
      built[client],
      mergeConfigDocuments(base, profile),
      `${client}: serialization must preserve resolved values, types and candidate order`,
    );
    assert.equal(Object.hasOwn(built[client], 'proxies'), false);
    assert.equal(Object.hasOwn(built[client], '$base'), false);
    assert.equal(Object.hasOwn(built[client], '$profile'), false);
  }
});

test('live profiles share group definitions and menu order except for the Mihomo managed provider', () => {
  const { mihomo, stash } = liveConfigs();
  assert.deepEqual(sharedGroups(stash), sharedGroups(mihomo));
  assert.equal(stash['proxy-providers'], undefined);
  assert.ok(stash['proxy-groups'].every((group) => !group.use?.length));
  assert.ok(
    stash['proxy-groups'].every(
      (group) =>
        group.name !== '✈️ oixCloud Optimized' && !group.proxies?.includes('✈️ oixCloud Optimized'),
    ),
  );
  assert.deepEqual(mihomo['proxy-providers'], {
    oixCloud: { type: 'file', path: './proxy_provider/oixCloud' },
  });
  assert.equal(mihomo['x-substore'], undefined);
  assert.equal(stash['x-substore'], undefined);
  const optimized = mihomo['proxy-groups'].find(({ name }) => name === '✈️ oixCloud Optimized')!;
  assert.equal(optimized.type, 'url-test');
  assert.equal(optimized.filter, '(IXP|CIA)');
  assert.deepEqual(optimized.use, ['oixCloud']);
  assert.equal(optimized.interval, 60);
  assert.equal(optimized.timeout, 5000);
  assert.equal(optimized.lazy, false);
  assert.equal(optimized.url, 'https://cp.cloudflare.com/generate_204');
  assert.equal(optimized['expected-status'], 204);
  assert.equal(optimized.tolerance, 100);
  assert.equal(optimized['max-failed-times'], 3);
  const mihomoMain = mihomo['proxy-groups'].find(({ name }) => name === '🚀 节点选择')!;
  assert.deepEqual(mihomoMain.use, ['oixCloud']);
  assert.equal(
    mihomoMain.proxies!.indexOf('✈️ oixCloud Optimized'),
    mihomoMain.proxies!.indexOf('✈️ VikingLinks') + 1,
  );

  const groups = new Map(sharedGroups(stash).map((group) => [group.name, group]));
  const airportMenu = [
    '✈️ VikingLinks',
    '✈️ oixCloud Edge',
    '✈️ 吹雪云',
    '✈️ 良心云',
    '✈️ 一元机场',
  ];
  const asiaRelays = [
    '✈️ VikingLinks 亚太',
    '✈️ 吹雪云 亚太',
    '✈️ 良心云 亚太',
    '✈️ VikingLinks',
    '✈️ 吹雪云',
    '✈️ 良心云',
    '✈️ 良心云 Hy2',
  ];
  assert.ok(!groups.has('🛡️ Edge 中转'));
  assert.deepEqual(groups.get('🛡️ 亚太中转')!.proxies, asiaRelays);
  assert.deepEqual(groups.get('🛡️ 美西中转')!.proxies, asiaRelays);
  assert.deepEqual(groups.get('🚀 节点选择')!.proxies, [
    '🏝️ 精品节点',
    '🇭🇰 香港节点',
    '🇺🇲 美国节点',
    '🇸🇬 狮城节点',
    '🇯🇵 日本节点',
    '🇼🇸 台湾节点',
    '🌍 其他节点',
    ...airportMenu.slice(0, -1),
    '✈️ 良心云 Hy2',
    '✈️ 一元机场',
  ]);
  assert.equal(groups.get('🚀 节点选择')!.url, 'https://cp.cloudflare.com/generate_204');
  assert.equal(groups.get('🏝️ 精品节点')!.filter, '(自建|合租)');
  for (const name of [
    '♊ Gemini',
    '💬 Ai平台',
    '🍎 Apple Push',
    '🎥 奈飞视频',
    '📹 油管视频',
    '📼 EMBY',
    '📲 电报消息',
    '🐙 Github',
    '🍎 Apple',
    'Ⓜ️ Microsoft',
    '📢 Google',
    '📺 国内媒体',
    '🌍 国外媒体',
    '🎮 游戏平台',
    '👛 Paypal',
    '💰 加密货币',
    '🐟 漏网之鱼',
  ]) {
    const menu = groups.get(name)!.proxies!;
    const hasDirectTail = ['🍎 Apple Push', '🌍 国外媒体'].includes(name);
    assert.deepEqual(
      menu.slice(-(airportMenu.length + Number(hasDirectTail))),
      hasDirectTail ? [...airportMenu, 'DIRECT'] : airportMenu,
      `${name}: airport menu order`,
    );
  }
  for (const [name, filter] of [
    ['✈️ oixCloud Edge', '(oixCloud Edge)'],
    ['✈️ 吹雪云', '(吹雪云)'],
    ['✈️ 一元机场', '(一元机场)'],
  ]) {
    assert.equal(groups.get(name)!.type, 'select');
    assert.equal(groups.get(name)!.filter, filter);
  }
});

test('the same injected nodes produce matching group members in both live profiles', () => {
  const proxies = [
    { name: 'oixCloud Edge HK', type: 'vless' },
    { name: '吹雪云 SG 电信', type: 'ss' },
    { name: '一元机场 JP', type: 'ss' },
    { name: '自建 US', type: 'vless' },
    { name: '合租 HK', type: 'vless' },
    { name: '家宽 US 落地线路', type: 'vless', 'dialer-proxy': '🛡️ 亚太中转' },
    { name: 'VikingLinks HK Go', type: 'ss' },
    { name: '良心云 HK CT', type: 'vless' },
    { name: '良心云 HK CT Hy2', type: 'hysteria2' },
  ];
  const { mihomo, stash } = liveConfigs(proxies);
  for (const config of [mihomo, stash]) {
    loadScript('dist/config-overwrite.js', { $arguments: {} }).main(config);
  }
  assert.deepEqual(sharedGroups(stash), sharedGroups(mihomo));
  for (const config of [mihomo, stash]) {
    assert.deepEqual(config.proxies, proxies);
    for (const [name, expected] of [
      ['✈️ oixCloud Edge', ['oixCloud Edge HK']],
      ['✈️ 吹雪云', ['吹雪云 SG 电信']],
      ['✈️ 一元机场', ['一元机场 JP']],
      ['🏝️ 精品节点', ['自建 US', '合租 HK']],
    ]) {
      assert.deepEqual(
        plain(config['proxy-groups'].find((group) => group.name === name)!.proxies),
        expected,
      );
    }
  }
  assert.equal(stash['proxy-providers'], undefined);
  assert.ok(stash['proxy-groups'].every((group) => !group.use?.length));
  assert.deepEqual(mihomo['proxy-providers'], {
    oixCloud: { type: 'file', path: './proxy_provider/oixCloud' },
  });
  assert.equal(mihomo['x-substore'], undefined);
  assert.equal(stash['x-substore'], undefined);
  assert.deepEqual(
    plain(mihomo['proxy-groups'].find(({ name }) => name === '✈️ oixCloud Optimized')!.use),
    ['oixCloud'],
  );
});

test('both built templates work with the existing airport and transit node filters', async () => {
  const proxies = [
    { name: '良心云 HK CT', type: 'vless' },
    { name: '良心云 SG CTCU', type: 'vless' },
    { name: '良心云 JP CTCUCM', type: 'VLESS' },
    { name: '良心云 TW CT', type: 'vless' },
    { name: '良心云 HK CT Hy2', type: 'hysteria2' },
    { name: '良心云 HK CM', type: 'vless' },
    { name: '良心云 US CT', type: 'vless' },
    { name: '良心云 HK CT 落地', type: 'vless', 'dialer-proxy': 'DIRECT' },
    { name: '吹雪云 HK 电信', type: 'ss' },
    { name: '吹雪云 SG 电信', type: 'vless' },
    { name: '吹雪云 JP 电信', type: 'trojan' },
    { name: '吹雪云 TW 电信', type: 'ss' },
    { name: '吹雪云 HK 移动', type: 'ss' },
    { name: '吹雪云 US 电信', type: 'ss' },
    { name: '吹雪云 HK 电信 落地', type: 'ss', 'dialer-proxy': 'DIRECT' },
    { name: 'VikingLinks HK Go', type: 'ss' },
    { name: 'VikingLinks SG IEPL', type: 'ss' },
    { name: 'VikingLinks JP SH', type: 'ss' },
    { name: 'VikingLinks TW SH', type: 'ss' },
    { name: 'VikingLinks HK Gomami', type: 'ss' },
    { name: 'VikingLinks JP 沪日', type: 'ss' },
    { name: 'VikingLinks US Go', type: 'ss' },
    { name: 'VikingLinks HK Go 落地', type: 'ss', 'dialer-proxy': 'DIRECT' },
  ];
  const expected = {
    '✈️ 良心云 亚太': proxies.slice(0, 4).map(({ name }) => name),
    '✈️ 吹雪云 亚太': proxies.slice(8, 12).map(({ name }) => name),
    '✈️ VikingLinks 亚太': proxies.slice(15, 19).map(({ name }) => name),
  };

  for (const client of clients) {
    const merged = liveConfigs(proxies)[client];
    const overwrite = loadScript('dist/config-overwrite.js', {
      $arguments: {},
    }).main;
    const result = overwrite(merged);
    for (const [name, members] of Object.entries(expected)) {
      const group = result['proxy-groups'].find((item) => item.name === name);
      assert.ok(group, `${client}: missing ${name}`);
      assert.equal(group.type, 'url-test');
      assert.equal(group.interval, 60);
      assert.deepEqual(plain(group.proxies), members, `${client}: ${name}`);
    }
    const firstMembers = plain(result['proxy-groups']);
    assert.deepEqual(
      plain(overwrite(liveConfigs(proxies)[client])['proxy-groups']),
      firstMembers,
      `${client}: regeneration from a fresh template must remain stable`,
    );
    assert.throws(() => overwrite(result), /x-substore/);
  }
});

test('built templates survive node injection and independently scoped Sub-Store overwrite', async () => {
  /**
   * 递归检查无循环的配置数据中是否残留来源、补丁指令或未展开的 YAML 合并键。
   * @param {*} value 待检查的配置值。
   * @returns {boolean} 发现构建期指令返回 true，否则返回 false。
   */
  const hasDirective = (value: unknown): boolean =>
    value !== null &&
    typeof value === 'object' &&
    Object.entries(value).some(
      ([key, child]) => key.startsWith('$') || key === '<<' || hasDirective(child),
    );
  const node = { name: '良心云 HK CT', type: 'vless', server: 'example.com', port: 443 };

  for (const client of clients) {
    for (const proxies of [undefined, [], [node]]) {
      const { context, outputs } = fileRuntime(client);
      const template = parseYaml(context.$content) as MergedConfig;
      assert.equal(Object.hasOwn(template, 'proxies'), false);
      assert.equal(hasDirective(template), false, 'build directives must not leak into templates');
      assert.ok(template['proxy-groups'].length > 0);
      assert.ok(
        template['proxy-groups'].every(
          (group) =>
            (group['x-substore'] as { members?: { mode?: unknown } } | undefined)?.members?.mode,
        ),
        'member policies must survive the build-time YAML serialization',
      );
      assert.equal(template['x-substore'], undefined);
      assert.deepEqual(
        template['proxy-providers'],
        client === 'mihomo'
          ? { oixCloud: { type: 'file', path: './proxy_provider/oixCloud' } }
          : undefined,
      );
      if (proxies !== undefined) {
        template.proxies = proxies;
        context.$content = stringify(template);
      }

      await runWrapped('dist/config-overwrite.js', context);
      assert.equal(context.main, undefined, 'overwrite main must stay in its script scope');
      assert.equal(context.compileGroupFilter, undefined);
      const result = parseYaml(context.$content) as MergedConfig;
      assert.equal(outputs.length, 1);
      assert.deepEqual(result.proxies ?? [], proxies ?? []);
      assert.equal(hasDirective(result), false);
      assert.equal(Object.hasOwn(result, 'x-substore'), false);
      assert.deepEqual(result['proxy-providers'], template['proxy-providers']);
      assert.ok(result['proxy-groups'].every((group) => !Object.hasOwn(group, 'x-substore')));
      assert.deepEqual(result.rules, template.rules);
      const airport = result['proxy-groups'].find(({ name }) => name === '✈️ 良心云 亚太')!;
      assert.deepEqual(
        airport.proxies,
        (proxies ?? []).map(({ name }) => name),
      );
      const serialized = context.$content;
      await assert.rejects(runWrapped('dist/config-overwrite.js', context), /x-substore/);
      assert.equal(context.$content, serialized, 'rejected overwrite must not replace the output');
      assert.equal(outputs.length, 1, 'rejected overwrite must not serialize another output');
    }
  }
});

test('final validation rejects invalid late-injected nodes before either client serializes output', async () => {
  const scenarios: { proxies: ProxyNode[]; pattern: RegExp; relay?: boolean }[] = [
    {
      proxies: [
        { name: '重复节点', type: 'ss' },
        { name: '重复节点', type: 'vless' },
      ],
      pattern: /重复节点/,
    },
    { proxies: [{ name: '🚀 节点选择', type: 'ss' }], pattern: /🚀 节点选择/ },
    { proxies: [{ name: 'DIRECT', type: 'ss' }], pattern: /DIRECT/ },
    {
      proxies: [{ name: '落地节点', type: 'ss', 'dialer-proxy': '不存在的中转' }],
      pattern: /不存在的中转/,
    },
    {
      proxies: [
        { name: '中转 A', type: 'ss', 'dialer-proxy': '中转 B' },
        { name: '中转 B', type: 'ss', 'dialer-proxy': '中转 A' },
      ],
      pattern: /中转 A.*中转 B.*中转 A|中转 B.*中转 A.*中转 B/,
    },
    {
      proxies: [{ name: '落地节点', type: 'ss', 'dialer-proxy': '自定义中转' }],
      pattern: /落地节点.*自定义中转.*落地节点|自定义中转.*落地节点.*自定义中转/,
      relay: true,
    },
    {
      proxies: [{ name: '良心云 HK CT 落地', type: 'vless', 'dialer-proxy': '🛡️ 亚太中转' }],
      pattern: /良心云 HK CT 落地.*🛡️ 亚太中转|🛡️ 亚太中转.*良心云 HK CT 落地/,
    },
  ];
  for (const client of clients) {
    for (const { proxies, pattern, relay } of scenarios) {
      const { context, outputs } = fileRuntime(client);
      const merged = parseYaml(context.$content) as MergedConfig;
      merged.proxies = proxies;
      if (relay) {
        merged['proxy-groups'].push({
          name: '自定义中转',
          type: 'select',
          proxies: ['落地节点'],
          'x-substore': { members: { mode: 'manual' } },
        });
      }
      context.$content = stringify(merged);
      context.$arguments = {};
      const before = context.$content;
      await assert.rejects(runWrapped('dist/config-overwrite.js', context), pattern);
      assert.equal(
        context.$content,
        before,
        `${client}: invalid output must not replace input YAML`,
      );
      assert.equal(
        outputs.length,
        0,
        `${client}: invalid output must not reach YAML serialization`,
      );
    }
  }
});

test('final validation accepts acyclic node and group dialer chains in both file runtimes', async () => {
  for (const client of clients) {
    const { context, outputs } = fileRuntime(client);
    const merged = parseYaml(context.$content) as MergedConfig;
    const proxies = [
      { name: '直连出口', type: 'ss', 'dialer-proxy': 'DIRECT' },
      { name: '中间节点', type: 'ss', 'dialer-proxy': '直连出口' },
      { name: '最终落地', type: 'vless', 'dialer-proxy': '自定义中转' },
    ];
    merged.proxies = proxies;
    merged['proxy-groups'].push({
      name: '自定义中转',
      type: 'select',
      proxies: ['中间节点', 'DIRECT'],
      'x-substore': { members: { mode: 'manual' } },
    });
    context.$content = stringify(merged);
    context.$arguments = {};
    await runWrapped('dist/config-overwrite.js', context);
    const result = parseYaml(context.$content) as MergedConfig;
    assert.deepEqual(result.proxies, proxies);
    assert.ok(result['proxy-groups'].every((group) => !Object.hasOwn(group, 'x-substore')));
    assert.deepEqual(result.rules, merged.rules);
    assert.equal(outputs.length, 1);
  }
});

test('final validation checks locally declared HTTP provider URLs in both file runtimes', async () => {
  for (const client of clients) {
    for (const field of ['proxy-providers', 'rule-providers']) {
      for (const url of [undefined, '', 'not-a-url', 'ftp://example.com/provider']) {
        const { context, outputs } = fileRuntime(client);
        const merged = parseYaml(context.$content) as MergedConfig;
        merged[field] = {
          ...(merged[field] as Record<string, unknown> | undefined),
          无效来源: { type: 'http', ...(url === undefined ? {} : { url }) },
        };
        context.$content = stringify(merged);
        context.$arguments = {};
        const before = context.$content;
        await assert.rejects(
          runWrapped('dist/config-overwrite.js', context),
          /无效来源.*url|url.*无效来源/i,
        );
        assert.equal(outputs.length, 0);
        assert.equal(context.$content, before);
      }
    }
  }
});

test('final validation rejects missing managed providers and invalid late provider references', async () => {
  const scenarios: { field: string; value: unknown; pattern: RegExp }[] = [
    { field: 'proxy-providers', value: undefined, pattern: /oixCloud/ },
    {
      field: 'proxy-providers',
      value: { oixCluod: { type: 'file', path: './proxy_provider/oixCloud' } },
      pattern: /oixCloud/,
    },
    {
      field: 'x-substore',
      value: { 'runtime-proxy-providers': ['oixCloud', 'oixCloud'] },
      pattern: /oixCloud/,
    },
    {
      field: 'x-substore',
      value: { 'runtime-proxy-providers': ['oixCloud'] },
      pattern: /oixCloud/,
    },
    {
      field: 'proxies',
      value: [{ name: '落地节点', type: 'ss', 'dialer-proxy': 'oixCloud' }],
      pattern: /oixCloud/,
    },
    { field: 'rules', value: ['RULE-SET,oixCloud,DIRECT'], pattern: /oixCloud/ },
  ];
  for (const { field, value, pattern } of scenarios) {
    const { context, outputs } = fileRuntime('mihomo');
    const merged = parseYaml(context.$content) as MergedConfig;
    if (value === undefined) delete merged[field];
    else merged[field] = value;
    context.$content = stringify(merged);
    context.$arguments = {};
    const before = context.$content;
    await assert.rejects(runWrapped('dist/config-overwrite.js', context), pattern);
    assert.equal(context.$content, before);
    assert.equal(outputs.length, 0, 'invalid runtime references must not reach serialization');
  }

  for (const client of clients) {
    const { context, outputs } = fileRuntime(client);
    const merged = parseYaml(context.$content) as MergedConfig;
    merged['proxy-groups'][0].use = ['missing-subscription'];
    context.$content = stringify(merged);
    const before = context.$content;
    await assert.rejects(runWrapped('dist/config-overwrite.js', context), /missing-subscription/);
    assert.equal(context.$content, before);
    assert.equal(outputs.length, 0);
  }
});

test('self-hosted SS dialers and renamed airport nodes preserve final grouping in both clients', async () => {
  const selfHostedSource = [
    { name: '自建 SG 落地', type: 'ss', _subName: '自建节点', server: 'sg.example.com' },
    { name: '自建 US 落地', type: 'SS', _subName: '自建节点', server: 'us.example.com' },
    { name: '自建 SG SS 直连', type: 'vless', _subName: '自建节点', server: 'direct.example.com' },
    {
      name: '自建 US 手动',
      type: 'hy2',
      _subName: '自建节点',
      server: 'manual.example.com',
      'dialer-proxy': 'DIRECT',
    },
  ];
  const airportSources = [
    [
      { name: 'HK', type: 'vless', _subName: 'oixCloud Edge', server: 'oix.example.com' },
      { name: '美国 US', type: 'vless', _subName: 'oixCloud Edge', server: 'oix-us.example.com' },
    ],
    [{ name: 'JP', type: 'ss', _subName: '一元机场', server: 'yiyuan.example.com' }],
  ];
  const directProxies = [
    { name: 'HK-Go-01-GCP', type: 'ss', _subName: 'VikingLinks', server: 'viking.example.com' },
    { name: 'HK CT', type: 'vless', _subName: '良心云', server: 'liangxin.example.com' },
    { name: 'SG CT', type: 'hysteria2', _subName: '良心云', server: 'hy2.example.com' },
    { name: 'JP 电信', type: 'ss', _subName: '吹雪云', server: 'chuixue.example.com' },
  ];
  const { operator: assignDialer } = loadScript('dist/dialer-proxy.js');
  const originalSelfHosted = structuredClone(selfHostedSource);
  const selfHosted = await assignDialer(selfHostedSource, 'ClashMeta', {});
  assert.deepEqual(
    plain(selfHosted.slice(2)),
    originalSelfHosted.slice(2),
    'non-SS self-hosted nodes retain all fields, including existing dialers',
  );
  const airports: ProxyNode[] = [...directProxies];
  for (const proxies of airportSources) {
    airports.push(...(await assignDialer(proxies, 'ClashMeta', {})));
  }
  const prepared = [...selfHosted, ...airports];
  const originalNames = new Map(prepared.map(({ server, name }) => [server, name]));
  const expectedDialers = new Map([
    ['sg.example.com', '🛡️ 亚太中转'],
    ['us.example.com', '🛡️ 美西中转'],
    ['manual.example.com', 'DIRECT'],
    ['oix.example.com', '🛡️ 亚太中转'],
    ['oix-us.example.com', '🛡️ 美西中转'],
    ['yiyuan.example.com', '🛡️ 亚太中转'],
  ]);
  const { operator: rename } = loadScript('dist/rename.js', {
    console: {
      /**
       * 丢弃重命名脚本的日志，保持节点中转集成测试的输出简洁。
       * @returns {void} 忽略所有日志输入，无返回值。
       */
      log() {},
    },
  });
  const proxies = plain([...selfHosted, ...(await rename(airports, 'ClashMeta', {}))]);
  assert.equal(proxies.length, prepared.length);
  for (const proxy of proxies) {
    if (proxy._subName === '自建节点') {
      assert.equal(proxy.name, originalNames.get(proxy.server), 'self-hosted names stay unchanged');
    } else {
      assert.notEqual(proxy.name, originalNames.get(proxy.server), 'airport nodes are renamed');
    }
    assert.equal(proxy['dialer-proxy'], expectedDialers.get(proxy.server!), proxy.server);
  }

  /**
   * 以稳定的服务器地址查找重命名后的节点，生成对应分组的期望成员。
   * @param {...string} servers 要匹配的服务器地址。
   * @returns {string[]} 按当前节点数组顺序排列的匹配节点名称。
   */
  const namesFor = (...servers: string[]): string[] =>
    proxies.filter(({ server }) => servers.includes(server!)).map(({ name }) => name);
  const relayGroups = ['🛡️ 亚太中转', '🛡️ 美西中转'];
  const dedicatedGroups = [
    '✈️ VikingLinks 亚太',
    '✈️ 良心云 亚太',
    '✈️ 吹雪云 亚太',
    '✈️ 良心云 Hy2',
  ];
  const configs = liveConfigs(proxies);
  for (const [client, config] of Object.entries(configs)) {
    const overwrite = loadScript('dist/config-overwrite.js', {
      $arguments: {},
    }).main;
    const originalRules = plain(config.rules);
    const originalGroups = new Map(
      config['proxy-groups'].map(({ name, proxies = [] }) => [name, plain(proxies)]),
    );
    overwrite(config);
    const groups = new Map(config['proxy-groups'].map((group) => [group.name, group]));
    assert.deepEqual(config.proxies, proxies, `${client}: injected nodes remain intact`);
    assert.deepEqual(config.rules, originalRules, `${client}: rule priority remains intact`);
    for (const [name, originalMembers] of originalGroups) {
      assert.deepEqual(
        plain(groups.get(name)!.proxies!.slice(0, originalMembers.length)),
        originalMembers,
        `${client}: ${name} retains its configured candidate order`,
      );
    }
    for (const proxy of proxies) {
      if (proxy['dialer-proxy']) {
        assert.ok(
          proxy['dialer-proxy'] === 'DIRECT' || groups.has(proxy['dialer-proxy']),
          `${client}: ${proxy.name} has a valid relay`,
        );
        for (const name of [...relayGroups, ...dedicatedGroups]) {
          assert.ok(!groups.get(name)!.proxies!.includes(proxy.name), `${client}: ${name}`);
        }
      } else {
        for (const name of relayGroups) {
          assert.ok(groups.get(name)!.proxies!.includes(proxy.name), `${client}: ${name}`);
        }
      }
    }
    for (const [name, servers] of [
      [
        '🏝️ 精品节点',
        ['sg.example.com', 'us.example.com', 'direct.example.com', 'manual.example.com'],
      ],
      ['✈️ oixCloud Edge', ['oix.example.com', 'oix-us.example.com']],
      ['✈️ 一元机场', ['yiyuan.example.com']],
      ['✈️ VikingLinks 亚太', ['viking.example.com']],
      ['✈️ 良心云 亚太', ['liangxin.example.com']],
      ['✈️ 吹雪云 亚太', ['chuixue.example.com']],
      ['✈️ 良心云 Hy2', ['hy2.example.com']],
    ] as [string, string[]][]) {
      assert.deepEqual(
        plain(groups.get(name)!.proxies),
        namesFor(...servers),
        `${client}: ${name}`,
      );
    }
  }
  assert.deepEqual(sharedGroups(configs.stash), sharedGroups(configs.mihomo));
});
