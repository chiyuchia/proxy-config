/**
 * @file 将模块化入口构建为 Sub-Store 可直接执行的独立发布脚本。
 * 默认写入 scripts/；传入 --check 时仅检查源码与产物是否同步。
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const checkOnly = process.argv.includes('--check');

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
    name: 'merge-config',
    description: 'Sub-Store 远程配置合并脚本：读取公共配置和客户端差异，合并并校验引用。',
    usage: '通过 client 参数选择 Mihomo 或 Stash，作为独立操作在 config-overwrite 前执行。',
    signature: 'async function main(config)',
    call: 'main(config)',
  },
  {
    name: 'config-overwrite',
    description: 'Sub-Store 配置覆写脚本：生成代理组成员、校验最终配置并移除内部声明。',
    usage: '在配置合并和节点注入后执行，保留分流规则及候选顺序。',
    signature: 'function main(config)',
    call: 'main(config)',
  },
  {
    name: 'rename',
    description: 'Sub-Store 节点重命名脚本：仅按名称识别地区，整理序号、关键词和订阅名。',
    usage: '用于订阅或组合订阅的节点处理，在配置文件注入节点前执行。',
    signature: 'async function operator(proxies, targetPlatform, context)',
    call: 'operator(proxies, targetPlatform, context)',
  },
  {
    name: 'dialer-proxy',
    description: 'Sub-Store 节点中转脚本：为自建落地节点或 Edge 订阅设置 dialer-proxy。',
    usage: '通过 mode 选择 self-hosted 或 edge，在来源订阅中设置中转，再供配置文件注入使用。',
    signature: 'function operator(proxies, targetPlatform, context)',
    call: 'operator(proxies, targetPlatform, context)',
  },
];

for (const { name, description, usage, signature, call } of scripts) {
  const outfile = `scripts/${name}.js`;
  const source = await readFile(new URL(`../src/entries/${name}.ts`, import.meta.url), 'utf8');
  const entryDocumentation = readEntrypointDocumentation(source);
  const result = await build({
    absWorkingDir: root,
    entryPoints: [`src/entries/${name}.ts`],
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
        ' * 此文件由 npm run build 自动生成，请修改 src/ 中的源码。',
        ` * 源码入口：src/entries/${name}.ts。`,
        ' */',
      ].join('\n'),
    },
    footer: {
      js: `${entryDocumentation}\n${signature} {\n  return __proxyConfigScript.${call};\n}`,
    },
  });

  const output = result.outputFiles[0];
  if (checkOnly) {
    const current = await readFile(output.path, 'utf8').catch((error) => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    });
    if (current !== output.text) {
      console.error(`${outfile} 与源码不一致，请运行 npm run build 并一同提交生成文件。`);
      process.exitCode = 1;
    } else {
      console.log(`${outfile} 已同步`);
    }
  } else {
    await writeFile(output.path, output.contents);
    console.log(`已生成 ${outfile}`);
  }
}
