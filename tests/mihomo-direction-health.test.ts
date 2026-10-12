/**
 * @file 使用回环 HTTP 代理验证同一文件 provider 的方向测速与独立选点。
 * 不读取用户配置、不使用真实订阅，不访问公网；HTTP 代理直接模拟两个方向的探测响应。
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { stringify } from 'yaml';

/**
 * 为测试监听随机回环端口。
 * @param server 尚未监听的本地服务。
 * @returns 内核分配的端口；监听失败时抛出异常。
 */
async function listenLocal(server: net.Server): Promise<number> {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  return address.port;
}

/**
 * 等待内核就绪或探测完成，最多等待二十秒，覆盖 url-test 的十秒选点缓存。
 * @param ready 只读取本地测试状态的就绪检查。
 * @param failure 超时或内核提前退出时提供诊断内容。
 * @returns 就绪时完成；持续失败时抛出包含内核输出的异常。
 */
async function waitUntil(
  ready: () => boolean | Promise<boolean>,
  failure: () => string,
): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (await ready()) return;
    await delay(100);
  }
  assert.fail(failure());
}

test('provider direction probes bypass REJECT placeholders and empty groups fall back', async (t) => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mihomo-direction-'));
  const sockets = new Set<net.Socket>();
  const servers: http.Server[] = [];
  const timers = new Set<NodeJS.Timeout>();
  t.after(() => {
    for (const timer of timers) clearTimeout(timer);
    for (const socket of sockets) socket.destroy();
    for (const server of servers) server.close();
    fs.rmSync(homeDir, { recursive: true, force: true });
  });

  const completed = new Set<string>();
  const proxies = [];
  const proxyNames = {
    broken: 'HK IXP broken',
    'relay-a': 'HK IXP relay-a',
    'relay-b': 'HK CIA relay-b',
    excluded: 'HK other',
  };
  for (const [role, name] of Object.entries(proxyNames)) {
    const server = http.createServer();
    servers.push(server);
    server.on('connection', (socket) => {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
      socket.on('error', () => {});
    });
    server.on('connect', (request, socket) => {
      // 请求目标仅作 URL 标识；代理直接应答，绝不向目标建立外部连接。
      assert.equal(request.url, '127.0.0.1:1');
      socket.write('HTTP/1.1 200 Connection established\r\n\r\n');
      socket.once('data', (data: Buffer) => {
        const direction = data.toString().includes('/sg ') ? 'SG' : 'JP';
        const healthy = role !== 'broken' && !(role === 'relay-a' && direction === 'JP');
        const slow = role === 'relay-b' && direction === 'SG';
        const timer = setTimeout(
          () => {
            timers.delete(timer);
            socket.end(
              `HTTP/1.1 ${healthy ? '200 OK' : '500 Failed'}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n`,
            );
            completed.add(`${role}:${direction}`);
          },
          slow ? 250 : 20,
        );
        timers.add(timer);
      });
    });
    const port = await listenLocal(server);
    proxies.push({ name, type: 'http', server: '127.0.0.1', port });
  }

  // 短暂预留系统分配的端口，再交给内核的本地 controller；不使用任何用户端口。
  const reservation = net.createServer();
  const controllerPort = await listenLocal(reservation);
  await new Promise<void>((resolve) => reservation.close(() => resolve()));
  const controller = `http://127.0.0.1:${controllerPort}`;
  fs.writeFileSync(path.join(homeDir, 'provider.yaml'), stringify({ proxies }));
  fs.writeFileSync(
    path.join(homeDir, 'config.yaml'),
    stringify({
      'external-controller': `127.0.0.1:${controllerPort}`,
      'log-level': 'debug',
      dns: { enable: false },
      'proxy-providers': { shared: { type: 'file', path: './provider.yaml' } },
      'proxy-groups': [
        ...['SG', 'JP'].map((direction) => ({
          name: direction,
          type: 'url-test',
          proxies: ['REJECT'],
          use: ['shared'],
          filter: '(?i)^(?=.*(?:IXP|CIA))(?=.*(?:\\bHK\\b|香港|Hong\\s*Kong|🇭🇰)).*',
          url: `http://127.0.0.1:1/${direction.toLowerCase()}`,
          'expected-status': 200,
          interval: 300,
          timeout: 5000,
          tolerance: 0,
          lazy: false,
        })),
        ...['empty', 'provider-empty'].map((name) => ({
          name,
          type: 'url-test',
          proxies: ['REJECT'],
          ...(name === 'provider-empty' ? { use: ['shared'], filter: '^no-matching-node$' } : {}),
          url: 'http://127.0.0.1:1/sg',
          'expected-status': 200,
          interval: 300,
          lazy: false,
        })),
        {
          name: 'fallback',
          type: 'fallback',
          proxies: ['empty', 'provider-empty', 'SG'],
          url: 'http://127.0.0.1:1/sg',
          'expected-status': 200,
          interval: 1,
          lazy: false,
        },
      ],
      rules: ['MATCH,REJECT'],
    }),
  );

  const platform = process.platform === 'win32' ? 'windows' : process.platform;
  const architecture = process.arch === 'x64' ? 'amd64' : process.arch;
  // 直接启动平台内核，以便测试清理能终止真正进程，避免包装器遗留子进程。
  const binary: unknown =
    process.env.MIHOMO_BIN ??
    createRequire(import.meta.url)(`@pkgship/mihomo-${platform}-${architecture}`);
  assert.equal(typeof binary, 'string');
  assert.ok(typeof binary === 'string' && path.isAbsolute(binary));
  const child = spawn(binary, ['-d', homeDir, '-f', path.join(homeDir, 'config.yaml')], {
    cwd: homeDir,
    env: Object.fromEntries(
      Object.entries(process.env).filter(
        ([name]) => !name.startsWith('OIX_') && !name.startsWith('CLASH_'),
      ),
    ),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (data: Buffer) => (output += data.toString()));
  child.stderr.on('data', (data: Buffer) => (output += data.toString()));
  child.on('error', (error) => (output += error.message));
  t.after(async () => {
    if (child.pid !== undefined && child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill('SIGKILL');
      await exited;
    }
  });

  // 只等待自动探测，不通过 controller 发起测速，证明 group.url 确实注册给了 provider。
  await waitUntil(
    () => completed.size === 6 && output.includes('Finish A Health Checking'),
    () => `direction probes did not complete:\n${output}`,
  );
  const expected = {
    SG: proxyNames['relay-a'],
    JP: proxyNames['relay-b'],
    empty: 'REJECT',
    'provider-empty': 'REJECT',
    fallback: 'SG',
  };
  await waitUntil(
    async () => {
      const selections: Record<string, unknown> = {};
      for (const name of Object.keys(expected)) {
        const response = await fetch(`${controller}/proxies/${name}`, {
          signal: AbortSignal.timeout(5000),
        });
        assert.equal(response.status, 200, output);
        const group: unknown = await response.json();
        assert.ok(group && typeof group === 'object' && 'now' in group && 'all' in group);
        if (name.endsWith('empty')) assert.deepEqual(group.all, ['REJECT'], output);
        if (name === 'SG' || name === 'JP') {
          assert.deepEqual(
            group.all,
            ['REJECT', proxyNames.broken, proxyNames['relay-a'], proxyNames['relay-b']],
            output,
          );
        }
        selections[name] = group.now;
      }
      return Object.entries(expected).every(([name, selected]) => selections[name] === selected);
    },
    () => `REJECT blocked a healthy provider or fallback candidate:\n${output}`,
  );
  assert.equal(completed.has('excluded:SG') || completed.has('excluded:JP'), false);
});
