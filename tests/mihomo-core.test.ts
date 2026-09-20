/**
 * @file 使用显式指定的 Mihomo 内核，回归 OpenClash 下载后缺少 oix 环境的配置测试。
 * 只取真实模板覆写后的 oixCloud provider 和 Optimized 组，隔离订阅节点及远程规则、DNS 数据。
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import type { SpawnSyncReturns } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parse, stringify } from 'yaml';
import { overwriteConfig } from '../src/config-overwrite/index.ts';
import { mergeConfigDocuments } from '../src/merge-config/index.ts';

const mihomoBinary = process.env.MIHOMO_BIN;

test(
  'native config test resolves oixCloud without a token or an existing provider file',
  { skip: !mihomoBinary && 'Set MIHOMO_BIN to an absolute Mihomo executable path' },
  () => {
    assert.ok(mihomoBinary && path.isAbsolute(mihomoBinary));
    const config = overwriteConfig(
      mergeConfigDocuments(
        parse(fs.readFileSync(new URL('../configs/base.yaml', import.meta.url), 'utf8'), {
          merge: true,
        }),
        parse(fs.readFileSync(new URL('../configs/mihomo.yaml', import.meta.url), 'utf8'), {
          merge: true,
        }),
        [],
      ),
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
          mihomoBinary,
          ['-t', '-d', homeDir, '-f', configPath],
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
  },
);
