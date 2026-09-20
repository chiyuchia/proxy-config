/**
 * @file 验证节点重命名的地区识别、参数边界与名称格式。
 * 同时检查源码接口和 Sub-Store 发布入口，确保识别仅依赖节点名称且不发起网络请求。
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import vm from 'node:vm';
import { renameProxies } from '../src/rename/index.ts';
import type { ProxyNode, ScriptArguments } from '../src/types.ts';

interface TestNode extends ProxyNode {
  id: string;
}
interface RenameRuntime {
  $arguments: ScriptArguments;
  operator: (
    proxies: TestNode[],
    targetPlatform: string,
    context: Record<string, unknown>,
  ) => Promise<TestNode[]>;
}
type RenameSession = (proxies: TestNode[], args?: ScriptArguments) => Promise<TestNode[]>;

const scriptPath = fileURLToPath(new URL('../scripts/rename.js', import.meta.url));

/**
 * 创建可重复调用的重命名 VM 会话，记录并禁止名称识别期间的联网和计时器调用。
 * @returns {Function} 接收节点与参数、返回普通节点数组 Promise 的会话执行函数。
 * @throws {Error} 发布脚本读取或加载失败时抛出。
 */
function createRenameSession(): RenameSession {
  const externalCalls: string[] = [];
  const context = vm.createContext({
    $arguments: {},
    console: {
      /**
       * 丢弃模拟运行时传入的日志，避免测试输出被逐节点信息占满。
       * @returns {void} 不记录日志，无返回值。
       */
      log() {},
    },
    AbortController,
    /**
     * 记录意外的联网尝试并立即失败，不发起实际网络请求。
     * @returns {never} 始终抛出错误，不返回响应。
     * @throws {Error} 调用时抛出禁止联网的错误。
     */
    fetch() {
      externalCalls.push('fetch');
      throw new Error('Network requests are forbidden during name recognition');
    },
    /**
     * 记录意外的计时器注册，返回占位句柄但不调度任何任务。
     * @returns {number} 固定的测试计时器句柄 1。
     */
    setTimeout() {
      externalCalls.push('setTimeout');
      return 1;
    },
    /**
     * 记录计时器清理尝试，供会话结束时的离线行为断言检查。
     * @returns {void} 仅追加调用记录，无返回值。
     */
    clearTimeout() {
      externalCalls.push('clearTimeout');
    },
  }) as unknown as RenameRuntime;
  vm.runInContext(fs.readFileSync(scriptPath, 'utf8'), context, {
    filename: scriptPath,
  });
  /**
   * 在同一 VM 中替换参数并执行重命名，检查本会话从未调用网络或计时器。
   * @param {Object[]} proxies 待交给发布脚本处理的节点数组。
   * @param {Object} [args={}] 本次调用的 Sub-Store 脚本参数。
   * @returns {Promise<Object[]>} 经过 JSON 转换、可跨 VM 进行断言的结果节点。
   * @throws {Error} 重命名失败或发现外部调用时抛出。
   */
  return async (proxies: TestNode[], args: ScriptArguments = {}): Promise<TestNode[]> => {
    context.$arguments = args;
    const result = await context.operator(proxies, 'ClashMeta', {});
    // A caught fetch failure alone cannot prove processing stayed offline.
    assert.deepEqual(externalCalls, [], 'renaming must not use network requests or timers');
    return JSON.parse(JSON.stringify(result)) as TestNode[];
  };
}

/**
 * 在新建的隔离会话中执行一次重命名，避免不同测试共享正则或运行时状态。
 * @param {Object[]} proxies 待重命名的测试节点。
 * @param {Object} [args={}] 本次重命名参数。
 * @returns {Promise<Object[]>} 发布脚本返回并转换为普通对象的节点数组。
 * @throws {Error} 会话执行失败或触发禁止的外部调用时抛出。
 */
async function rename(proxies: TestNode[], args: ScriptArguments = {}): Promise<TestNode[]> {
  return createRenameSession()(proxies, args);
}

/**
 * 构造带默认协议和测试地址的节点，允许用附加字段覆盖任意默认值。
 * @param {string} id 用于追踪排序和过滤结果的测试标识。
 * @param {string} name 待识别、重命名的原始节点名称。
 * @param {Object} [extra={}] 附加节点字段或默认字段覆盖值。
 * @returns {Object} 新建的测试节点对象。
 */
function node(id: string, name: string, extra: Partial<TestNode> = {}): TestNode {
  return { id, name, server: '192.0.2.1', port: 443, type: 'vless', ...extra };
}

