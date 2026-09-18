/**
 * Sub-Store「Mihomo 配置」的远程合并脚本，放在 config_overwrite.js 之前。
 * 参数：client=mihomo 或 client=stash（必填）；可选 configBaseUrl、baseUrl、profileUrl、timeout。
 * 三份 YAML 在仓库维护，服务端按客户端读取 base + profile；只保留输入中的订阅 proxies。
 * 本脚本和 config_overwrite.js 各自使用 main(config)，应配置为两个独立的脚本操作。
 */
function isConfigMap(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function configError(message) {
  throw new Error(`[merge-config] ${message}`);
}

function checkConfigKey(key) {
  if (['__proto__', 'constructor', 'prototype'].includes(key)) {
    configError(`不允许的配置键：${key}`);
  }
}

function copyConfigValue(value) {
  if (Array.isArray(value)) return value.map(copyConfigValue);
  if (isConfigMap(value)) {
    const result = {};
    for (const [key, item] of Object.entries(value)) {
      checkConfigKey(key);
      result[key] = copyConfigValue(item);
    }
    return result;
  }
  if (value === null || ['string', 'boolean'].includes(typeof value)) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  configError('配置只能包含 YAML 映射、数组和普通标量');
}

function requireArray(value, path) {
  if (!Array.isArray(value)) configError(`${path} 必须是数组`);
  return value;
}

function isDeletePatch(value) {
  return isConfigMap(value) && Object.hasOwn(value, '$delete');
}

function validateDeletePatch(patch, path) {
  if (patch.$delete !== true || Object.keys(patch).length !== 1) {
    configError(`${path} 删除字段时只能填写 {$delete: true}`);
  }
}

function patchConfigArray(original, patch, path) {
  const allowed = ['$remove', '$prepend', '$append', '$insert-before'];
  for (const key of Object.keys(patch)) {
    if (!allowed.includes(key)) configError(`${path} 未知数组操作：${key}`);
  }
  let result = copyConfigValue(requireArray(original, path));
  if (Object.hasOwn(patch, '$remove')) {
    const removed = requireArray(patch.$remove, `${path}.$remove`);
    result = result.filter((item) => !removed.some((value) =>
      JSON.stringify(item) === JSON.stringify(value)
    ));
  }
  if (Object.hasOwn(patch, '$prepend')) {
    result = [...copyConfigValue(requireArray(patch.$prepend, `${path}.$prepend`)), ...result];
  }
  if (Object.hasOwn(patch, '$append')) {
    result.push(...copyConfigValue(requireArray(patch.$append, `${path}.$append`)));
  }
  if (Object.hasOwn(patch, '$insert-before')) {
    if (!isConfigMap(patch['$insert-before'])) configError(`${path}.$insert-before 必须是映射`);
    for (const [anchor, values] of Object.entries(patch['$insert-before'])) {
      const index = result.indexOf(anchor);
      if (index < 0) configError(`${path} 找不到插入位置：${anchor}`);
      result.splice(index, 0, ...copyConfigValue(requireArray(values, `${path}.$insert-before.${anchor}`)));
    }
  }
  return result;
}

function mergeConfigValue(original, patch, path = '') {
  if (!isConfigMap(patch)) return copyConfigValue(patch);
  if (Object.keys(patch).some((key) => key.startsWith('$'))) {
    return patchConfigArray(original, patch, path);
  }
  const result = isConfigMap(original) ? copyConfigValue(original) : {};
  for (const [key, value] of Object.entries(patch)) {
    checkConfigKey(key);
    const field = path ? `${path}.${key}` : key;
    if (isDeletePatch(value)) {
      validateDeletePatch(value, field);
      if (!Object.hasOwn(result, key)) configError(`${field} 不存在，无法删除`);
      delete result[key];
    } else if (!path && key === 'proxy-groups') {
      result[key] = mergeProxyGroups(result[key] ?? [], value);
    } else {
      result[key] = mergeConfigValue(result[key], value, field);
    }
  }
  return result;
}

function checkGroupNames(groups, label) {
  const names = new Set();
  for (const group of requireArray(groups, label)) {
    if (!isConfigMap(group) || typeof group.name !== 'string' || !group.name.trim()) {
      configError(`${label} 的每个代理组必须有 name`);
    }
    if (names.has(group.name)) configError(`${label} 代理组重名：${group.name}`);
    names.add(group.name);
  }
  return names;
}

function mergeProxyGroups(original, patches) {
  checkGroupNames(original, 'base.proxy-groups');
  checkGroupNames(patches, 'profile.proxy-groups');
  const result = copyConfigValue(original);
  for (const patch of patches) {
    const { name, $before, $after, $delete, ...fields } = patch;
    const index = result.findIndex((group) => group.name === name);
    for (const key of Object.keys(fields)) {
      if (key.startsWith('$')) configError(`${name} 未知代理组操作：${key}`);
    }
    if (Object.hasOwn(patch, '$delete')) {
      if ($delete !== true || Object.keys(patch).length !== 2 || index < 0) {
        configError(`${name} 删除代理组时必须仅填写已有 name 和 $delete: true`);
      }
      result.splice(index, 1);
      continue;
    }
    if (Object.hasOwn(patch, '$before') && Object.hasOwn(patch, '$after')) {
      configError(`${name} 不能同时使用 $before 和 $after`);
    }
    const group = mergeConfigValue(index < 0 ? {} : result[index], { name, ...fields }, `proxy-groups.${name}`);
    const position = Object.hasOwn(patch, '$before') ? '$before'
      : Object.hasOwn(patch, '$after') ? '$after' : null;
    if (position) {
      const anchor = position === '$before' ? $before : $after;
      if (typeof anchor !== 'string' || anchor === name) configError(`${name} 无效的 ${position}`);
      if (index >= 0) result.splice(index, 1);
      const anchorIndex = result.findIndex((item) => item.name === anchor);
      if (anchorIndex < 0) configError(`${name} 找不到代理组位置：${anchor}`);
      result.splice(anchorIndex + (position === '$after' ? 1 : 0), 0, group);
    } else if (index < 0) {
      result.push(group);
    } else {
      result[index] = group;
    }
  }
  return result;
}

function validateMergedConfig(config) {
  const groupNames = checkGroupNames(config['proxy-groups'], '合并结果');
  const targets = new Set([...groupNames, 'DIRECT', 'REJECT', 'REJECT-DROP', 'PASS', 'COMPATIBLE', 'GLOBAL']);
  for (const proxy of config.proxies ?? []) {
    if (!isConfigMap(proxy) || typeof proxy.name !== 'string') configError('订阅节点必须有 name');
    if (targets.has(proxy.name)) configError(`节点或代理组重名：${proxy.name}`);
    targets.add(proxy.name);
  }
  for (const group of config['proxy-groups']) {
    if (typeof group.type !== 'string') configError(`${group.name} 缺少代理组 type`);
    for (const name of requireArray(group.proxies ?? [], `${group.name}.proxies`)) {
      if (!targets.has(name)) configError(`${group.name} 引用了不存在的代理或组：${name}`);
    }
    for (const name of requireArray(group.use ?? [], `${group.name}.use`)) {
      if (!Object.hasOwn(config['proxy-providers'] ?? {}, name)) {
        configError(`${group.name} 引用了不存在的 proxy-provider：${name}`);
      }
    }
  }
  for (const rule of requireArray(config.rules, 'rules')) {
    if (typeof rule !== 'string') configError('rules 中必须是规则字符串');
    const parts = rule.split(',');
    const target = parts[parts.length - (parts[parts.length - 1] === 'no-resolve' ? 2 : 1)];
    if (!targets.has(target)) configError(`规则引用了不存在的策略：${target}`);
    if (parts[0] === 'RULE-SET' && !Object.hasOwn(config['rule-providers'] ?? {}, parts[1])) {
      configError(`规则引用了不存在的 rule-provider：${parts[1]}`);
    }
  }
}

function mergeConfigDocuments(base, profile, proxies) {
  if (!isConfigMap(base) || base.$base !== true) configError('base.yaml 必须包含 $base: true');
  if (!isConfigMap(profile) || !['mihomo', 'stash'].includes(profile.$profile)) {
    configError('客户端差异必须包含 $profile: mihomo 或 stash');
  }
  // 标记可检测远程来源返回 HTML、颠倒的文件或错误的客户端差异，输出中不保留标记。
  const { $base, ...common } = base;
  const { $profile, ...overlay } = profile;
  if (Object.hasOwn(common, 'proxies') || Object.hasOwn(overlay, 'proxies')) {
    configError('配置源不能包含 proxies，节点由 Sub-Store 注入');
  }
  const merged = mergeConfigValue(mergeConfigValue({}, common), overlay);
  if (proxies !== undefined) {
    merged.proxies = copyConfigValue(requireArray(proxies, '输入 proxies'));
  }
  validateMergedConfig(merged);
  return merged;
}

async function readConfigSource(url, label, timeout) {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
    configError(`${label} 必须使用 HTTP(S) URL`);
  }
  const response = await $substore.http.get({ url, timeout });
  const status = Number(response?.statusCode ?? response?.status);
  if (!(status >= 200 && status < 300)) configError(`${label} 下载失败：HTTP ${status}`);
  if (typeof response.body !== 'string' || !response.body.trim()) configError(`${label} 内容为空`);
  try {
    return ProxyUtils.yaml.safeLoad(response.body);
  } catch (error) {
    configError(`${label} YAML 解析失败：${error.message}`);
  }
}

async function main(config) {
  const args = typeof $arguments === 'object' && $arguments ? $arguments : {};
  const client = typeof args.client === 'string' ? args.client.trim().toLowerCase() : '';
  if (!['mihomo', 'stash'].includes(client)) configError('请设置 client=mihomo 或 client=stash');
  const timeout = args.timeout === undefined ? 10000 : Number(args.timeout);
  if (!Number.isFinite(timeout) || timeout <= 0) configError('timeout 必须是正数（毫秒）');
  const root = args.configBaseUrl ?? 'https://raw.githubusercontent.com/chiyuchia/proxy-config/master/config';
  if (typeof root !== 'string') configError('configBaseUrl 必须是 URL 字符串');
  const directory = root.replace(/\/+$/, '');
  const [base, profile] = await Promise.all([
    readConfigSource(args.baseUrl ?? `${directory}/base.yaml`, 'base.yaml', timeout),
    readConfigSource(args.profileUrl ?? `${directory}/${client}.yaml`, `${client}.yaml`, timeout),
  ]);
  if (profile?.$profile !== client) configError(`客户端差异与 client=${client} 不一致`);
  return mergeConfigDocuments(base, profile, config?.proxies);
}
