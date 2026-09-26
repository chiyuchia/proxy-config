/**
 * @file 在隔离目录运行真实构建，验证模板发布、只读检查、来源错误与旧产物清理。
 * 不访问网络，不修改仓库中的配置或 dist/。
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from 'yaml';
import type { MergedConfig } from '../src/scripts/shared/types.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const assets = ['config-overwrite.js', 'dialer-proxy.js', 'mihomo.yaml', 'rename.js', 'stash.yaml'];

/**
 * 复制构建所需源码并复用已安装依赖，创建退出时清理的隔离项目。
 * @param {Object} t 当前测试上下文，用于注册临时目录清理。
 * @returns {string} 独立项目根目录的绝对路径。
 */
function fixture(t: TestContext): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'proxy-config-build-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  for (const entry of ['src', 'tools', 'package.json', 'tsconfig.json']) {
    fs.cpSync(path.join(root, entry), path.join(directory, entry), { recursive: true });
  }
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(directory, 'node_modules'), 'dir');
  return directory;
}

/**
 * 在隔离项目执行真实 CLI，捕获输出并拒绝进程超时或启动失败。
 * @param {string} directory 项目根目录。
 * @param {boolean} [check=false] 是否使用只读 --check 模式。
 * @returns {Object} 退出状态和诊断输出，供调用者断言成功或预期失败。
 */
function build(directory: string, check = false): { status: number | null; output: string } {
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'tools/build.ts', ...(check ? ['--check'] : [])],
    { cwd: directory, encoding: 'utf8', timeout: 30_000 },
  );
  assert.ifError(result.error);
  return { status: result.status, output: result.stdout + result.stderr };
}

/**
 * 读取所有发布产物的完整文本，比较重建和失败前后的字节内容。
 * @param {string} directory 项目根目录。
 * @returns {string[]} 按发布列表顺序返回文本。
 */
function contents(directory: string): string[] {
  return assets.map((name) => fs.readFileSync(path.join(directory, 'dist', name), 'utf8'));
}