test('unknown names keep their original names for IPv4, IPv6 and domain servers', async () => {
  const proxies = [
    node('ipv4', '未知节点 A'),
    node('ipv6', '未知节点 B', { server: '2001:db8::1' }),
    node('domain', 'example.jp 未知节点 C', { server: 'us.example.com' }),
    node('no-server', '香港', { server: undefined }),
  ];

  assert.deepEqual(
    await rename(proxies, { token: 'unused-legacy-token' }),
    JSON.parse(JSON.stringify(proxies)),
  );
});

test('recognizes country names, flags, city aliases and country codes, then sorts by region', async () => {
  const result = await rename(
    [
      node('english', 'Germany'),
      node('code', 'US_1'),
      node('flag', '🇸🇬'),
      node('city', 'Tokyo'),
      node('chinese', '香港'),
    ],
    { out: 'EN', retain: false },
  );

  assert.deepEqual(
    result.map(({ id, name }) => [id, name]),
    [
      ['chinese', 'HK 01'],
      ['city', 'JP 01'],
      ['flag', 'SG 01'],
      ['code', 'US 01'],
      ['english', 'DE 01'],
    ],
  );
});

test('nodes sharing an endpoint keep independent name recognition and hot filtering', async () => {
  const proxies = [
    node('unknown', '未知节点'),
    node('hong-kong', '香港'),
    node('japan', '日本'),
    node('germany', '德国'),
  ];
  const args = { out: 'EN', retain: false };

  assert.deepEqual(
    (await rename(proxies, args)).map(({ id, name }) => [id, name]),
    [
      ['hong-kong', 'HK 01'],
      ['japan', 'JP 01'],
      ['germany', 'DE 01'],
      ['unknown', '未知节点'],
    ],
  );
  assert.deepEqual(
    (await rename(proxies, { ...args, hot: true })).map((p) => p.id),
    ['hong-kong', 'japan'],
  );
  assert.deepEqual(
    (await rename(proxies, { ...args, hot: 'HK' })).map((p) => p.id),
    ['hong-kong'],
  );
});

