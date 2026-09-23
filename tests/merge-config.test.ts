/**
 * @file 验证配置合并、远程读取与 Sub-Store 发布脚本的集成行为。
 * 覆盖补丁与引用校验，并检查 Mihomo 和 Stash 注入节点后的最终分组及候选顺序。
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { parse, stringify } from 'yaml';
import { mergeConfigDocuments } from '../src/merge-config/index.ts';
import type {
  HttpRequest,
  HttpResponse,
  MergedConfig,
  ProxyConfig,
  ProxyGroup,
  ProxyNode,
  ScriptArguments,
} from '../src/types.ts';

interface PublishedScripts {
  'scripts/merge-config.js': typeof import('../src/entries/merge-config.ts');
  'scripts/config-overwrite.js': typeof import('../src/entries/config-overwrite.ts');
  'scripts/dialer-proxy.js': typeof import('../src/entries/dialer-proxy.ts');
  'scripts/rename.js': typeof import('../src/entries/rename.ts');
}
type MergeMain = PublishedScripts['scripts/merge-config.js']['main'];
interface FileRuntime {
  $content: string;
  $arguments: ScriptArguments;
  main?: unknown;
  mergeConfigDocuments?: unknown;
  compileGroupFilter?: unknown;
}
type HttpResponder = (request: HttpRequest) => HttpResponse | Promise<HttpResponse>;
interface FixtureConfig extends MergedConfig {
  $base?: boolean;
  dns: { enable: boolean; nameserver: string[]; 'fake-ip-filter'?: string[] };
  'proxy-groups': (ProxyGroup & { proxies: string[] })[];
}

const root = fileURLToPath(new URL('..', import.meta.url));
const defaultConfigUrl = 'https://raw.githubusercontent.com/chiyuchia/proxy-config/master/configs';

/**
 * 按 Sub-Store 的解析约定读取 YAML，支持合并键并拒绝重复键。
 * @param {string} source 待解析的 YAML 或兼容的 JSON 文本。
 * @returns {*} 解析后的文档值，空文档返回解析器对应的空值。
 * @throws {Error} 文本语法错误或存在重复键时抛出。
 */
