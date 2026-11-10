/**
 * @file 验证节点重命名的地区识别、固定规则与名称格式。
 * 同时检查源码接口和 Sub-Store 发布入口，确保不读取脚本参数、仅按节点名称识别且不联网。
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import vm from 'node:vm';
import { renameProxies } from '../src/scripts/rename/index.ts';
import type { ProxyNode, ScriptArguments } from '../src/scripts/shared/types.ts';

interface TestNode extends ProxyNode {
  id: string;
}
interface RenameRuntime {
  operator: (
    proxies: TestNode[],
    targetPlatform: string,
    context: Record<string, unknown>,
  ) => Promise<TestNode[]>;
}
type RenameSession = (proxies: TestNode[]) => Promise<TestNode[]>;

const scriptPath = fileURLToPath(new URL('../dist/rename.js', import.meta.url));

/**
 * 创建可重复调用的重命名 VM 会话，记录并禁止名称识别期间的联网和计时器调用。
 * @param {Function} [legacyArguments] 旧脚本参数的 getter；省略时不注入 $arguments 全局对象。
 * @returns {Function} 接收节点、返回普通节点数组 Promise 的会话执行函数。
 * @throws {Error} 发布脚本读取或加载失败时抛出。
 */
function createRenameSession(legacyArguments?: () => ScriptArguments): RenameSession {
  const externalCalls: string[] = [];
  const context = vm.createContext({
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
  if (legacyArguments) {
    Object.defineProperty(context, '$arguments', { get: legacyArguments });
  }
  vm.runInContext(fs.readFileSync(scriptPath, 'utf8'), context, {
    filename: scriptPath,
  });
  /**
   * 在同一 VM 中执行重命名，检查本会话从未调用网络或计时器。
   * @param {Object[]} proxies 待交给发布脚本处理的节点数组。
   * @returns {Promise<Object[]>} 经过 JSON 转换、可跨 VM 进行断言的结果节点。
   * @throws {Error} 重命名失败或发现外部调用时抛出。
   */
  return async (proxies: TestNode[]): Promise<TestNode[]> => {
    const result = await context.operator(proxies, 'ClashMeta', {});
    // A caught fetch failure alone cannot prove processing stayed offline.
    assert.deepEqual(externalCalls, [], 'renaming must not use network requests or timers');
    return JSON.parse(JSON.stringify(result)) as TestNode[];
  };
}

/**
 * 在不含脚本参数的新建隔离会话中执行一次重命名，避免不同测试共享正则或运行时状态。
 * @param {Object[]} proxies 待重命名的测试节点。
 * @returns {Promise<Object[]>} 发布脚本返回并转换为普通对象的节点数组。
 * @throws {Error} 会话执行失败或触发禁止的外部调用时抛出。
 */
async function rename(proxies: TestNode[]): Promise<TestNode[]> {
  return createRenameSession()(proxies);
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

  assert.deepEqual(await rename(proxies), JSON.parse(JSON.stringify(proxies)));
});

test('recognizes country names, flags, city aliases and country codes, then sorts by region', async () => {
  const result = await rename([
    node('english', 'Germany'),
    node('code', 'US_1'),
    node('flag', '🇸🇬'),
    node('city', 'Tokyo'),
    node('chinese', '香港'),
  ]);

  assert.deepEqual(
    result.map(({ id, name }) => [id, name]),
    [
      ['chinese', '🇭🇰 HK 01'],
      ['city', '🇯🇵 JP 01 | Tokyo'],
      ['flag', '🇸🇬 SG 01'],
      ['code', '🇺🇸 US 01'],
      ['english', '🇩🇪 DE 01'],
    ],
  );
});

test('nodes sharing an endpoint keep independent recognition and retain all regions', async () => {
  const proxies = [
    node('unknown', '未知节点'),
    node('hong-kong', '香港'),
    node('japan', '日本'),
    node('germany', '德国'),
  ];

  assert.deepEqual(
    (await rename(proxies)).map(({ id, name }) => [id, name]),
    [
      ['hong-kong', '🇭🇰 HK 01'],
      ['japan', '🇯🇵 JP 01'],
      ['germany', '🇩🇪 DE 01'],
      ['unknown', '未知节点'],
    ],
  );
});

test('renumbers within each subscription and retains providers, lines and built-in keywords', async () => {
  const result = await rename([
    node('oix-dmit', '🇯🇵 日本 DMIT 12', { _subName: 'oixCloud Edge' }),
    node('oix-edge', '日本 Edge 09', { _subName: 'oixCloud Edge' }),
    node('liangxin', '🇯🇵日本高速01|CTCU|0.5x', { _subName: '良心云' }),
    node('built-in-only', '东京 IPLC 99', { _subName: '示例订阅' }),
  ]);

  assert.deepEqual(Object.fromEntries(result.map((p) => [p.id, p.name])), {
    'oix-dmit': '🇯🇵 JP 01 | DMIT oixCloud Edge',
    'oix-edge': '🇯🇵 JP 02 | Edge oixCloud Edge',
    liangxin: '🇯🇵 JP 01 | 高速 CTCU 0.5x 良心云',
    'built-in-only': '🇯🇵 JP 01 | 东京 示例订阅',
  });
});

test('current oixCloud Edge names retain complete carrier labels and normalized regions', async () => {
  // 仅保留用户提供清单中的名称；不记录真实连接地址、密码或订阅凭据。
  const cases = [
    ['🇭🇰 香港 DMIT 01', '🇭🇰 HK 01 | DMIT oixCloud Edge'],
    ['🇭🇰 香港 Edge 01', '🇭🇰 HK 02 | Edge oixCloud Edge'],
    ['🇭🇰 香港 PCCW-HKT', '🇭🇰 HK 03 | PCCW-HKT oixCloud Edge'],
    ['🇭🇰 香港 HKBN 01', '🇭🇰 HK 04 | HKBN oixCloud Edge'],
    ['🇭🇰 香港 HKT 01', '🇭🇰 HK 05 | HKT oixCloud Edge'],
    ['🇲🇴 澳门 Edge', '🇲🇴 MO 01 | Edge oixCloud Edge'],
    ['🇨🇳 台湾 CHT 01', '🇼🇸 TW 01 | CHT oixCloud Edge'],
    ['🇨🇳 台湾 HINET 01', '🇼🇸 TW 02 | HINET oixCloud Edge'],
    ['🇸🇬 新加坡 Sptel', '🇸🇬 SG 01 | Sptel oixCloud Edge'],
    ['🇯🇵 日本 Biglobe', '🇯🇵 JP 01 | Biglobe oixCloud Edge'],
    ['🇯🇵 日本 KDDI', '🇯🇵 JP 02 | KDDI oixCloud Edge'],
    ['🇯🇵 日本 SoftBank', '🇯🇵 JP 03 | SoftBank oixCloud Edge'],
    ['🇺🇸 美国 Misaka 01', '🇺🇸 US 01 | Misaka oixCloud Edge'],
    ['🇺🇸 美国 GTT', '🇺🇸 US 02 | GTT oixCloud Edge'],
    ['🇺🇸 美国 Verizon', '🇺🇸 US 03 | Verizon oixCloud Edge'],
    ['🇨🇦 加拿大 Bell', '🇨🇦 CA 01 | Bell oixCloud Edge'],
    ['🇬🇧 英国 GTT', '🇬🇧 GB 01 | GTT oixCloud Edge'],
  ];
  const proxies = cases.map(([name], index) =>
    node(String(index), name, { type: 'anytls', _subName: 'oixCloud Edge' }),
  );
  const result = await rename(proxies);
  assert.equal(result.length, proxies.length);
  assert.deepEqual(
    Object.fromEntries(result.map(({ id, name }) => [id, name])),
    Object.fromEntries(cases.map(([, name], index) => [String(index), name])),
  );
});

test('the source API accepts a logger without Sub-Store globals and preserves input fields', () => {
  const messages: string[] = [];
  const known = node('source', '东京', {
    _subName: '示例订阅',
    'dialer-proxy': '亚太中转',
    'tls-options': { enabled: true },
  });
  const unknown = node('unknown', '未知节点 01');
  const proxies = [unknown, known];
  const result = renameProxies(proxies, {
    /**
     * 收集源码接口的日志，以验证显式传入的日志依赖被使用。
     * @param {unknown} message 日志接口传入的值，本测试期望重命名流程输出文本。
     * @returns {void} 将文本追加到 messages，无返回值。
     */
    log(message: unknown): void {
      messages.push(message as string);
    },
  });

  assert.deepEqual(result[0], { ...known, name: '🇯🇵 JP 01 | 东京 示例订阅' });
  assert.notEqual(result[0], known);
  assert.equal(result[0]['tls-options'], known['tls-options']);
  assert.equal(result[1], unknown);
  assert.equal(known.name, '东京');
  assert.equal(unknown.name, '未知节点 01');
  assert.deepEqual(proxies, [unknown, known]);
  assert.ok(messages.some((message) => message.includes('名称命中 1/2')));
});

test('region matching preserves Chinese, flag, English and code priority', async () => {
  const result = await rename([
    node('chinese', '🇺🇸 Germany 日本'),
    node('flag', '🇸🇬 Germany US'),
    node('english', 'Germany US'),
    node('table-order', '日本 香港'),
    node('code-boundary', 'Registry'),
  ]);

  assert.deepEqual(Object.fromEntries(result.map((proxy) => [proxy.id, proxy.name])), {
    'table-order': '🇭🇰 HK 01',
    chinese: '🇯🇵 JP 01',
    flag: '🇸🇬 SG 01',
    english: '🇩🇪 DE 01',
    'code-boundary': 'Registry',
  });
});

test('Taiwan uses the flag substitution and UK normalizes to the standard GB code', async () => {
  const result = await rename([
    node('taiwan', '台湾', { _subName: '普通' }),
    node('taiwan-flag', '🇹🇼 台湾 Edge 01', { _subName: 'oixCloud Edge' }),
    node('uk', 'UK Edge 99', { _subName: 'oixCloud Edge' }),
  ]);

  assert.deepEqual(Object.fromEntries(result.map((proxy) => [proxy.id, proxy.name])), {
    taiwan: '🇼🇸 TW 01 | 普通',
    'taiwan-flag': '🇼🇸 TW 01 | Edge oixCloud Edge',
    uk: '🇬🇧 GB 01 | Edge oixCloud Edge',
  });
});

test('built-in filtering uses original node names and does not filter subscription names', async () => {
  const result = await rename([
    node('remaining', '香港 剩余流量'),
    node('expiry', '日本 Expire'),
    node('name-match', '官网 日本 01'),
    node('subscription', '日本 01', { _subName: '官网' }),
    node('literal', '香港 测试(1)'),
  ]);

  assert.deepEqual(
    result.map(({ id, name }) => [id, name]),
    [
      ['literal', '🇭🇰 HK 01'],
      ['subscription', '🇯🇵 JP 01 | 官网'],
    ],
  );
});

test('sequence numbers remain even when a complete name or subscription is unique', async () => {
  const result = await rename([
    node('unique-first', '日本 AWS'),
    node('unique-second', '日本 GIA'),
    node('shared-first', '香港 AWS'),
    node('shared-second', '香港 AWS'),
    node('subscription', '香港 AWS', { _subName: '另一个订阅' }),
  ]);

  assert.deepEqual(Object.fromEntries(result.map((proxy) => [proxy.id, proxy.name])), {
    'shared-first': '🇭🇰 HK 01 | AWS',
    'shared-second': '🇭🇰 HK 02 | AWS',
    subscription: '🇭🇰 HK 01 | AWS 另一个订阅',
    'unique-first': '🇯🇵 JP 01 | AWS',
    'unique-second': '🇯🇵 JP 02 | GIA',
  });
});

test('keywords preserve source order and full pipe tags without matching inside ASCII words', async () => {
  const result = await rename([node('keywords', '日本 Registry 高级专线 东京|CTCUCM|.5x|IPLC')]);

  assert.equal(result[0].name, '🇯🇵 JP 01 | 高级专线 东京 CTCUCM .5x');
});

test('global alias patterns do not leak matching state between nodes or calls', async () => {
  const run = createRenameSession();
  const proxies = ['Tokyo', 'Tokyo', 'Paris', 'Paris', 'Hongkong', 'Hongkong'].map((name, index) =>
    node(String(index), `品牌 ${name}`),
  );
  const first = await run(proxies);

  assert.deepEqual(Object.fromEntries(first.map((proxy) => [proxy.id, proxy.name])), {
    0: '🇯🇵 JP 01 | Tokyo',
    1: '🇯🇵 JP 02 | Tokyo',
    2: '🇫🇷 FR 01 | Paris',
    3: '🇫🇷 FR 02 | Paris',
    4: '🇭🇰 HK 01',
    5: '🇭🇰 HK 02',
  });
  assert.deepEqual(await run(proxies), first);
});

test('all removed parameters are ignored, including values that previously rejected the operation', async () => {
  const proxies = [
    node('known', '香港品牌 东京 IPLC', { _subName: '示例订阅' }),
    node('other-region', '德国'),
    node('filtered', '香港 剩余流量'),
    node('unknown', '未知节点 01'),
  ];
  const expected = await rename(proxies);
  const run = createRenameSession(() => ({
    remove: false,
    one: true,
    hot: 'JP',
    block: '[',
    retain: 'IPLC',
    out: 'ZH|QC',
    filter: '%',
  }));

  assert.deepEqual(await run(proxies), expected);
});

test('the published entry never reads the legacy arguments global', async () => {
  const run = createRenameSession(() => {
    throw new Error('Reading $arguments is forbidden');
  });

  assert.equal((await run([node('entry', '东京')]))[0].name, '🇯🇵 JP 01 | 东京');
});
