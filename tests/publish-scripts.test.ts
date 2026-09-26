/**
 * @file 在临时本地 Git 仓库与模拟 GitHub CLI 中验证真实 Release 发布步骤。
 * 覆盖来源绑定、完整上传、重试与并发保护，不连接或修改项目的真实远端。
 */

import assert from 'node:assert/strict';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';
import { parse } from 'yaml';

interface WorkflowStep {
  id?: string;
  uses?: string;
  run?: string;
  env?: Record<string, string>;
  with?: Record<string, unknown>;
}

interface Workflow {
  on: Record<string, unknown>;
  jobs: {
    check: { steps: WorkflowStep[] };
    publish: {
      needs: string | string[];
      if: string;
      concurrency: { group: string; 'cancel-in-progress': boolean; queue: string };
      permissions: { contents: string };
      steps: WorkflowStep[];
    };
  };
}

interface Release {
  target: string;
  draft: boolean;
  assets: Record<string, string>;
}

interface ReleaseState {
  latest: string;
  releases: Record<string, Release>;
}

const workflow = parse(
  fs.readFileSync(new URL('../.github/workflows/check.yml', import.meta.url), 'utf8'),
) as Workflow;
const publishStep = workflow.jobs.publish.steps.find((step) => step.id === 'publish-assets')!;
const publishedFiles = [
  'dist/config-overwrite.js',
  'dist/dialer-proxy.js',
  'dist/mihomo.yaml',
  'dist/rename.js',
  'dist/stash.yaml',
];
const assetNames = publishedFiles.map((file) => path.basename(file));

// 模拟 GitHub 的草稿、附件与 latest；异常时保留部分附件，供重试验证。
const ghStub = String.raw`
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const args = process.argv.slice(2);
const stateFile = process.env.PUBLISH_TEST_STATE;
const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
fs.appendFileSync(process.env.PUBLISH_TEST_CALLS, JSON.stringify(args) + '\n');
const value = (flag) => args[args.indexOf(flag) + 1];
const save = () => fs.writeFileSync(stateFile, JSON.stringify(state));
const fail = (message) => { console.error(message); process.exit(1); };
assert.equal(process.env.GH_TOKEN, 'test-token');

if (args[0] === 'api') {
  assert.ok(args.includes('--paginate'));
  assert.ok(args.includes('repos/example/proxy-config/releases?per_page=100'));
  assert.ok(args.includes('--jq'));
  if (process.env.PUBLISH_TEST_FAIL === 'api') fail('HTTP 403: forbidden');
  const tag = 'build-' + process.env.SOURCE_COMMIT;
  assert.ok(value('--jq').includes(tag));
  const release = state.releases[tag];
  if (release) console.log(String(release.draft) + '\t' + release.target);
  process.exit(0);
}

assert.equal(args[0], 'release');
assert.equal(value('--repo'), 'example/proxy-config');
const command = args[1];
const tag = args[2];
if (command === 'create') {
  assert.ok(!state.releases[tag], '同一标签不能创建第二个 Release');
  assert.ok(args.includes('--draft'));
  assert.equal(value('--target'), process.env.SOURCE_COMMIT);
  assert.ok(fs.readFileSync(value('--notes-file'), 'utf8').includes(process.env.SOURCE_COMMIT));
  state.releases[tag] = { target: value('--target'), draft: true, assets: {} };
  save();
} else if (command === 'upload') {
  const release = state.releases[tag];
  assert.ok(release.draft, '只能改写尚未发布的草稿');
  assert.ok(args.includes('--clobber'));
  const files = args.slice(3).filter((arg, index, all) =>
    !arg.startsWith('--') && all[index - 1] !== '--repo');
  for (const file of files) {
    release.assets[path.basename(file)] = fs.readFileSync(file, 'utf8');
    save();
    if (process.env.PUBLISH_TEST_FAIL === 'upload') fail('模拟附件上传失败');
  }
  if (process.env.PUBLISH_TEST_EXTRA_ASSET) {
    release.assets['unexpected.js'] = 'unexpected';
    save();
  }
  if (process.env.PUBLISH_TEST_COMPETING_COMMIT) {
    const result = spawnSync('git', ['--git-dir', process.env.PUBLISH_TEST_REMOTE,
      'update-ref', 'refs/heads/master', process.env.PUBLISH_TEST_COMPETING_COMMIT],
      { env: process.env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
} else if (command === 'view') {
  assert.equal(value('--json'), 'assets');
  assert.equal(value('--jq'), '[.assets[].name] | sort | .[]');
  console.log(Object.keys(state.releases[tag].assets).sort().join('\n'));
} else if (command === 'edit') {
  assert.ok(args.includes('--draft=false'));
  assert.ok(args.includes('--latest'));
  assert.ok(state.releases[tag].draft);
  // GitHub 在发布新标签的 Release 时创建标签；已有标签保持不变。
  const exists = spawnSync('git', ['--git-dir', process.env.PUBLISH_TEST_REMOTE,
    'show-ref', '--verify', '--quiet', 'refs/tags/' + tag], { env: process.env });
  if (exists.status !== 0) {
    const result = spawnSync('git', ['--git-dir', process.env.PUBLISH_TEST_REMOTE,
      'update-ref', 'refs/tags/' + tag, state.releases[tag].target],
      { env: process.env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  state.releases[tag].draft = false;
  state.latest = tag;
  save();
} else {
  fail('未预期的 gh 命令: ' + JSON.stringify(args));
}
`;

