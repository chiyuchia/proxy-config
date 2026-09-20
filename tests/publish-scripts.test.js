/**
 * @file 在临时本地 Git 仓库中验证 GitHub Actions 的真实产物发布步骤。
 * 覆盖发布条件、提交范围及并发推送保护，不连接或修改项目的真实远端。
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';

const workflow = parse(
  fs.readFileSync(new URL('../.github/workflows/check.yml', import.meta.url), 'utf8'),
);
const publishStep = workflow.jobs.publish.steps.find((step) => step.id === 'publish-scripts');
const publishedFiles = [
  'scripts/config-overwrite.js',
  'scripts/dialer-proxy.js',
  'scripts/merge-config.js',
  'scripts/rename.js',
];

/**
 * 创建隔离的本地工作仓库、裸远端和 hook 目录，测试结束后自动清理。
 * 所有提交、推送及文件写入仅发生在临时目录中，不使用项目真实远端。
 * @param {import('node:test').TestContext} t 用于注册清理回调的测试上下文。
 * @returns {Object} 仓库路径、源提交及构建、Git 操作、竞争提交和发布辅助函数。
 * @throws {Error} 临时文件操作或初始化 Git 命令失败时抛出。
 */
function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'proxy-config-publish-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const checkout = path.join(directory, 'checkout');
  const remote = path.join(directory, 'remote.git');
  const hooks = path.join(directory, 'hooks');
  fs.mkdirSync(hooks);

  // 不继承用户的 Git 目录、身份、签名或 hook 配置，所有提交都只发生在测试仓库。
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
  );
  Object.assign(env, {
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    LC_ALL: 'C',
  });
  const config = [
    ['user.name', 'Publish Test'],
    ['user.email', 'publish-test@example.invalid'],
    ['commit.gpgSign', 'false'],
    ['tag.gpgSign', 'false'],
    ['core.hooksPath', hooks],
    ['core.autocrlf', 'false'],
  ];
  env.GIT_CONFIG_COUNT = String(config.length);
  config.forEach(([key, value], index) => {
    env[`GIT_CONFIG_KEY_${index}`] = key;
    env[`GIT_CONFIG_VALUE_${index}`] = value;
  });

  /**
   * 在隔离的 Git 环境中执行命令，并断言进程正常退出。
   * @param {string[]} args 直接传给 Git 的参数数组，不经过 shell 展开。
   * @param {string} [cwd=checkout] 命令工作目录，默认使用测试工作仓库。
   * @returns {string} 去除首尾空白的标准输出。
   * @throws {Error} 无法启动进程或 Git 返回非零状态时抛出。
   */
  function git(args, cwd = checkout) {
    const result = spawnSync('git', args, { cwd, env, encoding: 'utf8' });
    assert.ifError(result.error);
    assert.equal(result.status, 0, `git ${args.join(' ')}\n${result.stdout}${result.stderr}`);
    return result.stdout.trim();
  }

  /**
   * 创建必要的父目录并写入测试文件，已有文件会被覆盖。
   * @param {string} file 相对于目标目录的文件路径。
   * @param {string} content 要写入的完整文本。
   * @param {string} [cwd=checkout] 文件所属目录，默认使用测试工作仓库。
   * @returns {void} 通过文件系统写入生效，无返回值。
   */
  function write(file, content, cwd = checkout) {
    const target = path.join(cwd, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }

  git(['init', '--bare', '--initial-branch=master', remote], directory);
  git(['init', '--initial-branch=master', checkout], directory);
  for (const file of [...publishedFiles, 'scripts/unrelated.js', 'src/index.js', 'README.md']) {
    write(file, `initial ${file}\n`);
  }
  git(['add', '.']);
  git(['commit', '-m', 'test: initial source']);
  git(['remote', 'add', 'origin', remote]);
  git(['push', 'origin', 'master']);
  const sourceCommit = git(['rev-parse', 'HEAD']);
  git(['checkout', '--detach', sourceCommit]);

  /**
   * 改写约定的四个发布文件，模拟构建产生待提交的产物差异。
   * @returns {void} 仅更新测试工作仓库中的文件。
   */
  function build() {
    for (const file of publishedFiles) write(file, `generated ${file}\n`);
  }

  /**
   * 创建第二个本地检出，提交文档变化并推送到测试远端以制造发布竞争。
   * @param {string} [branch='master'] 接收竞争提交的测试远端分支。
   * @returns {string} 新竞争提交的完整 SHA。
   * @throws {Error} 克隆、文件写入、提交或推送失败时抛出。
   */
  function competingCommit(branch = 'master') {
    const competitor = path.join(directory, 'competitor');
    git(['clone', remote, competitor], directory);
    write('README.md', 'newer source commit\n', competitor);
    git(['add', 'README.md'], competitor);
    git(['commit', '-m', 'test: newer source'], competitor);
    git(['push', 'origin', `HEAD:refs/heads/${branch}`], competitor);
    return git(['rev-parse', 'HEAD'], competitor);
  }

  /**
   * 执行工作流中的真实发布命令，只断言进程可启动，保留退出状态供测试判断。
   * 命令可能在临时工作仓库提交产物并推送到本地裸远端。
   * @param {Object<string, string>} [extraEnv={}] 发布进程需要的附加或覆盖环境变量。
   * @returns {import('node:child_process').SpawnSyncReturns<string>} Bash 的退出状态及输出。
   * @throws {Error} 无法启动 Bash 进程时抛出。
   */
  function publish(extraEnv = {}) {
    const result = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', publishStep.run], {
      cwd: checkout,
      env: { ...env, SOURCE_COMMIT: sourceCommit, ...extraEnv },
      encoding: 'utf8',
    });
    assert.ifError(result.error);
    return result;
  }

  /**
   * 读取测试裸远端的 master 提交，不访问网络或修改分支。
   * @returns {string} 远端 master 当前指向的完整提交 SHA。
   */
  function remoteHead() {
    return git(['--git-dir', remote, 'rev-parse', 'refs/heads/master']);
  }

  return { build, competingCommit, git, hooks, publish, remote, remoteHead, sourceCommit, write };
}

