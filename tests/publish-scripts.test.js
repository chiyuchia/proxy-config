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
  'scripts/merge-config.js',
  'scripts/rename.js',
];

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

  function git(args, cwd = checkout) {
    const result = spawnSync('git', args, { cwd, env, encoding: 'utf8' });
    assert.ifError(result.error);
    assert.equal(result.status, 0, `git ${args.join(' ')}\n${result.stdout}${result.stderr}`);
    return result.stdout.trim();
  }

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

  function build() {
    for (const file of publishedFiles) write(file, `generated ${file}\n`);
  }

  function competingCommit(branch = 'master') {
    const competitor = path.join(directory, 'competitor');
    git(['clone', remote, competitor], directory);
    write('README.md', 'newer source commit\n', competitor);
    git(['add', 'README.md'], competitor);
    git(['commit', '-m', 'test: newer source'], competitor);
    git(['push', 'origin', `HEAD:refs/heads/${branch}`], competitor);
    return git(['rev-parse', 'HEAD'], competitor);
  }

  function publish(extraEnv = {}) {
    const result = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', publishStep.run], {
      cwd: checkout,
      env: { ...env, SOURCE_COMMIT: sourceCommit, ...extraEnv },
      encoding: 'utf8',
    });
    assert.ifError(result.error);
    return result;
  }

  function remoteHead() {
    return git(['--git-dir', remote, 'rev-parse', 'refs/heads/master']);
  }

  return { build, competingCommit, git, hooks, publish, remote, remoteHead, sourceCommit, write };
}

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
});

test('unchanged scripts do not create a publication commit', (t) => {
  const repo = fixture(t);
  assertSuccess(repo.publish());
  assert.equal(repo.git(['rev-parse', 'HEAD']), repo.sourceCommit);
  assert.equal(repo.remoteHead(), repo.sourceCommit);
  assert.equal(repo.git(['status', '--porcelain']), '');
});

test('publication commits only the three generated scripts', (t) => {
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