/**
 * 创建隔离的工作仓库、裸远端和 GitHub CLI 模拟程序，结束后自动清理。
 * dist 从首个提交起即被忽略；所有操作和服务状态仅存在于临时目录。
 * @param {import('node:test').TestContext} t 用于注册清理回调的测试上下文。
 * @returns {Object} 源提交、文件与 Git 操作、Release 状态和发布辅助函数。
 * @throws {Error} 文件操作或初始化 Git 命令失败时抛出。
 */
function fixture(t: TestContext) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'proxy-config-publish-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const checkout = path.join(directory, 'checkout');
  const remote = path.join(directory, 'remote.git');
  const hooks = path.join(directory, 'hooks');
  const bin = path.join(directory, 'bin');
  const stateFile = path.join(directory, 'releases.json');
  const callsFile = path.join(directory, 'calls.jsonl');
  fs.mkdirSync(hooks);
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'gh'), `#!${process.execPath}\n${ghStub}`, { mode: 0o755 });
  fs.writeFileSync(callsFile, '');

  // 不继承用户的 Git 目录、身份、签名或 hook 配置。
  const env: NodeJS.ProcessEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
  );
  Object.assign(env, {
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    LC_ALL: 'C',
    PATH: `${bin}${path.delimiter}${process.env.PATH}`,
    GH_TOKEN: 'test-token',
    GITHUB_REPOSITORY: 'example/proxy-config',
    PUBLISH_TEST_STATE: stateFile,
    PUBLISH_TEST_CALLS: callsFile,
    PUBLISH_TEST_REMOTE: remote,
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
   * 在隔离的 Git 环境中执行命令，并断言正常退出。
   * @param {string[]} args 直接传给 Git 的参数数组，不经过 shell 展开。
   * @param {string} [cwd=checkout] 命令工作目录，默认使用测试工作仓库。
   * @returns {string} 去除首尾空白的标准输出。
   * @throws {Error} 无法启动进程或 Git 返回非零状态时抛出。
   */
  function git(args: string[], cwd: string = checkout): string {
    const result = spawnSync('git', args, { cwd, env, encoding: 'utf8' });
    assert.ifError(result.error);
    assert.equal(result.status, 0, `git ${args.join(' ')}\n${result.stdout}${result.stderr}`);
    return result.stdout.trim();
  }

  /**
   * 创建父目录并写入测试文件，已有文件会被覆盖。
   * @param {string} file 相对于目标目录的文件路径。
   * @param {string} content 要写入的完整文本。
   * @param {string} [cwd=checkout] 文件所属目录，默认使用测试工作仓库。
   * @returns {void} 通过文件系统写入生效，无返回值。
   */
  function write(file: string, content: string, cwd: string = checkout): void {
    const target = path.join(cwd, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }

  git(['init', '--bare', '--initial-branch=master', remote], directory);
  git(['init', '--initial-branch=master', checkout], directory);
  write('.gitignore', 'dist/\n');
  write('src/index.ts', 'initial source\n');
  write('README.md', 'initial documentation\n');
  for (const file of [...publishedFiles, 'dist/unrelated.js']) write(file, `generated ${file}\n`);
  git(['add', '.']);
  git(['commit', '-m', 'test: initial source']);
  git(['remote', 'add', 'origin', remote]);
  git(['push', 'origin', 'master']);
  const sourceCommit = git(['rev-parse', 'HEAD']);
  const tag = `build-${sourceCommit}`;
  git(['checkout', '--detach', sourceCommit]);
  fs.writeFileSync(
    stateFile,
    JSON.stringify({
      latest: 'previous',
      releases: {
        previous: { target: sourceCommit, draft: false, assets: { 'old.js': 'old release' } },
      },
    } satisfies ReleaseState),
  );

  /**
   * 创建第二个检出并提交文档变化，推送到本地远端以制造发布竞争。
   * @param {string} [branch='master'] 接收竞争提交的测试远端分支。
   * @returns {string} 新竞争提交的完整 SHA。
   * @throws {Error} 克隆、文件写入、提交或推送失败时抛出。
   */
  function competingCommit(branch: string = 'master'): string {
    const competitor = path.join(directory, 'competitor');
    git(['clone', remote, competitor], directory);
    write('README.md', 'newer source commit\n', competitor);
    git(['add', 'README.md'], competitor);
    git(['commit', '-m', 'test: newer source'], competitor);
    git(['push', 'origin', `HEAD:refs/heads/${branch}`], competitor);
    return git(['rev-parse', 'HEAD'], competitor);
  }

  /**
   * 执行工作流中的真实发布命令，使用模拟 gh 和本地裸远端。
   * @param {Object<string, string>} [extraEnv={}] 发布进程的附加或覆盖环境变量。
   * @returns {import('node:child_process').SpawnSyncReturns<string>} Bash 退出状态及输出。
   * @throws {Error} 无法启动 Bash 进程时抛出。
   */
  function publish(extraEnv: Record<string, string> = {}): SpawnSyncReturns<string> {
    const result = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', publishStep.run!], {
      cwd: checkout,
      env: { ...env, SOURCE_COMMIT: sourceCommit, ...extraEnv },
      encoding: 'utf8',
    });
    assert.ifError(result.error);
    return result;
  }

  /**
   * 读取模拟 GitHub 的 Release 和 latest 状态，不修改文件。
   * @returns {ReleaseState} 当前模拟服务状态。
   */
  function state(): ReleaseState {
    return JSON.parse(fs.readFileSync(stateFile, 'utf8')) as ReleaseState;
  }

  /**
   * 为本次构建设置一个已存在的 Release，保留其他版本与 latest。
   * @param {Release} release 已存在的 Release 状态。
   * @returns {void} 将测试状态写入模拟服务。
   */
  function seedRelease(release: Release): void {
    const current = state();
    current.releases[tag] = release;
    fs.writeFileSync(stateFile, JSON.stringify(current));
  }

  /**
   * 读取所有 GitHub CLI 调用，保留调用顺序和原始参数边界。
   * @returns {string[][]} 每个元素是一条 CLI 调用的参数数组。
   */
  function calls(): string[][] {
    const content = fs.readFileSync(callsFile, 'utf8').trim();
    return content ? content.split('\n').map((line) => JSON.parse(line) as string[]) : [];
  }

  /**
   * 读取测试裸远端的 master 提交，不访问网络或修改分支。
   * @returns {string} 远端 master 当前指向的完整 SHA。
   */
  function remoteHead(): string {
    return git(['--git-dir', remote, 'rev-parse', 'refs/heads/master']);
  }

  return {
    calls,
    checkout,
    competingCommit,
    git,
    publish,
    remote,
    remoteHead,
    seedRelease,
    sourceCommit,
    state,
    tag,
    write,
  };
}