function parseYaml(source: string): unknown {
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
 * 创建文件脚本运行环境，读取真实模板并记录 YAML 输出及配置下载请求。
 * 不注入 Node.js 或 URL 全局对象，以检查发布脚本不依赖本地运行时能力。
 * @param {string} client 待合并的客户端名称。
 * @param {Object} [args={}] 额外的合并脚本参数，client 始终以第一个参数为准。
 * @returns {Object} 独立 VM、已序列化的配置列表及已请求的模板地址。
 */
function fileRuntime(
  client: string,
  args: ScriptArguments = {},
): {
  context: FileRuntime;
  outputs: unknown[];
  requests: string[];
} {
  const outputs: unknown[] = [];
  const requests: string[] = [];
  const context = vm.createContext({
    console,
    $content: '{}',
    $arguments: { ...args, client },
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
    $substore: {
      http: {
        /**
         * 按请求地址读取本地模板，记录请求并模拟异步 HTTP 成功响应。
         * @param {Object} request 包含模板 URL 的请求对象。
         * @returns {Promise<Object>} 带 YAML 内容的 HTTP 响应。
         * @throws {Error} 地址无效或模板不存在时使 Promise 拒绝。
         */
        async get({ url }: HttpRequest): Promise<HttpResponse> {
          requests.push(url);
          return {
            statusCode: 200,
            body: fs.readFileSync(
              path.join(root, 'configs', path.basename(new URL(url).pathname)),
              'utf8',
            ),
          };
        },
      },
    },
  }) as unknown as FileRuntime;
  return { context, outputs, requests };
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
 * 构建配置合并脚本的模拟运行时，注入参数、YAML 解析器及可控 HTTP 响应。
 * @param {Object} args 传给发布脚本的 Sub-Store 参数。
 * @param {Function} responder 接收请求对象、返回响应或响应 Promise 的模拟处理函数。
 * @returns {{calls: Object[], main: Function}} 请求记录及已加载的异步配置合并入口。
 */
function runtime(
  args: ScriptArguments,
  responder: HttpResponder,
): { calls: HttpRequest[]; main: MergeMain } {
  const calls: HttpRequest[] = [];
  const context = loadScript('scripts/merge-config.js', {
    $arguments: args,
    ProxyUtils: { yaml: { safeLoad: parseYaml } },
    $substore: {
      http: {
        /**
         * 记录 HTTP 请求并转交模拟响应函数，不访问真实远端。
         * @param {Object} request 合并脚本发出的 URL、超时等请求参数。
         * @returns {Promise<Object>} 模拟处理函数提供的 HTTP 响应。
         * @throws {Error} 模拟处理函数抛错或拒绝时向调用者传播。
         */
        get: async (request: HttpRequest): Promise<HttpResponse> => {
          calls.push(request);
          return responder(request);
        },
      },
    },
  });
  return { calls, main: context.main };
}

/**
 * 创建按 URL 文件名选择公共配置或客户端差异的成功响应函数。
 * @param {Object} base 请求 base.yaml 时返回的公共配置。
 * @param {Object} profile 其他请求返回的客户端差异配置。
 * @returns {Function} 接收含 url 的请求对象并返回 HTTP 响应对象的函数。
 */
function respondWith(base: unknown, profile: unknown): (request: HttpRequest) => HttpResponse {
  /**
   * 将选定配置编码为 JSON 响应体，供兼容 JSON 的 YAML 解析器读取。
   * @param {{url: string}} request 请求对象，解构后的 url 用于选择配置。
   * @returns {{statusCode: number, body: string}} 状态码为 200 的模拟 HTTP 响应。
   */
  return ({ url }: HttpRequest): HttpResponse => ({
    statusCode: 200,
    body: JSON.stringify(new URL(url).pathname.endsWith('/base.yaml') ? base : profile),
  });
}

/**
 * 读取仓库真实 YAML 模板，为同一批注入节点生成两个客户端的合并配置。
 * @param {Object[]} [proxies] 用于引用校验及配置输出的可选注入节点。
 * @returns {{mihomo: Object, stash: Object}} 转为普通对象的两端合并结果。
 * @throws {Error} 模板读取、解析或合并校验失败时抛出。
 */
function liveConfigs(proxies?: ProxyNode[]): Record<'mihomo' | 'stash', MergedConfig> {
  /**
   * 读取并解析 configs 目录中的指定 YAML 模板。
   * @param {string} name 不含扩展名的配置文件名。
   * @returns {Object} 解析后的公共或客户端配置。
   */
  const read = (name: string): unknown =>
    parseYaml(fs.readFileSync(path.join(root, 'configs', `${name}.yaml`), 'utf8'));
  const base = read('base');
  return Object.fromEntries(
    ['mihomo', 'stash'].map((client) => [
      client,
      plain(mergeConfigDocuments(base, read(client), proxies)),
    ]),
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
  const document = parseYaml(`
defaults: &defaults
  interval: 60
  url: https://example.com/generate_204
group:
  <<: *defaults
  interval: 120
`) as { group: { interval: number; url: string } };
  assert.deepEqual(document.group, { interval: 120, url: 'https://example.com/generate_204' });
  assert.throws(() => parseYaml('mode: rule\nmode: global\n'));
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

test('main selects the requested profile and preserves only injected proxies from input', async () => {
  for (const client of ['mihomo', 'stash']) {
    const input = {
      proxies: [{ name: 'subscription-node', type: 'vless', server: 'example.com', port: 443 }],
      dns: { enable: false },
      rules: ['MATCH,REJECT'],
      'proxy-groups': [{ name: 'stale-group' }],
      'stale-key': true,
    };
    const before = plain(input);
    const { main, calls } = runtime({ client }, respondWith(fixture(), { $profile: client }));
    const result = await main(input);
    assert.deepEqual(
      calls.map(({ url }) => url.split('?')[0]).sort(),
      [`${defaultConfigUrl}/base.yaml`, `${defaultConfigUrl}/${client}.yaml`].sort(),
    );
    for (const { url, headers } of calls) {
      assert.ok(new URL(url).searchParams.get('_substore_refresh'));
      assert.deepEqual(plain(headers), { 'Cache-Control': 'no-cache' });
    }
    assert.deepEqual(plain(result.proxies), input.proxies);
    assert.equal((result.dns as FixtureConfig['dns']).enable, true);
    assert.equal('stale-key' in result, false);
    assert.deepEqual(plain(result.rules), fixture().rules);
    assert.deepEqual(input, before, 'the incoming config should not be mutated');
  }
});

test('main supports source URL overrides and passes the configured timeout to HTTP', async () => {
  const { main, calls } = runtime(
    {
      client: 'stash',
      configBaseUrl: 'https://config.example/configs/',
      baseUrl: 'https://override.example/base.yaml',
      profileUrl: 'https://override.example/stash.yaml',
      timeout: '12345',
    },
    respondWith(fixture(), { $profile: 'stash' }),
  );
  await main({ proxies: [] });
  assert.deepEqual(calls.map(({ url }) => url).sort(), [
    'https://override.example/base.yaml',
    'https://override.example/stash.yaml',
  ]);
  assert.ok(calls.every(({ timeout }) => timeout === 12345));
  for (const { headers } of calls) {
    assert.deepEqual(plain(headers), { 'Cache-Control': 'no-cache' });
  }

  const custom = runtime(
    { client: 'mihomo', configBaseUrl: 'https://config.example/configs/' },
    respondWith(fixture(), { $profile: 'mihomo' }),
  );
  await custom.main({ proxies: [] });
  assert.deepEqual(custom.calls.map(({ url }) => url).sort(), [
    'https://config.example/configs/base.yaml',
    'https://config.example/configs/mihomo.yaml',
  ]);
  for (const { headers } of custom.calls) {
    assert.deepEqual(plain(headers), { 'Cache-Control': 'no-cache' });
  }
});

test('explicit false cache flags preserve source URLs and omit cache request headers', async () => {
  const baseUrl = `${defaultConfigUrl}/base.yaml?token=a%2Fb+z&_substore_refresh=existing#part`;
  const profileUrl = `${defaultConfigUrl}/mihomo.yaml?flag&empty=#profile`;
  for (const noCache of [false, 'false']) {
    const { main, calls } = runtime(
      { client: 'mihomo', noCache, baseUrl, profileUrl },
      respondWith(fixture(), { $profile: 'mihomo' }),
    );
    await main({});
    assert.deepEqual(calls.map(({ url }) => url).sort(), [baseUrl, profileUrl].sort());
    assert.ok(calls.every((request) => !Object.hasOwn(request, 'headers')));
  }
});

test('default and explicit cache refresh apply to both GitHub templates and change on each merge', async () => {
  for (const args of [{}, { noCache: undefined }, { noCache: true }, { noCache: 'true' }]) {
    const { main, calls } = runtime(
      { client: 'mihomo', ...args },
      respondWith(fixture(), { $profile: 'mihomo' }),
    );
    const tokens: string[] = [];
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await main({});
      const currentCalls = calls.slice(attempt * 2);
      assert.equal(currentCalls.length, 2);
      assert.deepEqual(
        currentCalls.map(({ url }) => url.split('?')[0]).sort(),
        [`${defaultConfigUrl}/base.yaml`, `${defaultConfigUrl}/mihomo.yaml`].sort(),
      );
      const currentTokens = currentCalls.map(({ url, headers }) => {
        assert.deepEqual(plain(headers), { 'Cache-Control': 'no-cache' });
        const values = new URL(url).searchParams.getAll('_substore_refresh');
        assert.equal(values.length, 1);
        assert.ok(values[0]);
        return values[0];
      });
      assert.equal(currentTokens[0], currentTokens[1]);
      tokens.push(currentTokens[0]);
    }
    assert.notEqual(tokens[0], tokens[1], 'each merge must use a fresh cache key');
  }
});

test('GitHub source overrides retain query bytes and fragments while replacing refresh parameters', async () => {
  const sources = [
    'http://raw.githubusercontent.com/example/config/main/base.yaml',
    'https://raw.githubusercontent.com/example/config/main/mihomo.yaml',
  ];
  const query = 'signature=a%2Fb+z&empty=&flag&_substore_refresh=old&x=%2f&_substore_refresh=older';
  const { main, calls } = runtime(
    {
      client: 'mihomo',
      noCache: true,
      baseUrl: `${sources[0]}?${query}#base-fragment`,
      profileUrl: `${sources[1]}?${query}#profile-fragment`,
    },
    respondWith(fixture(), { $profile: 'mihomo' }),
  );
  await main({});
  assert.equal(calls.length, 2);
  const tokens: string[] = [];
  for (const { url, headers } of calls) {
    const parsed = new URL(url);
    assert.ok(sources.includes(url.split('?')[0]));
    assert.equal(
      parsed.hash,
      parsed.pathname.endsWith('/base.yaml') ? '#base-fragment' : '#profile-fragment',
    );
    assert.deepEqual(
      url
        .slice(url.indexOf('?') + 1, url.indexOf('#'))
        .split('&')
        .filter((part) => !part.startsWith('_substore_refresh=')),
      ['signature=a%2Fb+z', 'empty=', 'flag', 'x=%2f'],
    );
    const values = parsed.searchParams.getAll('_substore_refresh');
    assert.equal(values.length, 1);
    assert.ok(values[0]);
    assert.notEqual(values[0], 'old');
    assert.notEqual(values[0], 'older');
    tokens.push(values[0]);
    assert.deepEqual(plain(headers), { 'Cache-Control': 'no-cache' });
  }
  assert.equal(tokens[0], tokens[1]);
});

test('custom source URLs preserve signed queries and only receive cache headers', async () => {
  for (const origin of [
    'https://signed.example',
    'https://raw.githubusercontent.com.example',
    'https://raw.githubusercontent.com@custom.example',
  ]) {
    const suffix = '?signature=a%2Fb+z&_substore_refresh=signed&empty=&flag#signed-fragment';
    const baseUrl = `${origin}/base.yaml${suffix}`;
    const profileUrl = `${origin}/mihomo.yaml${suffix}`;
    const { main, calls } = runtime(
      { client: 'mihomo', noCache: true, baseUrl, profileUrl },
      respondWith(fixture(), { $profile: 'mihomo' }),
    );
    await main({});
    assert.deepEqual(calls.map(({ url }) => url).sort(), [baseUrl, profileUrl].sort());
    for (const request of calls) {
      assert.deepEqual(plain(request.headers), { 'Cache-Control': 'no-cache' });
    }
  }
});

test('invalid cache flags are rejected before either template is downloaded', async () => {
  for (const noCache of [null, 0, 1, '', 'yes', 'TRUE', ' true ', [], {}]) {
    const { main, calls } = runtime({ client: 'mihomo', noCache }, () => {
      throw new Error('must not request');
    });
    await assert.rejects(() => main({}), /\[merge-config\].*noCache/);
    assert.equal(calls.length, 0);
  }
});

test('main resolves explicit group members against the nodes injected by Sub-Store', async () => {
  const profile = {
    $profile: 'mihomo',
    'proxy-groups': [{ name: 'Main', proxies: ['subscription-node'] }],
  };
  const { main } = runtime({ client: 'mihomo' }, respondWith(fixture(), profile));
  const node = { name: 'subscription-node', type: 'vless', server: 'example.com', port: 443 };
  const result = await main({ proxies: [node] });
  assert.deepEqual(plain(result['proxy-groups'][0].proxies), ['subscription-node']);
  assert.deepEqual(plain(result.proxies), [node]);
  await assert.rejects(() => main({ proxies: [] }));
});

test('missing or unsupported client is rejected before downloading', async () => {
  for (const args of [{}, { client: 'other' }]) {
    const { main, calls } = runtime(args, () => {
      throw new Error('must not request');
    });
    await assert.rejects(() => main({ proxies: [] }));
    assert.equal(calls.length, 0);
  }
});

test('invalid timeout and shared source URL parameters are rejected before downloading', async () => {
  for (const options of [
    ...[0, -1, '', 'invalid', Infinity].map((timeout) => ({ timeout })),
    { configBaseUrl: 42 },
    { configBaseUrl: 'file:///tmp/configs' },
  ]) {
    const { main, calls } = runtime({ client: 'mihomo', ...options }, () => {
      throw new Error('must not request');
    });
    await assert.rejects(() => main({ proxies: [] }), /\[merge-config\]/);
    assert.equal(calls.length, 0);
  }
});

test('failed downloads and invalid YAML are rejected without returning fallback configuration', async () => {
  for (const badResponse of [
    { statusCode: 503, body: JSON.stringify(fixture()) },
    { statusCode: 200, body: '' },
    { statusCode: 200, body: '   \n' },
    { statusCode: 200, body: 'dns: [unterminated' },
    { statusCode: 200, body: '$base: true\nmode: rule\nmode: global\n' },
    { statusCode: 200, body: '<html>not a configuration</html>' },
  ]) {
    const good = respondWith(fixture(), { $profile: 'mihomo' });
    const { main } = runtime({ client: 'mihomo' }, (request) =>
      new URL(request.url).pathname.endsWith('/base.yaml') ? badResponse : good(request),
    );
    await assert.rejects(() => main({ proxies: [] }));
  }

  const failed = runtime({ client: 'mihomo' }, () => {
    throw new Error('request timed out');
  });
  await assert.rejects(() => failed.main({ proxies: [] }), /timed out/);
  const mismatched = runtime({ client: 'mihomo' }, respondWith(fixture(), { $profile: 'stash' }));
  await assert.rejects(() => mismatched.main({ proxies: [] }));
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
    loadScript('scripts/config-overwrite.js', { $arguments: {} }).main(config);
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

test('both live source profiles work with the existing airport and transit node filters', async () => {
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

  for (const client of ['mihomo', 'stash']) {
    const { main } = runtime({ client }, ({ url }) => ({
      statusCode: 200,
      body: fs.readFileSync(
        path.join(root, 'configs', path.basename(new URL(url).pathname)),
        'utf8',
      ),
    }));
    const merged = await main({ proxies: plain(proxies) });
    const overwrite = loadScript('scripts/config-overwrite.js', {
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
      plain(overwrite(await main({ proxies: plain(proxies) }))['proxy-groups']),
      firstMembers,
      `${client}: regeneration from a fresh template must remain stable`,
    );
    assert.throws(() => overwrite(result), /x-substore/);
  }
});

test('Mihomo file wrappers await merge and serialize each independently scoped script', async () => {
  /**
   * 递归检查无循环的配置数据中是否仍有以 $ 开头的来源或补丁指令。
   * @param {*} value 待检查的配置值。
   * @returns {*} 发现指令返回 true；未发现返回 false，假值输入原样返回。
   */
  const hasDirective = (value: unknown): unknown =>
    value &&
    typeof value === 'object' &&
    Object.entries(value).some(([key, child]) => key.startsWith('$') || hasDirective(child));
  const node = { name: '良心云 HK CT', type: 'vless', server: 'example.com', port: 443 };

  for (const client of ['mihomo', 'stash']) {
    for (const { input, injected } of [
      { input: {} },
      { input: { proxies: [node] } },
      { input: {}, injected: [node] },
    ] as { input: ProxyConfig; injected?: ProxyNode[] }[]) {
      let dumpCount = 0;
      const requests: string[] = [];
      const context = vm.createContext({
        console,
        $content: stringify(input),
        $arguments: { client },
        ProxyUtils: {
          yaml: {
            safeLoad: parseYaml,
            /**
             * 断言传入的是已等待完成的配置，记录序列化次数并生成 YAML。
             * @param {*} value 待序列化的配置对象，不应是 Promise。
             * @returns {string} 序列化后的 YAML 文本。
             * @throws {Error} 收到 Promise 或 YAML 序列化失败时抛出。
             */
            safeDump: (value: unknown): string => {
              assert.notEqual(
                Object.prototype.toString.call(value),
                '[object Promise]',
                'the wrapper must await async main before serializing',
              );
              dumpCount += 1;
              return stringify(value);
            },
          },
        },
        $substore: {
          http: {
            /**
             * 记录请求并异步读取同名本地模板，模拟成功的远程 YAML 下载。
             * @param {{url: string}} request 请求对象，使用解构出的 URL 定位配置文件。
             * @returns {Promise<{statusCode: number, body: string}>} 含模板文本的成功响应。
             * @throws {Error} URL 无效或本地模板读取失败时使 Promise 拒绝。
             */
            get: async ({ url }: HttpRequest): Promise<HttpResponse> => {
              requests.push(url);
              await Promise.resolve();
              return {
                statusCode: 200,
                body: fs.readFileSync(
                  path.join(root, 'configs', path.basename(new URL(url).pathname)),
                  'utf8',
                ),
              };
            },
          },
        },
      }) as unknown as FileRuntime;

      await runWrapped('scripts/merge-config.js', context);
      assert.equal(context.main, undefined, 'merge main must stay in its script scope');
      assert.equal(context.mergeConfigDocuments, undefined);
      const merged = parseYaml(context.$content) as MergedConfig;
      assert.equal(hasDirective(merged), false, 'source markers and patch operators must not leak');
      assert.deepEqual(merged.proxies ?? [], input.proxies ?? []);
      assert.ok(merged['proxy-groups'].length > 0);
      assert.ok(
        merged['proxy-groups'].every(
          (group) =>
            (group['x-substore'] as { members?: { mode?: unknown } } | undefined)?.members?.mode,
        ),
        'member policies must survive serialization between independent scripts',
      );
      assert.equal(merged['x-substore'], undefined);
      assert.deepEqual(
        merged['proxy-providers'],
        client === 'mihomo'
          ? { oixCloud: { type: 'file', path: './proxy_provider/oixCloud' } }
          : undefined,
        'the managed provider declaration must survive serialization between independent scripts',
      );
      if (injected) {
        merged.proxies = injected;
        context.$content = stringify(merged);
      }
      const expectedProxies = injected ?? input.proxies ?? [];

      context.$arguments = {};
      await runWrapped('scripts/config-overwrite.js', context);
      assert.equal(context.main, undefined, 'overwrite main must also stay in its script scope');
      assert.equal(context.compileGroupFilter, undefined);
      const result = parseYaml(context.$content) as MergedConfig;
      assert.equal(dumpCount, 2);
      assert.equal(requests.length, 2);
      assert.deepEqual(result.proxies ?? [], expectedProxies);
      assert.equal(hasDirective(result), false);
      assert.equal(Object.hasOwn(result, 'x-substore'), false);
      assert.deepEqual(result['proxy-providers'], merged['proxy-providers']);
      assert.ok(result['proxy-groups'].every((group) => !Object.hasOwn(group, 'x-substore')));
      assert.deepEqual(result.rules, merged.rules);
      const airport = result['proxy-groups'].find(({ name }) => name === '✈️ 良心云 亚太')!;
      assert.deepEqual(
        airport.proxies,
        expectedProxies.map(({ name }) => name),
      );
      const serialized = context.$content;
      await assert.rejects(runWrapped('scripts/config-overwrite.js', context), /x-substore/);
      assert.equal(context.$content, serialized, 'rejected overwrite must not replace the output');
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
  for (const client of ['mihomo', 'stash']) {
    for (const { proxies, pattern, relay } of scenarios) {
      const { context, outputs, requests } = fileRuntime(client);
      await runWrapped('scripts/merge-config.js', context);
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
      await assert.rejects(runWrapped('scripts/config-overwrite.js', context), pattern);
      assert.equal(
        context.$content,
        before,
        `${client}: invalid output must not replace input YAML`,
      );
      assert.equal(
        outputs.length,
        1,
        `${client}: invalid output must not reach YAML serialization`,
      );
      assert.equal(
        requests.length,
        2,
        `${client}: final validation must not make network requests`,
      );
    }
  }
});

test('final validation accepts acyclic node and group dialer chains in both file runtimes', async () => {
  for (const client of ['mihomo', 'stash']) {
    const { context, outputs, requests } = fileRuntime(client);
    await runWrapped('scripts/merge-config.js', context);
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
    await runWrapped('scripts/config-overwrite.js', context);
    const result = parseYaml(context.$content) as MergedConfig;
    assert.deepEqual(result.proxies, proxies);
    assert.ok(result['proxy-groups'].every((group) => !Object.hasOwn(group, 'x-substore')));
    assert.deepEqual(result.rules, merged.rules);
    assert.equal(outputs.length, 2);
    assert.equal(requests.length, 2, 'only the two source templates should be downloaded');
  }
});

test('final validation checks locally declared HTTP provider URLs in both file runtimes', async () => {
  for (const client of ['mihomo', 'stash']) {
    for (const field of ['proxy-providers', 'rule-providers']) {
      for (const url of [undefined, '', 'not-a-url', 'ftp://example.com/provider']) {
        const { context, outputs } = fileRuntime(client);
        await runWrapped('scripts/merge-config.js', context);
        const merged = parseYaml(context.$content) as MergedConfig;
        merged[field] = {
          ...(merged[field] as Record<string, unknown> | undefined),
          无效来源: { type: 'http', ...(url === undefined ? {} : { url }) },
        };
        context.$content = stringify(merged);
        context.$arguments = {};
        const before = context.$content;
        await assert.rejects(
          runWrapped('scripts/config-overwrite.js', context),
          /无效来源.*url|url.*无效来源/i,
        );
        assert.equal(outputs.length, 1);
        assert.equal(context.$content, before);
      }
    }
  }
});

test('cache refresh preserves final providers and injected group members in both file runtimes', async () => {
  const node = { name: '良心云 HK CT', type: 'vless', server: 'example.com', port: 443 };
  for (const client of ['mihomo', 'stash']) {
    const results: MergedConfig[] = [];
    for (const args of [{}, { noCache: false }, { noCache: true }]) {
      const { context, outputs, requests } = fileRuntime(client, args);
      context.$content = stringify({ proxies: [node] });
      await runWrapped('scripts/merge-config.js', context);
      context.$arguments = {};
      await runWrapped('scripts/config-overwrite.js', context);
      const result = parseYaml(context.$content) as MergedConfig;
      results.push(result);
      assert.deepEqual(
        result['proxy-providers'],
        client === 'mihomo'
          ? { oixCloud: { type: 'file', path: './proxy_provider/oixCloud' } }
          : undefined,
      );
      assert.equal(
        result['proxy-groups'].some((group) => group.use?.includes('oixCloud')),
        client === 'mihomo',
      );
      assert.deepEqual(
        result['proxy-groups'].find(({ name }) => name === '✈️ 良心云 亚太')!.proxies,
        [node.name],
      );
      assert.equal(outputs.length, 2);
      assert.equal(requests.length, 2);
    }
    for (const result of results.slice(1)) {
      assert.deepEqual(result, results[0], `${client}: refresh must only change download requests`);
    }
  }
});

test('file output preserves the managed file provider and ignores retired URL parameters', async () => {
  for (const client of ['mihomo', 'stash']) {
    for (const args of [
      {},
      { oixCloudEdgePath: 'https://example.com/oixcloud' },
      { oixCloudEdgePath: 'not-a-url' },
    ]) {
      const { context, outputs, requests } = fileRuntime(client);
      await runWrapped('scripts/merge-config.js', context);
      const merged = parseYaml(context.$content) as MergedConfig;
      assert.deepEqual(
        merged['proxy-providers'],
        client === 'mihomo'
          ? { oixCloud: { type: 'file', path: './proxy_provider/oixCloud' } }
          : undefined,
      );
      context.$arguments = args;
      await runWrapped('scripts/config-overwrite.js', context);
      const result = parseYaml(context.$content) as MergedConfig;
      assert.deepEqual(result['proxy-providers'], merged['proxy-providers']);
      assert.equal(Object.hasOwn(result, 'x-substore'), false);
      assert.equal(
        result['proxy-groups'].some((group) => group.use?.includes('oixCloud')),
        client === 'mihomo',
      );
      assert.equal(outputs.length, 2);
      assert.equal(requests.length, 2, 'runtime provider contents are not fetched in Sub-Store');
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
    const { context, outputs, requests } = fileRuntime('mihomo');
    await runWrapped('scripts/merge-config.js', context);
    const merged = parseYaml(context.$content) as MergedConfig;
    if (value === undefined) delete merged[field];
    else merged[field] = value;
    context.$content = stringify(merged);
    context.$arguments = {};
    const before = context.$content;
    await assert.rejects(runWrapped('scripts/config-overwrite.js', context), pattern);
    assert.equal(context.$content, before);
    assert.equal(outputs.length, 1, 'invalid runtime references must not reach serialization');
    assert.equal(requests.length, 2);
  }

  for (const client of ['mihomo', 'stash']) {
    const { context, outputs } = fileRuntime(client);
    await runWrapped('scripts/merge-config.js', context);
    const merged = parseYaml(context.$content) as MergedConfig;
    merged['proxy-groups'][0].use = ['missing-subscription'];
    context.$content = stringify(merged);
    const before = context.$content;
    await assert.rejects(
      runWrapped('scripts/config-overwrite.js', context),
      /missing-subscription/,
    );
    assert.equal(context.$content, before);
    assert.equal(outputs.length, 1);
  }
});

test('regional dialers and renamed airport nodes preserve final grouping in both clients', async () => {
  const selfHostedSource = [
    { name: '自建 SG 落地', type: 'vless', _subName: '自建', server: 'sg.example.com' },
    { name: '自建 US 落地', type: 'vless', _subName: '自建', server: 'us.example.com' },
    { name: '自建 SG 直连', type: 'vless', _subName: '自建', server: 'direct.example.com' },
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
  const { operator: assignDialer } = loadScript('scripts/dialer-proxy.js');
  const selfHosted = await assignDialer(selfHostedSource, 'ClashMeta', {});
  const airports: ProxyNode[] = [...directProxies];
  for (const proxies of airportSources) {
    airports.push(...(await assignDialer(proxies, 'ClashMeta', {})));
  }
  const prepared = [...selfHosted, ...airports];
  const originalNames = new Map(prepared.map(({ server, name }) => [server, name]));
  const expectedDialers = new Map([
    ['sg.example.com', '🛡️ 亚太中转'],
    ['us.example.com', '🛡️ 美西中转'],
    ['direct.example.com', '🛡️ 亚太中转'],
    ['oix.example.com', '🛡️ 亚太中转'],
    ['oix-us.example.com', '🛡️ 美西中转'],
    ['yiyuan.example.com', '🛡️ 亚太中转'],
  ]);
  const { operator: rename } = loadScript('scripts/rename.js', {
    $arguments: {},
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
    if (proxy._subName === '自建') {
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
    const overwrite = loadScript('scripts/config-overwrite.js', {
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
        assert.ok(groups.has(proxy['dialer-proxy']), `${client}: ${proxy.name} has a valid relay`);
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
      ['🏝️ 精品节点', ['sg.example.com', 'us.example.com', 'direct.example.com']],
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
