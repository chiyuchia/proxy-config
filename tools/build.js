/**
 * @file 将三个模块化入口构建为 Sub-Store 可直接执行的独立发布脚本。
 * 默认写入 scripts/；传入 --check 时仅检查源码与产物是否同步。
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const checkOnly = process.argv.includes('--check');

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
    description: 'Sub-Store 配置覆写脚本：筛选代理组成员、去重并注入可选 provider URL。',
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
];

for (const { name, description, usage, signature, call } of scripts) {
  const outfile = `scripts/${name}.js`;
  const result = await build({
    absWorkingDir: root,
    entryPoints: [`src/entries/${name}.js`],
    outfile,
    bundle: true,
    write: false,
    platform: 'neutral',
    format: 'iife',
    globalName: '__proxyConfigScript',
    target: 'es2022',
    charset: 'utf8',
    minify: false,
    legalComments: 'none',
    banner: {
      js: [
        '/**',
        ` * @file ${description}`,
        ` * ${usage}`,
        ` * 入口：${signature}；接入与参数见 README.md。`,
        ' *',
        ' * 此文件由 npm run build 自动生成，请修改 src/ 中的源码。',
        ` * 源码入口：src/entries/${name}.js。`,
        ' */',
      ].join('\n'),
    },
    footer: {
      js: `${signature} {\n  return __proxyConfigScript.${call};\n}`,
    },
  });

  const output = result.outputFiles[0];
  if (checkOnly) {
    const current = await readFile(output.path, 'utf8').catch((error) => {
      if (error.code === 'ENOENT') return null;
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
