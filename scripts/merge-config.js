/**
 * @file Sub-Store 远程配置合并脚本：读取公共配置和客户端差异，合并并校验引用。
 * 通过 client 参数选择 Mihomo 或 Stash，作为独立操作在 config-overwrite 前执行。
 * 入口：async function main(config)；接入与参数见 README.md。
 *
 * 此文件由 npm run build 自动生成，请修改 src/ 中的源码。
 * 源码入口：src/entries/merge-config.js。
 */
var __proxyConfigScript = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/entries/merge-config.js
  var merge_config_exports = {};
  __export(merge_config_exports, {
    main: () => main
  });

  // src/merge-config/value.js
  /**
   * 通过对象类型标签判断值是否可按配置映射处理，不检查其键或内部成员。
   *
   * @preserve
   * @param {*} value 待判断的值，可为任意类型。
   * @returns {boolean} 对象类型标签为 `[object Object]` 时返回 true，否则返回 false。
   */
  function isConfigMap(value) {
    return Object.prototype.toString.call(value) === "[object Object]";
  }
  /**
   * 添加合并模块前缀并抛出错误，中止当前配置处理。
   *
   * @preserve
   * @param {string} message 不含模块前缀的错误说明。
   * @returns {never} 始终抛出异常，不正常返回。
   * @throws {Error} 消息带有 `[merge-config]` 前缀的配置错误。
   */
  function configError(message) {
    throw new Error(`[merge-config] ${message}`);
  }
  /**
   * 拒绝可能影响对象原型的配置键，不修改传入值。
   *
   * @preserve
   * @param {string} key 待复制或合并的映射键。
   * @returns {void} 键不在禁止列表中时正常返回。
   * @throws {Error} 键为 __proto__、constructor 或 prototype 时抛出配置错误。
   */
  function checkConfigKey(key) {
    if (["__proto__", "constructor", "prototype"].includes(key)) {
      configError(`不允许的配置键：${key}`);
    }
  }
  /**
   * 递归复制配置映射和数组，保留允许的标量值，不修改输入或保留容器引用。
   *
   * @preserve
   * @param {*} value 待复制的无循环配置值，仅支持映射、数组、null、字符串、布尔值和有限数值。
   * @returns {Object<string, *>|Array<*>|string|boolean|number|null} 独立的容器副本或原标量值。
   * @throws {Error} 遇到禁止的映射键或不支持的值类型时抛出配置错误。
   */
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
    if (value === null || ["string", "boolean"].includes(typeof value)) return value;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    configError("配置只能包含 YAML 映射、数组和普通标量");
  }
  /**
   * 校验值是否为数组，供调用方使用统一的配置路径错误信息。
   *
   * @preserve
   * @param {*} value 待校验的值，不检查数组元素类型。
   * @param {string} path 用于错误信息的字段路径或来源说明。
   * @returns {Array<*>} 传入的原数组引用，不创建副本。
   * @throws {Error} value 不是数组时抛出配置错误。
   */
  function requireArray(value, path) {
    if (!Array.isArray(value)) configError(`${path} 必须是数组`);
    return value;
  }

  // src/merge-config/validation.js
  /**
   * 检查代理组列表及名称的有效性，收集名称并拒绝同一列表中的重复项。
   * 名称只用 trim 判断是否为空，重复比较仍使用原始字符串，不修改任何组。
   *
   * @preserve
   * @param {*} groups 待校验的代理组数组，每个元素须为带非空字符串 name 的映射。
   * @param {string} label 错误信息中的来源说明，例如 base.proxy-groups。
   * @returns {Set<string>} 按首次出现顺序收集的原始组名集合。
   * @throws {Error} 输入不是数组、组缺少有效名称或组名重复时抛出配置错误。
   */
  function checkGroupNames(groups, label) {
    const names = /* @__PURE__ */ new Set();
    for (const group of requireArray(groups, label)) {
      if (!isConfigMap(group) || typeof group.name !== "string" || !group.name.trim()) {
        configError(`${label} 的每个代理组必须有 name`);
      }
      if (names.has(group.name)) configError(`${label} 代理组重名：${group.name}`);
      names.add(group.name);
    }
    return names;
  }
  /**
   * 校验当前配置的组名、节点名冲突、组 type 字段，以及成员、provider 和规则策略引用。
   * 只检查已提供的数据，不修改配置，也不校验节点的 dialer-proxy 或覆写阶段的成员声明。
   *
   * @preserve
   * @param {Object<string, *>} config 含 proxy-groups 与 rules 的配置；节点和 provider 定义可省略。
   * @returns {void} 当前配置通过上述结构与引用检查时正常返回。
   * @throws {Error} 名称冲突、必需字段或列表类型无效，或引用目标不存在时抛出配置错误。
   */
  function validateMergedConfig(config) {
    const groupNames = checkGroupNames(config["proxy-groups"], "合并结果");
    const targets = /* @__PURE__ */ new Set([
      ...groupNames,
      "DIRECT",
      "REJECT",
      "REJECT-DROP",
      "PASS",
      "COMPATIBLE",
      "GLOBAL"
    ]);
    for (const proxy of config.proxies ?? []) {
      if (!isConfigMap(proxy) || typeof proxy.name !== "string") configError("订阅节点必须有 name");
      if (targets.has(proxy.name)) configError(`节点或代理组重名：${proxy.name}`);
      targets.add(proxy.name);
    }
    for (const group of config["proxy-groups"]) {
      if (typeof group.type !== "string") configError(`${group.name} 缺少代理组 type`);
      for (const name of requireArray(group.proxies ?? [], `${group.name}.proxies`)) {
        if (!targets.has(name)) configError(`${group.name} 引用了不存在的代理或组：${name}`);
      }
      for (const name of requireArray(group.use ?? [], `${group.name}.use`)) {
        if (!Object.hasOwn(config["proxy-providers"] ?? {}, name)) {
          configError(`${group.name} 引用了不存在的 proxy-provider：${name}`);
        }
      }
    }
    for (const rule of requireArray(config.rules, "rules")) {
      if (typeof rule !== "string") configError("rules 中必须是规则字符串");
      const parts = rule.split(",");
      const target = parts[parts.length - (parts[parts.length - 1] === "no-resolve" ? 2 : 1)];
      if (!targets.has(target)) configError(`规则引用了不存在的策略：${target}`);
      if (parts[0] === "RULE-SET" && !Object.hasOwn(config["rule-providers"] ?? {}, parts[1])) {
        configError(`规则引用了不存在的 rule-provider：${parts[1]}`);
      }
    }
  }

  // src/merge-config/patch.js
  /**
   * 判断映射是否声明字段删除操作，仅检查自有 $delete 键，不验证其取值或额外字段。
   *
   * @preserve
   * @param {*} value 待识别的字段补丁值。
   * @returns {boolean} 值为配置映射且具有自有 $delete 键时返回 true。
   */
  function isDeletePatch(value) {
    return isConfigMap(value) && Object.hasOwn(value, "$delete");
  }
  /**
   * 校验字段删除补丁必须恰好包含 `$delete: true`，不执行删除或修改补丁。
   *
   * @preserve
   * @param {Object<string, *>} patch 已识别为含 $delete 键的配置映射。
   * @param {string} path 用于错误信息的字段路径。
   * @returns {void} 删除标记及字段数量符合要求时正常返回。
   * @throws {Error} $delete 不为 true 或补丁包含其他字段时抛出配置错误。
   */
  function validateDeletePatch(patch, path) {
    if (patch.$delete !== true || Object.keys(patch).length !== 1) {
      configError(`${path} 删除字段时只能填写 {$delete: true}`);
    }
  }
  /**
   * 复制原数组，依次执行删除、头部追加、尾部追加和指定成员前插入，不修改输入。
   * 删除项通过 JSON 序列化结果比较；插入锚点匹配第一个完全相同的现有字符串成员。
   *
   * @preserve
   * @param {Array<*>} original 待修改的现有数组，必须已存在。
   * @param {Object<string, *>} patch 仅含 $remove、$prepend、$append、$insert-before 的数组补丁。
   * @param {string} path 用于定位数组及操作错误的配置路径。
   * @returns {Array<*>} 应用补丁后的新数组，保留操作顺序，不自动去重或排序。
   * @throws {Error} 操作未知、字段类型不符、插入锚点不存在或待复制配置值无效时抛出错误。
   */
  function patchConfigArray(original, patch, path) {
    const allowed = ["$remove", "$prepend", "$append", "$insert-before"];
    for (const key of Object.keys(patch)) {
      if (!allowed.includes(key)) configError(`${path} 未知数组操作：${key}`);
    }
    let result = copyConfigValue(requireArray(original, path));
    if (Object.hasOwn(patch, "$remove")) {
      const removed = requireArray(patch.$remove, `${path}.$remove`);
      result = result.filter(
        (item) => !removed.some((value) => JSON.stringify(item) === JSON.stringify(value))
      );
    }
    if (Object.hasOwn(patch, "$prepend")) {
      result = [...copyConfigValue(requireArray(patch.$prepend, `${path}.$prepend`)), ...result];
    }
    if (Object.hasOwn(patch, "$append")) {
      result.push(...copyConfigValue(requireArray(patch.$append, `${path}.$append`)));
    }
    if (Object.hasOwn(patch, "$insert-before")) {
      if (!isConfigMap(patch["$insert-before"])) configError(`${path}.$insert-before 必须是映射`);
      for (const [anchor, values] of Object.entries(patch["$insert-before"])) {
        const index = result.indexOf(anchor);
        if (index < 0) configError(`${path} 找不到插入位置：${anchor}`);
        result.splice(
          index,
          0,
          ...copyConfigValue(requireArray(values, `${path}.$insert-before.${anchor}`))
        );
      }
    }
    return result;
  }
  /**
   * 递归合并配置映射，执行字段删除及数组补丁；标量和普通数组直接替换原值。
   * 根级 proxy-groups 按组名合并，其他普通映射按键合并，整个过程不修改两个输入。
   *
   * @preserve
   * @param {*} original 原配置值；新增字段时可为 undefined，数组补丁要求已有数组。
   * @param {*} patch 覆盖值或补丁映射；普通值必须能由 copyConfigValue 复制。
   * @param {string} [path=''] 当前配置路径；空字符串表示根级，同时用于错误定位。
   * @returns {Object<string, *>|Array<*>|string|boolean|number|null} 合并后的独立容器或替换标量。
   * @throws {Error} 配置键或值无效、补丁不合法、删除目标不存在或组操作失败时抛出错误。
   */
  function mergeConfigValue(original, patch, path = "") {
    if (!isConfigMap(patch)) return copyConfigValue(patch);
    if (Object.keys(patch).some((key) => key.startsWith("$"))) {
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
      } else if (!path && key === "proxy-groups") {
        result[key] = mergeProxyGroups(result[key] ?? [], value);
      } else {
        result[key] = mergeConfigValue(result[key], value, field);
      }
    }
    return result;
  }
  /**
   * 按原始组名应用代理组补丁，支持字段合并、删除，以及 $before/$after 定位。
   * 未指定位置时保留已有组的位置、新组追加到末尾；所有操作作用于原列表的副本。
   *
   * @preserve
   * @param {Array<Object<string, *>>} original 原代理组列表，名称须有效且不重复。
   * @param {Array<Object<string, *>>} patches 按执行顺序排列的组补丁，每个组名在补丁中只能出现一次。
   * @returns {Array<Object<string, *>>} 合并并定位后的新代理组列表，不与输入共享容器。
   * @throws {Error} 组名、字段补丁、删除操作、定位操作或定位目标不合法时抛出配置错误。
   */
  function mergeProxyGroups(original, patches) {
    checkGroupNames(original, "base.proxy-groups");
    checkGroupNames(patches, "profile.proxy-groups");
    const result = copyConfigValue(original);
    for (const patch of patches) {
      const { name, $before, $after, $delete, ...fields } = patch;
      const index = result.findIndex((group2) => group2.name === name);
      for (const key of Object.keys(fields)) {
        if (key.startsWith("$")) configError(`${name} 未知代理组操作：${key}`);
      }
      if (Object.hasOwn(patch, "$delete")) {
        if ($delete !== true || Object.keys(patch).length !== 2 || index < 0) {
          configError(`${name} 删除代理组时必须仅填写已有 name 和 $delete: true`);
        }
        result.splice(index, 1);
        continue;
      }
      if (Object.hasOwn(patch, "$before") && Object.hasOwn(patch, "$after")) {
        configError(`${name} 不能同时使用 $before 和 $after`);
      }
      const group = mergeConfigValue(
        index < 0 ? {} : result[index],
        { name, ...fields },
        `proxy-groups.${name}`
      );
      const position = Object.hasOwn(patch, "$before") ? "$before" : Object.hasOwn(patch, "$after") ? "$after" : null;
      if (position) {
        const anchor = position === "$before" ? $before : $after;
        if (typeof anchor !== "string" || anchor === name) configError(`${name} 无效的 ${position}`);
        if (index >= 0) result.splice(index, 1);
        const anchorIndex = result.findIndex((item) => item.name === anchor);
        if (anchorIndex < 0) configError(`${name} 找不到代理组位置：${anchor}`);
        result.splice(anchorIndex + (position === "$after" ? 1 : 0), 0, group);
      } else if (index < 0) {
        result.push(group);
      } else {
        result[index] = group;
      }
    }
    return result;
  }

  // src/merge-config/index.js
  /**
   * 校验来源标记，合并公共模板与客户端差异，再复制注入节点并校验当前配置引用。
   * 不修改输入；移除来源标记，保留供后续覆写使用的成员生成声明。
   *
   * @preserve
   * @param {Object<string, *>} base 包含 `$base: true` 且不含顶层 proxies 的公共配置。
   * @param {Object<string, *>} profile 包含合法 `$profile` 且不含顶层 proxies 的客户端差异。
   * @param {Array<Object<string, *>>} [proxies] 已注入的节点；省略时结果不添加顶层 proxies。
   * @returns {Object<string, *>} 完成合并及当前引用校验的新配置，不与输入共享容器。
   * @throws {Error} 来源标记、配置值、补丁、节点或当前配置引用不符合要求时抛出错误。
   */
  function mergeConfigDocuments(base, profile, proxies) {
    if (!isConfigMap(base) || base.$base !== true) configError("base.yaml 必须包含 $base: true");
    if (!isConfigMap(profile) || !["mihomo", "stash"].includes(profile.$profile)) {
      configError("客户端差异必须包含 $profile: mihomo 或 stash");
    }
    const { $base, ...common } = base;
    const { $profile, ...overlay } = profile;
    if (Object.hasOwn(common, "proxies") || Object.hasOwn(overlay, "proxies")) {
      configError("配置源不能包含 proxies，节点由 Sub-Store 注入");
    }
    const merged = mergeConfigValue(mergeConfigValue({}, common), overlay);
    if (proxies !== void 0) {
      merged.proxies = copyConfigValue(requireArray(proxies, "输入 proxies"));
    }
    validateMergedConfig(merged);
    return merged;
  }

  // src/merge-config/source.js
  var DEFAULT_CONFIG_URL = "https://raw.githubusercontent.com/chiyuchia/proxy-config/master/configs";
  /**
   * 规范化客户端名称和超时值，并按单独地址优先于公共目录的规则解析配置来源。
   * 此处不验证最终地址的协议，HTTP(S) 检查在读取来源时执行。
   *
   * @preserve
   * @param {Object<string, *>} args 脚本参数对象，不修改原对象。
   * @param {string} args.client 必填客户端名称，去除首尾空白并转小写后须为 mihomo 或 stash。
   * @param {*} [args.timeout=10000] 请求超时毫秒数，经 Number 转换后须为有限正数。
   * @param {string|null} [args.configBaseUrl] 配置目录；省略或为 null 时使用仓库 master/configs 地址。
   * @param {*} [args.baseUrl] 公共配置独立地址；非 null/undefined 时优先使用，格式稍后检查。
   * @param {*} [args.profileUrl] 客户端差异独立地址；非 null/undefined 时优先使用，格式稍后检查。
   * @returns {{client: string, timeout: number, baseUrl: *, profileUrl: *}} 客户端、超时和两个来源地址。
   * @throws {Error} 客户端不支持、超时无法转为有限正数或公共目录不是字符串时抛出配置错误。
   */
  function resolveConfigOptions(args) {
    const client = typeof args.client === "string" ? args.client.trim().toLowerCase() : "";
    if (!["mihomo", "stash"].includes(client)) configError("请设置 client=mihomo 或 client=stash");
    const timeout = args.timeout === void 0 ? 1e4 : Number(args.timeout);
    if (!Number.isFinite(timeout) || timeout <= 0) configError("timeout 必须是正数（毫秒）");
    const root = args.configBaseUrl ?? DEFAULT_CONFIG_URL;
    if (typeof root !== "string") configError("configBaseUrl 必须是 URL 字符串");
    const directory = root.replace(/\/+$/, "");
    return {
      client,
      timeout,
      baseUrl: args.baseUrl ?? `${directory}/base.yaml`,
      profileUrl: args.profileUrl ?? `${directory}/${client}.yaml`
    };
  }
  /**
   * 发起一次 HTTP GET，检查成功状态及非空响应体后解析独立 YAML 来源。
   * 下载异常原样传播，同步 YAML 解析异常添加来源说明后抛出。
   *
   * @preserve
   * @param {string} url 来源地址，须以 HTTP(S) 协议开头。
   * @param {string} label 用于错误信息的来源标签，例如 base.yaml。
   * @param {number} timeout 传给 HTTP 运行时的请求超时毫秒数，本函数不再次验证其范围。
   * @param {Object} runtime 由调用方提供的 HTTP 和 YAML 能力。
   * @param {function(Object): Promise<Object>} runtime.get 接收 url、timeout 并返回 HTTP 响应的函数。
   * @param {function(string): *} runtime.parseYaml 同步解析响应文本并返回配置值的函数。
   * @returns {Promise<*>} YAML 解析得到的值；来源标记及配置结构由后续步骤检查。
   * @throws {Error} 地址协议无效、下载失败、响应为空或 YAML 解析失败时拒绝返回的 Promise。
   */
  async function readConfigSource(url, label, timeout, { get, parseYaml }) {
    if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
      configError(`${label} 必须使用 HTTP(S) URL`);
    }
    const response = await get({ url, timeout });
    const status = Number(response?.statusCode ?? response?.status);
    if (!(status >= 200 && status < 300)) configError(`${label} 下载失败：HTTP ${status}`);
    if (typeof response.body !== "string" || !response.body.trim()) configError(`${label} 内容为空`);
    try {
      return parseYaml(response.body);
    } catch (error) {
      configError(`${label} YAML 解析失败：${error.message}`);
    }
  }
  /**
   * 并行下载公共配置与客户端差异，核对客户端标记后合并，并仅保留输入中的注入节点。
   * 会通过运行时发出两个读取请求，不修改输入配置或参数对象。
   *
   * @preserve
   * @param {Object<string, *>|null|undefined} config 输入配置，可为空；仅读取其 proxies 字段。
   * @param {Object<string, *>} args 来源参数，包含必填 client 及 resolveConfigOptions 支持的可选项。
   * @param {Object} runtime 由调用方提供的来源读取能力。
   * @param {function(Object): Promise<Object>} runtime.get 接收 url、timeout 并返回 HTTP 响应的函数。
   * @param {function(string): *} runtime.parseYaml 同步解析各份 YAML 文本的函数。
   * @returns {Promise<Object<string, *>>} 校验并合并后的新配置，其容器与输入配置独立。
   * @throws {Error} 参数、下载、解析、客户端标记、补丁或配置校验失败时拒绝返回的 Promise。
   */
  async function loadMergedConfig(config, args, runtime) {
    const { client, timeout, baseUrl, profileUrl } = resolveConfigOptions(args);
    const [base, profile] = await Promise.all([
      readConfigSource(baseUrl, "base.yaml", timeout, runtime),
      readConfigSource(profileUrl, `${client}.yaml`, timeout, runtime)
    ]);
    if (profile?.$profile !== client) configError(`客户端差异与 client=${client} 不一致`);
    return mergeConfigDocuments(base, profile, config?.proxies);
  }

  // src/entries/merge-config.js
  /**
   * 适配 Sub-Store 的脚本参数、HTTP 和 YAML 接口，下载并合并公共配置与客户端差异。
   * @preserve
   * @param {Object|null|undefined} config 输入配置，仅保留其中注入的 proxies；不修改原对象。
   * @returns {Promise<Object>} 完成来源、补丁和引用校验的新配置，仍保留成员生成声明供后续覆写。
   * @throws {Error} 参数、远程请求、YAML 来源、补丁或引用无效时，返回的 Promise 拒绝。
   */
  async function main(config) {
    const args = typeof $arguments === "object" && $arguments ? $arguments : {};
    return loadMergedConfig(config, args, {
      /**
       * 转发配置文件的 HTTP GET 请求到 Sub-Store。
       * @preserve
       * @param {{url: string, timeout: number}} request 请求地址与超时毫秒数。
       * @returns {Promise<Object>} 包含响应体和状态信息的 HTTP 响应；请求错误向上传播。
       */
      get: (request) => $substore.http.get(request),
      /**
       * 使用 Sub-Store 提供的 YAML 解析器读取配置文本。
       * @preserve
       * @param {string} source 下载到的 YAML 文本。
       * @returns {*} 解析后的 YAML 值，结构由后续合并流程校验。
       * @throws {Error} YAML 文本无法解析。
       */
      parseYaml: (source) => ProxyUtils.yaml.safeLoad(source)
    });
  }
  return __toCommonJS(merge_config_exports);
})();
/**
 * 适配 Sub-Store 的脚本参数、HTTP 和 YAML 接口，下载并合并公共配置与客户端差异。
 * @preserve
 * @param {Object|null|undefined} config 输入配置，仅保留其中注入的 proxies；不修改原对象。
 * @returns {Promise<Object>} 完成来源、补丁和引用校验的新配置，仍保留成员生成声明供后续覆写。
 * @throws {Error} 参数、远程请求、YAML 来源、补丁或引用无效时，返回的 Promise 拒绝。
 */
async function main(config) {
  return __proxyConfigScript.main(config);
}