/**
 * 断言发布进程成功退出，失败时附上标准输出和错误输出。
 * @param {import('node:child_process').SpawnSyncReturns<string>} result 发布命令的执行结果。
 * @returns {void} 断言成功时无返回值。
 * @throws {Error} 进程退出状态不为零时抛出断言错误。
 */
function assertSuccess(result: SpawnSyncReturns<string>): void {
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
}

test('publishing requires successful checks and a master branch push, with serialized releases', () => {
  assert.deepEqual(workflow.on.push, { branches: ['**'] });
  assert.ok(Object.hasOwn(workflow.on, 'pull_request'));
  assert.deepEqual([workflow.jobs.publish.needs].flat(), ['check']);
  assert.equal(
    workflow.jobs.publish.if,
    "github.event_name == 'push' && github.ref == 'refs/heads/master'",
  );
  assert.deepEqual(workflow.jobs.publish.concurrency, {
    group: 'publish-release',
    'cancel-in-progress': false,
    queue: 'max',
  });
  assert.equal(workflow.jobs.publish.permissions.contents, 'write');
  assert.equal(publishStep.env!.SOURCE_COMMIT, '${{ github.sha }}');
  assert.equal(publishStep.env!.GH_TOKEN, '${{ secrets.GITHUB_TOKEN }}');
  assert.equal(publishStep.env!.GITHUB_REPOSITORY, '${{ github.repository }}');
  const upload = workflow.jobs.check.steps.find((step) =>
    step.uses?.startsWith('actions/upload-artifact@'),
  );
  assert.deepEqual((upload!.with!.path as string).trim().split('\n').sort(), publishedFiles);
  assert.equal(upload!.with!['if-no-files-found'], 'error');
  const download = workflow.jobs.publish.steps.find((step) =>
    step.uses?.startsWith('actions/download-artifact@'),
  );
  assert.equal(download!.with!.name, upload!.with!.name);
  assert.equal(download!.with!.path, 'dist');
  const checkout = workflow.jobs.publish.steps.find((step) =>
    step.uses?.startsWith('actions/checkout@'),
  );
  assert.equal(checkout!.with!.ref, '${{ github.sha }}');
});

