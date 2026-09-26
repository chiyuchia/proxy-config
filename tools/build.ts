/**
 * @file 合并两端配置模板，并将模块化入口构建为 Sub-Store 独立发布脚本。
 * 默认写入 dist/；传入 --check 时仅检查源码与产物是否同步。
 */

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { parse, stringify } from 'yaml';
import { mergeConfigDocuments } from './merge-config/index.ts';
import { isConfigMap } from '../src/scripts/shared/value.ts';
import { readMemberPolicy } from '../src/scripts/shared/member-policy.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const checkOnly = process.argv.includes('--check');
const outputs = new Map<string, string>();

/**
 * 独立解析一份配置源，展开文件内部的 YAML 合并键并拒绝重复键。
 * @param {string} name src/configs/ 下的 YAML 文件名。
 * @returns {Promise<unknown>} 解析后的配置值，来源标记和字段由合并阶段校验。
 * @throws {Error} 文件无法读取或 YAML 无效时抛出带来源文件名的错误。
 */
async function readConfig(name: string): Promise<unknown> {
  try {
    return parse(await readFile(new URL(`../src/configs/${name}`, import.meta.url), 'utf8'), {
      merge: true,
      uniqueKeys: true,
    });
  } catch (error) {
    throw new Error(`src/configs/${name} 读取或解析失败`, { cause: error });
  }
}

const base = await readConfig('base.yaml');
for (const client of ['mihomo', 'stash'] as const) {
  const profile = await readConfig(`${client}.yaml`);
  if (!isConfigMap(profile) || profile.$profile !== client) {
    throw new Error(`src/configs/${client}.yaml 必须包含 $profile: ${client}`);
  }
  const template = mergeConfigDocuments(base, profile);
  for (const group of template['proxy-groups']) readMemberPolicy(group);
  // 不执行覆写：实际节点尚未注入，成员与运行时 provider 声明必须保留。
  outputs.set(
    `dist/${client}.yaml`,
    [
      `# ${client} 的 Sub-Store 模板，由 npm run build 自动生成。`,
      `# 来源：src/configs/base.yaml + src/configs/${client}.yaml；请修改源文件。`,
      '# 先注入订阅节点，再执行 config-overwrite.js；不要直接作为最终客户端配置使用。',
      stringify(template, { aliasDuplicateObjects: false, lineWidth: 0 }),
    ].join('\n'),
  );
}

/**
 * 提取源码中 main/operator 入口紧邻的 JSDoc，供发布脚本的外层入口复用。
 * @param {string} source 入口模块的完整源码。
 * @returns {string} 含注释定界符的原始 JSDoc，不复制文件头或其他函数的说明。
 * @throws {Error} 入口函数缺少 JSDoc，无法生成带完整说明的发布入口。
 */
function readEntrypointDocumentation(source: string): string {
  const documentation = source.match(
    /\/\*\*(?:(?!\*\/)[\s\S])*\*\/(?=\s*export (?:async )?function (?:main|operator)\()/,
  );
  if (!documentation) throw new Error('Sub-Store 入口缺少 JSDoc 注释');
  return documentation[0];
}

// Sub-Store 将脚本放进函数作用域后直接调用 main/operator，不能依赖模块加载器。
const scripts = [
  {
    name: 'config-overwrite',
    description: 'Sub-Store 配置覆写脚本：生成代理组成员、校验最终配置并移除内部声明。',
    usage: '在加载客户端模板和节点注入后执行，保留分流规则及候选顺序。',
    signature: 'function main(config)',
    call: 'main(config)',
  },
  {
    name: 'rename',
    description: 'Sub-Store 节点重命名脚本：仅按名称识别地区，整理序号、关键词和订阅名。',
    usage: '无需参数，按固定规则处理订阅或组合订阅节点，在配置文件注入节点前执行。',
    signature: 'async function operator(proxies, targetPlatform, context)',
    call: 'operator(proxies, targetPlatform, context)',
  },
  {
    name: 'dialer-proxy',
    description: 'Sub-Store 节点中转脚本：美国节点使用美西中转，其他节点使用亚太中转。',
    usage: '无需参数，自建仅处理 SS 节点，其他来源不限协议；设置中转后供配置文件注入使用。',
    signature: 'function operator(proxies, targetPlatform, context)',
    call: 'operator(proxies, targetPlatform, context)',
  },
];

for (const { name, description, usage, signature, call } of scripts) {
  const outfile = `dist/${name}.js`;
  const source = await readFile(
    new URL(`../src/scripts/entries/${name}.ts`, import.meta.url),
    'utf8',
  );
  const entryDocumentation = readEntrypointDocumentation(source);
  const result = await build({
    absWorkingDir: root,
    entryPoints: [`src/scripts/entries/${name}.ts`],
    outfile,
    bundle: true,
    write: false,
    platform: 'neutral',
    format: 'iife',
    globalName: '__proxyConfigScript',
    target: 'es2022',
    // 避免在 Sub-Store 的外层作用域新增严格模式指令；类型严格检查仍由 tsc 执行。
    tsconfigRaw: { compilerOptions: { alwaysStrict: false } },
    charset: 'utf8',
    minify: false,
    // 保留带 @preserve 的函数说明，使发布脚本与源码均可直接阅读。
    legalComments: 'inline',
    banner: {
      js: [
        '/**',
        ` * @file ${description}`,
        ` * ${usage}`,
        ` * 入口：${signature}；接入与参数见 README.md。`,
        ' *',
        ' * 此文件由 npm run build 自动生成，请修改 src/scripts/ 中的源码。',
        ` * 源码入口：src/scripts/entries/${name}.ts。`,
        ' */',
      ].join('\n'),
    },
    footer: {
      js: `${entryDocumentation}\n${signature} {\n  return __proxyConfigScript.${call};\n}`,
    },
  });

  outputs.set(outfile, result.outputFiles[0].text);
}

// 所有模板和脚本均构建成功后再写文件，避免配置错误留下部分更新的发布产物。
if (!checkOnly) await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
for (const [outfile, content] of outputs) {
  const outputUrl = new URL(`../${outfile}`, import.meta.url);
  if (checkOnly) {
    const current = await readFile(outputUrl, 'utf8').catch((error) => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    });
    if (current !== content) {
      console.error(`${outfile} 与源码不一致，请运行 npm run build。`);
      process.exitCode = 1;
    } else {
      console.log(`${outfile} 已同步`);
    }
  } else {
    await writeFile(outputUrl, content);
    console.log(`已生成 ${outfile}`);
  }
}

// 只清理已弃用的旧构建文件，不删除 dist/ 中与本构建无关的文件。
const obsolete = new URL('../dist/merge-config.js', import.meta.url);
if (checkOnly) {
  const exists = await readFile(obsolete).then(
    () => true,
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return false;
      throw error;
    },
  );
  if (exists) {
    console.error('dist/merge-config.js 已停用，请运行 npm run build 清理旧产物。');
    process.exitCode = 1;
  }
} else {
  await rm(obsolete, { force: true });
}