/**
 * 断言发布进程成功退出，失败时附上标准输出和错误输出以便定位。
 * @param {import('node:child_process').SpawnSyncReturns<string>} result 发布命令的执行结果。
 * @returns {void} 断言成功时无返回值。
 * @throws {Error} 进程退出状态不为零时抛出断言错误。
 */
function assertSuccess(result) {
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
}

test('publishing requires successful checks and a push to master', () => {
  assert.ok(Object.hasOwn(workflow.on, 'push'));
  assert.ok(Object.hasOwn(workflow.on, 'pull_request'));
  assert.deepEqual([workflow.jobs.publish.needs].flat(), ['check']);
  assert.equal(
    workflow.jobs.publish.if,
    "github.event_name == 'push' && github.ref == 'refs/heads/master'",
  );
  assert.equal(workflow.jobs.publish.permissions.contents, 'write');
  assert.equal(publishStep.env.SOURCE_COMMIT, '${{ github.sha }}');
  const upload = workflow.jobs.check.steps.find((step) =>
    step.uses?.startsWith('actions/upload-artifact@'),
  );
  assert.deepEqual(upload.with.path.trim().split('\n').sort(), publishedFiles);
});

test('unchanged scripts do not create a publication commit', (t) => {
  const repo = fixture(t);
  assertSuccess(repo.publish());
  assert.equal(repo.git(['rev-parse', 'HEAD']), repo.sourceCommit);
  assert.equal(repo.remoteHead(), repo.sourceCommit);
  assert.equal(repo.git(['status', '--porcelain']), '');
});

test('publication commits only the generated scripts', (t) => {
  const repo = fixture(t);
  repo.build();
  repo.write('src/index.js', 'uncommitted source\n');
  repo.write('scripts/unrelated.js', 'uncommitted extra script\n');
  repo.write('README.md', 'uncommitted documentation\n');

  assertSuccess(repo.publish());
  const publication = repo.remoteHead();
  assert.notEqual(publication, repo.sourceCommit);
  assert.equal(repo.git(['rev-parse', 'HEAD']), publication);
  assert.equal(repo.git(['rev-parse', 'HEAD^']), repo.sourceCommit);
  assert.deepEqual(
    repo.git(['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD']).split('\n'),
    publishedFiles,
  );
  for (const file of publishedFiles) {
    assert.equal(repo.git(['show', `HEAD:${file}`]), `generated ${file}`);
  }
  for (const file of ['src/index.js', 'scripts/unrelated.js', 'README.md']) {
    assert.equal(repo.git(['show', `HEAD:${file}`]), `initial ${file}`);
    assert.notEqual(repo.git(['diff', '--', file]), '');
  }
  assert.equal(repo.git(['diff', '--cached']), '');
});

test('an outdated run skips publication when remote master has already advanced', (t) => {
  const repo = fixture(t);
  repo.build();
  const newerCommit = repo.competingCommit();

  assertSuccess(repo.publish());
  assert.equal(repo.remoteHead(), newerCommit);
  assert.equal(repo.git(['rev-parse', 'HEAD']), repo.sourceCommit);
  assert.notEqual(repo.git(['diff', '--', 'scripts']), '');
  assert.equal(repo.git(['diff', '--cached']), '');
});

test('a racing remote update rejects publication without overwriting newer source', (t) => {
  const repo = fixture(t);
  repo.build();
  // 先传入竞争提交的 Git 对象，hook 在发布检查之后才推进远端 master。
  const newerCommit = repo.competingCommit('competing');
  fs.writeFileSync(
    path.join(repo.hooks, 'pre-push'),
    '#!/bin/sh\nexec git --git-dir="$PUBLISH_TEST_REMOTE" update-ref refs/heads/master "$PUBLISH_TEST_COMPETING_COMMIT" "$SOURCE_COMMIT"\n',
    { mode: 0o755 },
  );

  const result = repo.publish({
    PUBLISH_TEST_REMOTE: repo.remote,
    PUBLISH_TEST_COMPETING_COMMIT: newerCommit,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /rejected/);
  assert.equal(repo.remoteHead(), newerCommit);
  assert.equal(repo.git(['rev-parse', 'HEAD^']), repo.sourceCommit);
  assert.notEqual(repo.git(['rev-parse', 'HEAD']), newerCommit);
  assert.equal(
    repo.git(['--git-dir', repo.remote, 'show', 'master:README.md']),
    'newer source commit',
  );
});