test('build creates five reproducible assets and check detects missing, stale and retired files without writing', (t) => {
  const directory = fixture(t);
  const dist = path.join(directory, 'dist');
  const missing = build(directory, true);
  assert.equal(missing.status, 1, missing.output);
  assert.match(missing.output, /dist\/mihomo.yaml 与源码不一致/);
  assert.match(missing.output, /dist\/stash.yaml 与源码不一致/);
  assert.equal(fs.existsSync(dist), false, '--check must not create dist');

  const first = build(directory);
  assert.equal(first.status, 0, first.output);
  assert.deepEqual(fs.readdirSync(dist).sort(), assets);
  const original = contents(directory);
  const modifiedTimes = assets.map((name) => fs.statSync(path.join(dist, name)).mtimeMs);
  assert.equal(build(directory, true).status, 0);
  assert.deepEqual(contents(directory), original);
  assert.deepEqual(
    assets.map((name) => fs.statSync(path.join(dist, name)).mtimeMs),
    modifiedTimes,
  );

  const yaml = path.join(dist, 'stash.yaml');
  fs.appendFileSync(yaml, '# stale\n');
  const stale = build(directory, true);
  assert.equal(stale.status, 1, stale.output);
  assert.match(stale.output, /dist\/stash.yaml 与源码不一致/);
  assert.match(fs.readFileSync(yaml, 'utf8'), /# stale\n$/);
  fs.rmSync(path.join(dist, 'mihomo.yaml'));
  assert.equal(build(directory, true).status, 1);
  assert.equal(fs.existsSync(path.join(dist, 'mihomo.yaml')), false);

  const obsolete = path.join(dist, 'merge-config.js');
  const unrelated = path.join(dist, 'notes.txt');
  fs.writeFileSync(obsolete, '// old generated script\n');
  fs.writeFileSync(unrelated, 'keep me');
  const retired = build(directory, true);
  assert.equal(retired.status, 1, retired.output);
  assert.match(retired.output, /merge-config.js 已停用/);
  assert.equal(fs.existsSync(obsolete), true);
  const rebuilt = build(directory);
  assert.equal(rebuilt.status, 0, rebuilt.output);
  assert.deepEqual(contents(directory), original);
  assert.equal(fs.existsSync(obsolete), false);
  assert.equal(fs.readFileSync(unrelated, 'utf8'), 'keep me');
});

test('template serialization expands YAML anchors while preserving runtime declarations and node-free inputs', (t) => {
  const directory = fixture(t);
  const baseFile = path.join(directory, 'src', 'configs', 'base.yaml');
  fs.appendFileSync(baseFile, '\nx-substore:\n  runtime-proxy-providers: [fixtureRuntime]\n');
  const result = build(directory);
  assert.equal(result.status, 0, result.output);
  for (const client of ['mihomo', 'stash']) {
    const text = fs.readFileSync(path.join(directory, 'dist', `${client}.yaml`), 'utf8');
    // 产物不能再依赖 merge:true，否则其他 YAML 解析器会把 << 当普通字段。
    const template = parse(text, { merge: false, uniqueKeys: true }) as MergedConfig;
    assert.equal(Object.hasOwn(template, 'proxies'), false);
    assert.equal(Object.hasOwn(template, '$base'), false);
    assert.equal(Object.hasOwn(template, '$profile'), false);
    assert.doesNotMatch(
      text,
      /^\s*(?:<<|\$(?:delete|before|after|append|prepend|remove|insert-before)):/m,
    );
    assert.deepEqual(template['x-substore'], { 'runtime-proxy-providers': ['fixtureRuntime'] });
    const groups = template['proxy-groups'];
    assert.ok(groups.every((group) => group['x-substore']));
    const testGroups = groups.filter((group) => group.type === 'url-test');
    assert.ok(testGroups.length > 1);
    assert.ok(testGroups.every((group) => typeof group.url === 'string'));
    assert.ok(testGroups.every((group) => typeof group.interval === 'number'));
  }
});

test('invalid sources fail the build before replacing any existing asset', async (t) => {
  const directory = fixture(t);
  const initial = build(directory);
  assert.equal(initial.status, 0, initial.output);
  const original = contents(directory);
  const source = fs.readFileSync(path.join(directory, 'src', 'configs', 'stash.yaml'), 'utf8');
  const cases: [string, string, RegExp][] = [
    ['wrong client', source.replace('$profile: stash', '$profile: mihomo'), /\$profile: stash/],
    ['empty source', '', /\$profile: stash/],
    ['duplicate key', `${source}\ndns: {}\n`, /src\/configs\/stash.yaml 读取或解析失败/],
    [
      'cross-file anchor',
      `${source}\nextra: *url_test_defaults\n`,
      /src\/configs\/stash.yaml 读取或解析失败/,
    ],
    ['injected nodes in source', `${source}\nproxies: []\n`, /配置源不能包含 proxies/],
    ['missing group reference', `${source}\nrules: [MATCH,missing]\n`, /规则引用了不存在的策略/],
    [
      'invalid member declaration',
      stringify({
        $profile: 'stash',
        'proxy-groups': [{ name: '🚀 节点选择', 'x-substore': { members: { mode: 'invalid' } } }],
      }),
      /members.mode/,
    ],
  ];
  for (const [name, invalid, expected] of cases) {
    await t.test(name, () => {
      const profile = path.join(directory, 'src', 'configs', 'stash.yaml');
      fs.writeFileSync(profile, invalid);
      const result = build(directory);
      assert.notEqual(result.status, 0, result.output);
      assert.match(result.output, expected);
      assert.deepEqual(contents(directory), original, 'failed build must preserve all assets');
      assert.equal(fs.readFileSync(profile, 'utf8'), invalid, 'build must not rewrite source');
    });
  }
});