test('publishing uploads exactly five assets tied to the source commit without committing dist', (t) => {
  const repo = fixture(t);
  assertSuccess(repo.publish());
  const state = repo.state();
  assert.equal(state.latest, repo.tag);
  assert.equal(state.releases[repo.tag].target, repo.sourceCommit);
  assert.equal(state.releases[repo.tag].draft, false);
  assert.deepEqual(Object.keys(state.releases[repo.tag].assets).sort(), assetNames);
  for (const file of publishedFiles) {
    assert.equal(state.releases[repo.tag].assets[path.basename(file)], `generated ${file}\n`);
  }
  assert.equal(repo.remoteHead(), repo.sourceCommit);
  assert.equal(repo.git(['rev-parse', 'HEAD']), repo.sourceCommit);
  assert.equal(repo.git(['status', '--porcelain']), '');
  assert.equal(repo.git(['ls-files', 'dist']), '');
  assert.equal(
    repo.git(['--git-dir', repo.remote, 'rev-parse', `refs/tags/${repo.tag}`]),
    repo.sourceCommit,
  );
  assert.deepEqual(
    repo.calls().map((args) => args.slice(0, 2)),
    [
      ['api', '--paginate'],
      ['release', 'create'],
      ['release', 'upload'],
      ['release', 'view'],
      ['release', 'edit'],
    ],
  );
});

test('rerunning an already published release does not replace assets or change latest', (t) => {
  const repo = fixture(t);
  assertSuccess(repo.publish());
  const before = repo.state();
  const callCount = repo.calls().length;
  repo.write('dist/rename.js', 'different local build\n');
  assertSuccess(repo.publish());
  assert.deepEqual(repo.state(), before);
  assert.deepEqual(
    repo
      .calls()
      .slice(callCount)
      .map((args) => args[0]),
    ['api'],
  );
  assert.equal(repo.remoteHead(), repo.sourceCommit);
});

test('a partial upload leaves latest unchanged and a retry completes the same draft', (t) => {
  const repo = fixture(t);
  assert.notEqual(repo.publish({ PUBLISH_TEST_FAIL: 'upload' }).status, 0);
  const partial = repo.state();
  assert.equal(partial.latest, 'previous');
  assert.equal(partial.releases[repo.tag].draft, true);
  assert.equal(Object.keys(partial.releases[repo.tag].assets).length, 1);
  assert.ok(!repo.calls().some((args) => args[1] === 'edit'));
  assertSuccess(repo.publish());
  assert.equal(repo.state().latest, repo.tag);
  assert.deepEqual(Object.keys(repo.state().releases[repo.tag].assets).sort(), assetNames);
  assert.equal(repo.calls().filter((args) => args[1] === 'create').length, 1);
  assert.equal(repo.calls().filter((args) => args[1] === 'upload').length, 2);
});

