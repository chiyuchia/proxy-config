/**
 * @file 默认使用 npm 安装的 Mihomo 内核，回归文件 provider 与代理组的原生解析。
 * MIHOMO_BIN 可用绝对路径指定其他内核；缺少依赖或执行失败时直接报错，不跳过测试。
 * 只取真实模板覆写后的 oixCloud provider、Optimized 组和中转引用链，隔离远程规则、DNS 数据。
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import type { SpawnSyncReturns } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parse, stringify } from 'yaml';
import { overwriteConfig } from '../src/scripts/config-overwrite/index.ts';
import type { MergedConfig } from '../src/scripts/shared/types.ts';

test('native config test resolves oixCloud without a token or an existing provider file', () => {
  const mihomoBinary = process.env.MIHOMO_BIN;
  if (mihomoBinary !== undefined) {
    assert.ok(path.isAbsolute(mihomoBinary), 'MIHOMO_BIN 必须是内核可执行文件的绝对路径');
  }
  // 使用当前 Node 执行包的跨平台入口，避免依赖 PATH 或 Windows 的 .cmd 包装。
  const command = mihomoBinary ?? process.execPath;
  const prefix =
    mihomoBinary === undefined
      ? [createRequire(import.meta.url).resolve('@pkgship/mihomo/bin/mihomo.js')]
      : [];
  const config = overwriteConfig({
    ...(parse(
      fs.readFileSync(new URL('../dist/mihomo.yaml', import.meta.url), 'utf8'),
    ) as MergedConfig),
    proxies: [
      {
        name: 'VikingLinks HK Go',
        type: 'ss',
        server: '127.0.0.1',
        port: 443,
        cipher: 'aes-128-gcm',
        password: 'test-only',
      },
      {
        name: 'VikingLinks SG IEPL',
        type: 'ss',
        server: '127.0.0.1',
        port: 443,
        cipher: 'aes-128-gcm',
        password: 'test-only',
      },
      {
        name: '良心云 TW CT',
        type: 'vless',
        server: '127.0.0.1',
        port: 443,
        uuid: '00000000-0000-4000-8000-000000000001',
      },
      ...[
        ['自建 SG', '🛡️ 狮城中转'],
        ['自建 JP', '🛡️ 日本中转'],
      ].map(([name, dialer]) => ({
        name,
        type: 'ss',
        server: '127.0.0.1',
        port: 443,
        cipher: 'aes-128-gcm',
        password: 'test-only',
        'dialer-proxy': dialer,
      })),
    ],
  });
  const optimized = config['proxy-groups'].find(({ name }) => name === '✈️ oixCloud Optimized');
  const optimizedAsia = config['proxy-groups'].find(
    ({ name }) => name === '✈️ oixCloud Optimized 亚太',
  );
  const fallback = config['proxy-groups'].find(({ name }) => name === '🛡️ 亚太 Fallback');
  assert.ok(optimized);
  assert.ok(optimizedAsia);
  assert.ok(fallback);
  const nativeGroupNames = new Set([optimized.name, fallback.name, '🛡️ 狮城中转', '🛡️ 日本中转']);
  const groupsByName = new Map(config['proxy-groups'].map((group) => [group.name, group]));
  for (const name of nativeGroupNames) {
    const group = groupsByName.get(name);
    assert.ok(group, `missing native regression group: ${name}`);
    for (const member of group.proxies ?? []) {
      if (groupsByName.has(member)) nativeGroupNames.add(member);
    }
  }
  const nativeGroups = config['proxy-groups'].filter(({ name }) => nativeGroupNames.has(name));
  for (const direction of ['SG', 'JP']) {
    const expectedRegions =
      direction === 'SG' ? ['香港', '狮城', '亚太'] : ['香港', '日本', '亚太'];
    for (const region of expectedRegions) {
      assert.ok(nativeGroupNames.has(`✈️ oixCloud Optimized ${region} · ${direction}`));
    }
  }
  assert.deepEqual(config['proxy-providers'], {
    oixCloud: { type: 'file', path: './proxy_provider/oixCloud' },
  });
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'proxy-config-mihomo-'));
  const configPath = path.join(homeDir, 'config.yaml');
  const providerPath = path.join(homeDir, 'proxy_provider', 'oixCloud');
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([name]) => !name.startsWith('OIX_') && !name.startsWith('CLASH_'),
    ),
  );
  try {
    for (const withProvider of [true, false]) {
      fs.writeFileSync(
        configPath,
        stringify({
          proxies: config.proxies,
          'proxy-groups': nativeGroups,
          ...(withProvider ? { 'proxy-providers': config['proxy-providers'] } : {}),
          rules: [`MATCH,${fallback.name}`],
        }),
      );
      assert.equal(fs.existsSync(providerPath), false);
      const result: SpawnSyncReturns<string> = spawnSync(
        command,
        [...prefix, '-t', '-d', homeDir, '-f', configPath],
        {
          cwd: homeDir,
          env,
          encoding: 'utf8',
          timeout: 30_000,
        },
      );
      assert.ifError(result.error);
      const output = result.stdout + result.stderr;
      if (withProvider) {
        assert.equal(result.status, 0, output);
      } else {
        assert.notEqual(result.status, 0, output);
        assert.match(output, /oixCloud.*not found/);
      }
      assert.equal(fs.existsSync(providerPath), false, '-t must not require provider contents');
    }
  } finally {
    fs.rmSync(homeDir, { recursive: true, force: true });
  }
});
