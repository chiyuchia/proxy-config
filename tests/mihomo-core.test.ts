/**
 * @file 默认使用 npm 安装的 Mihomo 内核，回归文件 provider 与代理组的原生解析。
 * MIHOMO_BIN 可用绝对路径指定其他内核；缺少依赖或执行失败时直接报错，不跳过测试。
 * 只取真实模板覆写后的 oixCloud provider 和 Optimized 组，隔离订阅节点及远程规则、DNS 数据。
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
  const config = overwriteConfig(
    parse(fs.readFileSync(new URL('../dist/mihomo.yaml', import.meta.url), 'utf8')) as MergedConfig,
  );
  const optimized = config['proxy-groups'].find(({ name }) => name === '✈️ oixCloud Optimized');
  assert.ok(optimized);
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
          'proxy-groups': [optimized],
          ...(withProvider ? { 'proxy-providers': config['proxy-providers'] } : {}),
          rules: [`MATCH,${optimized.name}`],
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