test('an outdated run skips publication when master has already advanced', (t) => {
  const repo = fixture(t);
  const newerCommit = repo.competingCommit();
  assertSuccess(repo.publish());
  assert.equal(repo.remoteHead(), newerCommit);
  assert.equal(repo.state().latest, 'previous');
  assert.equal(repo.state().releases[repo.tag], undefined);
  assert.deepEqual(repo.calls(), []);
});

test('master advancing during upload leaves the new release in draft and preserves latest', (t) => {
  const repo = fixture(t);
  const newerCommit = repo.competingCommit('competing');
  assertSuccess(repo.publish({ PUBLISH_TEST_COMPETING_COMMIT: newerCommit }));
  assert.equal(repo.remoteHead(), newerCommit);
  assert.equal(repo.state().latest, 'previous');
  assert.equal(repo.state().releases[repo.tag].draft, true);
  assert.deepEqual(Object.keys(repo.state().releases[repo.tag].assets).sort(), assetNames);
  assert.ok(!repo.calls().some((args) => args[1] === 'edit'));
});

test('API permission errors stop publication instead of being treated as a missing release', (t) => {
  const repo = fixture(t);
  const result = repo.publish({ PUBLISH_TEST_FAIL: 'api' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /403/);
  assert.equal(repo.state().latest, 'previous');
  assert.equal(repo.state().releases[repo.tag], undefined);
  assert.ok(repo.calls().every((args) => args[0] === 'api'));
});

test('an existing draft for a different source commit cannot receive uploaded assets', (t) => {
  const repo = fixture(t);
  repo.seedRelease({ target: '0'.repeat(40), draft: true, assets: {} });
  const before = repo.state();
  assert.notEqual(repo.publish().status, 0);
  assert.deepEqual(repo.state(), before);
  assert.ok(repo.calls().every((args) => args[0] === 'api'));
});

test('a remote tag pointing to another commit prevents release creation', (t) => {
  const repo = fixture(t);
  const anotherCommit = repo.competingCommit('competing');
  repo.git(['--git-dir', repo.remote, 'update-ref', `refs/tags/${repo.tag}`, anotherCommit]);
  assert.notEqual(repo.publish().status, 0);
  assert.equal(repo.state().latest, 'previous');
  assert.equal(repo.state().releases[repo.tag], undefined);
  assert.deepEqual(repo.calls(), []);
});

test('a matching annotated tag is accepted after resolving its commit', (t) => {
  const repo = fixture(t);
  repo.git(['tag', '-a', repo.tag, '-m', 'existing annotated build tag', repo.sourceCommit]);
  repo.git(['push', 'origin', `refs/tags/${repo.tag}`]);
  assertSuccess(repo.publish());
  assert.equal(repo.state().latest, repo.tag);
});

test('a published release without its source tag stops instead of claiming success', (t) => {
  const repo = fixture(t);
  repo.seedRelease({ target: repo.sourceCommit, draft: false, assets: {} });
  const before = repo.state();
  assert.notEqual(repo.publish().status, 0);
  assert.deepEqual(repo.state(), before);
  assert.ok(repo.calls().every((args) => args[0] === 'api'));
});

test('missing or empty config templates stop publication before any GitHub API call', (t) => {
  const repo = fixture(t);
  fs.unlinkSync(path.join(repo.checkout, 'dist/stash.yaml'));
  assert.notEqual(repo.publish().status, 0);
  repo.write('dist/stash.yaml', '');
  assert.notEqual(repo.publish().status, 0);
  assert.equal(repo.state().latest, 'previous');
  assert.equal(repo.state().releases[repo.tag], undefined);
  assert.deepEqual(repo.calls(), []);
});

test('unexpected release assets prevent a draft from becoming latest', (t) => {
  const repo = fixture(t);
  assert.notEqual(repo.publish({ PUBLISH_TEST_EXTRA_ASSET: '1' }).status, 0);
  assert.equal(repo.state().latest, 'previous');
  assert.equal(repo.state().releases[repo.tag].draft, true);
  assert.ok(!repo.calls().some((args) => args[1] === 'edit'));
});