test('renumbers within each subscription and retains provider, line and custom keywords', async () => {
  const result = await rename(
    [
      node('viking-sh', '🇯🇵 JP-SH-12-GCP', { _subName: 'VikingLinks' }),
      node('viking-go', 'JP-Go-09-Hytron', { _subName: 'VikingLinks' }),
      node('liangxin', '🇯🇵日本高速01|CTCU|0.5x', { _subName: '良心云' }),
      node('custom', '东京 IPLC 99', { _subName: '示例订阅' }),
    ],
    { retain: 'IPLC' },
  );

  assert.deepEqual(Object.fromEntries(result.map((p) => [p.id, p.name])), {
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

test('the source API accepts explicit arguments and logger without Sub-Store globals', () => {
  const messages: string[] = [];
  const result = renameProxies(
    [node('source', '东京')],
    { out: 'EN', retain: false },
    {
      /**
       * 收集源码接口的日志，以验证显式传入的日志依赖被使用。
       * @param {unknown} message 日志接口传入的值，本测试期望重命名流程输出文本。
       * @returns {void} 将文本追加到 messages，无返回值。
       */
      log(message: unknown): void {
        messages.push(message as string);
      },
    },
  );

  assert.equal(result[0].name, 'JP 01');
  assert.ok(messages.some((message) => message.includes('名称命中 1/1')));
});

test('region matching preserves Chinese, flag, English and code priority', async () => {
  const result = await rename(
    [
      node('chinese', '🇺🇸 Germany 日本'),
      node('flag', '🇸🇬 Germany US'),
      node('english', 'Germany US'),
      node('table-order', '日本 香港'),
      node('code-boundary', 'Registry'),
    ],
    { out: 'EN', retain: false },
  );

  assert.deepEqual(Object.fromEntries(result.map((proxy) => [proxy.id, proxy.name])), {
    'table-order': 'HK 01',
    chinese: 'JP 01',
    flag: 'SG 01',
    english: 'DE 01',
    'code-boundary': 'Registry',
  });
});

test('Taiwan keeps the default flag substitution while Viking preserves its flag and UK display code', async () => {
  const result = await rename(
    [
      node('taiwan', '台湾', { _subName: '普通' }),
      node('viking-tw', '🇹🇼 TW-01-Provider', { _subName: 'VikingLinks' }),
      node('viking-uk', '🇺🇸 UK-Go-99-Provider', { _subName: 'VikingLinks' }),
    ],
    { out: 'FG|EN|ZH|QC' },
  );

  assert.deepEqual(Object.fromEntries(result.map((proxy) => [proxy.id, proxy.name])), {
    taiwan: '🇼🇸 TW 台湾 Taiwan 01 | 普通',
    'viking-tw': '🇹🇼 TW 台湾 Taiwan 01 | Provider VikingLinks',
    'viking-uk': '🇺🇸 UK 英国 United Kingdom 01 | Go Provider VikingLinks',
  });
});

test('filter combines decoded literal custom words with defaults and only explicit blank disables it', async () => {
  const proxies = [
    node('default', '香港 剩余流量'),
    node('custom', '香港 测试(1)'),
    node('literal', '香港 测试1'),
  ];

  assert.deepEqual(
    (await rename(proxies, { filter: encodeURIComponent('测试(1)') })).map((p) => p.id),
    ['literal'],
  );
  assert.deepEqual(
    (await rename(proxies, { filter: false })).map((p) => p.id),
    ['custom', 'literal'],
  );
  assert.equal((await rename(proxies, { filter: ' ' })).length, 3);
});

test('remove and one retain truthiness while retain recognizes string false and zero', async () => {
  const proxies = [node('params', '东京')];

  assert.equal((await rename(proxies, { remove: false, out: 'EN' }))[0].name, 'JP 01 | 东京');
  assert.equal(
    (await rename(proxies, { remove: 'false', retain: 'false', one: 'false', out: 'EN' }))[0].name,
    'JP',
  );
  assert.equal((await rename(proxies, { retain: 0, out: 'EN' }))[0].name, 'JP 01');
  assert.equal((await rename(proxies, { retain: '0', out: 'EN' }))[0].name, 'JP 01');
});

test('output fields retain their order and duplicates, with invalid-only values using the default', async () => {
  const proxies = [node('output', '日本')];

  assert.equal(
    (await rename(proxies, { out: ' qc |unknown|zh|en|en ', retain: false }))[0].name,
    'Japan 日本 JP JP 01',
  );
  assert.equal((await rename(proxies, { out: 'unknown', retain: false }))[0].name, '🇯🇵 JP 01');
});

test('hot custom codes use canonical region codes and fall back to the preset if none match', async () => {
  const proxies = [
    node('gb', '英国'),
    node('hk', '香港'),
    node('de', '德国'),
    node('unknown', '未知'),
  ];

  assert.deepEqual(
    (await rename(proxies, { hot: ' de | hk |unknown' })).map((p) => p.id),
    ['hk', 'de'],
  );
  assert.deepEqual(
    (await rename(proxies, { hot: 'UK' })).map((p) => p.id),
    ['hk'],
  );
  assert.deepEqual(
    (await rename(proxies, { hot: 'false' })).map((p) => p.id),
    ['hk'],
  );
});

test('one compares complete names including suffixes and removes only the first sequence', async () => {
  const result = await rename(
    [
      node('unique-first', '日本 AWS'),
      node('unique-second', '日本 GIA'),
      node('shared-first', '香港 AWS'),
      node('shared-second', '香港 AWS'),
      node('subscription', '香港 AWS', { _subName: '另一个订阅' }),
    ],
    { out: 'EN', one: true },
  );

  assert.deepEqual(Object.fromEntries(result.map((proxy) => [proxy.id, proxy.name])), {
    'shared-first': 'HK 01 | AWS',
    'shared-second': 'HK 02 | AWS',
    subscription: 'HK | AWS 另一个订阅',
    'unique-first': 'JP | AWS',
    'unique-second': 'JP 02 | GIA',
  });
});

test('keywords preserve source order and full pipe tags without matching inside ASCII words', async () => {
  const result = await rename([node('keywords', '日本 Registry 高级专线 东京|CTCUCM|.5x|IPLC')], {
    out: 'EN',
    retain: 'IPLC',
  });

  assert.equal(result[0].name, 'JP 01 | 高级专线 东京 CTCUCM .5x IPLC');
});

test('global alias and block patterns do not leak matching state between nodes or calls', async () => {
  const run = createRenameSession();
  const proxies = ['Tokyo', 'Tokyo', 'Paris', 'Paris', 'Hongkong', 'Hongkong'].map((name, index) =>
    node(String(index), `品牌 ${name}`),
  );
  const args = { block: encodeURIComponent('品牌'), out: 'EN', retain: false };
  const first = await run(proxies, args);

  assert.deepEqual(Object.fromEntries(first.map((proxy) => [proxy.id, proxy.name])), {
    0: 'JP 01',
    1: 'JP 02',
    2: 'FR 01',
    3: 'FR 02',
    4: 'HK 01',
    5: 'HK 02',
  });
  assert.deepEqual(await run(proxies, args), first);
});

test('malformed filter encoding and block regular expressions reject the operation', async () => {
  await assert.rejects(rename([node('invalid', '香港')], { filter: '%' }), { name: 'URIError' });
  await assert.rejects(rename([node('invalid', '香港')], { block: '[' }), { name: 'SyntaxError' });
});
