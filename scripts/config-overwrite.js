/**
 * @file Sub-Store 配置覆写脚本：生成代理组成员、校验最终配置并移除内部声明。
 * 在配置合并和节点注入后执行，保留分流规则及候选顺序。
 * 入口：function main(config)；接入与参数见 README.md。
 *
 * 此文件由 npm run build 自动生成，请修改 src/ 中的源码。
 * 源码入口：src/entries/config-overwrite.ts。
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

  // src/entries/config-overwrite.ts
  var config_overwrite_exports = {};
  __export(config_overwrite_exports, {
    main: () => main
  });

  // src/config-overwrite/member-policy.ts
  var MEMBER_MODES = /* @__PURE__ */ new Set(["append", "replace", "manual"]);
  var MEMBER_FIELDS = /* @__PURE__ */ new Set(["mode", "exclude-dialer", "types"]);
  /**
   * 抛出包含代理组名称和字段路径的成员声明错误。
   * @preserve
   * @param {Object|null|undefined} group 出错的组；无名称时使用“未命名代理组”。
   * @param {string} field 出错字段的路径。
   * @param {string} message 错误原因。
   * @returns {never} 始终抛出错误，不正常返回。
   * @throws {Error} 带 config-overwrite 前缀的声明校验错误。
   */
  function policyError(group, field, message) {
    throw new Error(`[config-overwrite] ${group?.name || "未命名代理组"}.${field} ${message}`);
  }
  /**
   * 确认声明字段是非 null 的对象且不是数组，失败时说明应从合并模板生成配置。
   * @preserve
   * @param {*} value 待校验的字段值。
   * @param {Object|null|undefined} group 字段所属的代理组，用于错误定位。
   * @param {string} field 字段路径。
   * @returns {void} 校验通过时不返回值。
   * @throws {Error} 字段缺失、为 null、数组或非对象值。
   */
  function requireMap(value, group, field) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      policyError(group, field, "必须为映射；请从合并后的模板生成，不要重复覆写最终配置");
    }
  }
  /**
   * 校验并读取 x-substore.members，规范化协议列表及可选的中转排除开关。
   * 每组必须显式声明 mode；可选限制只作用于当前注入节点，不修改原声明。
   * @preserve
   * @param {Object} group 含 x-substore.members 映射的代理组。
   * @returns {{mode: 'append'|'replace'|'manual', excludeDialer: boolean, types: Set<string>|null}}
   *   成员策略；excludeDialer 默认为 false，types 去除首尾空白并转为小写集合，省略时为 null。
   * @throws {Error} 声明缺失、字段未知，或 mode、exclude-dialer、types 的类型或值无效。
   */
  function readMemberPolicy(group) {
    const metadata = group?.["x-substore"];
    requireMap(metadata, group, "x-substore");
    for (const key of Object.keys(metadata)) {
      if (key !== "members") policyError(group, `x-substore.${key}`, "是未知字段");
    }
    const policy = metadata.members;
    const field = "x-substore.members";
    requireMap(policy, group, field);
    for (const key of Object.keys(policy)) {
      if (!MEMBER_FIELDS.has(key)) policyError(group, `${field}.${key}`, "是未知字段");
    }
    if (!MEMBER_MODES.has(policy.mode)) {
      policyError(group, `${field}.mode`, "必须为 append、replace 或 manual");
    }
    if (Object.hasOwn(policy, "exclude-dialer") && typeof policy["exclude-dialer"] !== "boolean") {
      policyError(group, `${field}.exclude-dialer`, "必须为布尔值");
    }
    let types = null;
    if (Object.hasOwn(policy, "types")) {
      if (!Array.isArray(policy.types) || policy.types.length === 0 || policy.types.some((type) => typeof type !== "string" || !type.trim())) {
        policyError(group, `${field}.types`, "必须为非空协议名称数组；不限协议时省略该字段");
      }
      types = new Set(policy.types.map((type) => type.trim().toLowerCase()));
    }
    return {
      mode: policy.mode,
      excludeDialer: policy["exclude-dialer"] ?? false,
      types
    };
  }

  // src/config-overwrite/group-members.ts
  /**
   * 判断值是否为包含非空白字符的字符串。
   * @preserve
   * @param {*} value 待检查的值。
   * @returns {boolean} 仅非空白字符串返回 true。
   */
  function hasText(value) {
    return typeof value === "string" && value.trim() !== "";
  }
  /**
   * 将组筛选表达式的内联标记转换为 JavaScript 正则标记并编译。
   * 编译失败时记录日志，返回 null，避免将无效筛选当作全量匹配。
   * @preserve
   * @param {string} filterText 非空的节点名称筛选表达式。
   * @returns {RegExp|null} 编译后的正则；语法或标记无效时为 null。
   */
  function compileGroupFilter(filterText) {
    let flags = "";
    const pattern = filterText.replace(/\(\?([dgimsuvy]+)\)/g, (_, inlineFlags) => {
      flags = [...new Set(`${flags}${inlineFlags}`)].join("");
      return "";
    });
    try {
      return new RegExp(pattern, flags);
    } catch (error) {
      console.log(`[config-overwrite] 跳过无效 filter: ${filterText}, ${error.message}`);
      return null;
    }
  }
  /**
   * 按组的 filter 筛选候选节点名称，每个节点独立执行正则匹配。
   * @preserve
   * @param {Object} group 代理组；filter 缺失或为空白时接受全部候选。
   * @param {Array<Object>} candidates 已通过协议及中转限制的节点，需包含 name。
   * @returns {string[]} 按候选顺序返回匹配名称；无效正则返回空数组，尚未去重。
   */
  function matchingProxyNames(group, candidates) {
    if (!hasText(group?.filter)) {
      return candidates.map(({ name }) => name);
    }
    const filter = compileGroupFilter(group.filter);
    if (!filter) return [];
    return candidates.filter(({ name }) => {
      filter.lastIndex = 0;
      return filter.test(name);
    }).map(({ name }) => name);
  }
  /**
   * 合并已有成员与新增名称，按首次出现的位置去重。
   * @preserve
   * @param {string[]|null|undefined} existing 已有成员，空值按空数组处理。
   * @param {string[]} added 待追加的节点名称。
   * @returns {string[]} 新建的有序成员数组，不修改输入数组。
   */
  function mergeProxyNames(existing, added) {
    return [.../* @__PURE__ */ new Set([...existing ?? [], ...added])];
  }
  /**
   * 检查节点是否满足中转排除及实际协议限制，不匹配节点名称或递归检查组。
   * @preserve
   * @param {Object} proxy 待检查的节点，使用 type 和 dialer-proxy 字段。
   * @param {{excludeDialer: boolean, types: Set<string>|null}} policy 已校验的策略；types 为 null 时不限协议。
   * @returns {boolean} 两项限制均满足时返回 true；dialer-proxy 按真值判断。
   */
  function matchesPolicy(proxy, policy) {
    return (!policy.excludeDialer || !proxy["dialer-proxy"]) && (!policy.types || policy.types.has(String(proxy.type).toLowerCase()));
  }
  /**
   * 按 append、replace 或 manual 策略生成一个组，并剥离 x-substore 声明。
   * append 的已有真实节点也受协议和中转限制，filter 仅筛选动态成员；manual 保留原成员。
   * @preserve
   * @param {Object} group 含原始固定候选及筛选条件的代理组。
   * @param {{mode: string, excludeDialer: boolean, types: Set<string>|null}} policy 已校验并规范化的成员策略。
   * @param {Array<Object>} allProxies 当前具有有效名称的注入节点，按原输入顺序排列。
   * @param {Map<string, Object>} proxiesByName 节点名称索引，用于识别已有成员中的真实节点。
   * @returns {Object} 新建的代理组对象；不修改输入，未更新的嵌套字段保留引用。
   */
  function updateGroup(group, policy, allProxies, proxiesByName) {
    const { "x-substore": metadata, ...output } = group;
    if (policy.mode === "manual") return output;
    const candidates = allProxies.filter((proxy) => matchesPolicy(proxy, policy));
    const existing = policy.mode === "replace" ? [] : (group.proxies ?? []).filter((name) => {
      const proxy = proxiesByName.get(name);
      return !proxy || matchesPolicy(proxy, policy);
    });
    return {
      ...output,
      proxies: mergeProxyNames(existing, matchingProxyNames(group, candidates))
    };
  }
  /**
   * 先校验全部成员策略，再按组声明生成最终成员，不修改输入组或订阅节点。
   * @preserve
   * @param {Array<Object>} groups 按最终展示顺序排列、各自带有 x-substore.members 的组。
   * @param {Array<Object|null>} proxies 当前注入节点；空节点和名称为空的节点跳过。
   * @returns {Array<Object>} 顺序不变、移除内部声明后的新代理组数组。
   * @throws {Error} 任一组的成员声明缺失、包含未知字段或字段值无效。
   */
  function updateGroupMembers(groups, proxies) {
    const policies = groups.map(readMemberPolicy);
    const allProxies = proxies.filter((proxy) => proxy?.name);
    const proxiesByName = new Map(allProxies.map((proxy) => [proxy.name, proxy]));
    return groups.map(
      (group, index) => updateGroup(group, policies[index], allProxies, proxiesByName)
    );
  }

  // src/merge-config/value.ts
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
  /**
   * 递归复制配置映射和数组，保留允许的标量值，不修改输入或保留容器引用。
   *
   * @preserve
   * @param {*} value 待复制的无循环配置值，仅支持映射、数组、null、字符串、布尔值和有限数值。
   * @returns {Object<string, *>|Array<*>|string|boolean|number|null} 独立的容器副本或原标量值。
   * @throws {Error} 遇到禁止的映射键或不支持的值类型时抛出配置错误。
   */
  /**
   * 校验值是否为数组，供调用方使用统一的配置路径错误信息。
   *
   * @preserve
   * @param {*} value 待校验的值，不检查数组元素类型。
   * @param {string} path 用于错误信息的字段路径或来源说明。
   * @returns {Array<*>} 传入的原数组引用，不创建副本。
   * @throws {Error} value 不是数组时抛出配置错误。
   */

  // src/runtime-providers.ts
  /**
   * 严格读取顶层 x-substore.runtime-proxy-providers，拒绝无效声明及本地同名定义。
   * 缺少声明或字段时返回空集合；保留名称原值，不修改配置或创建运行时资源。
   * @preserve
   * @param {Object} config 当前配置，可包含顶层 x-substore 声明及本地 proxy-providers。
   * @param {Function} fail 接收错误原因并抛出当前处理阶段异常的函数。
   * @returns {Set<string>} 明确由客户端运行时提供的 proxy-provider 名称，允许空集合。
   * @throws {Error} 声明容器、字段、名称、重复项或本地定义冲突无效时抛出配置错误。
   */
  function readRuntimeProxyProviders(config, fail) {
    const metadata = config["x-substore"];
    if (metadata === void 0) return /* @__PURE__ */ new Set();
    if (!isConfigMap(metadata)) fail("顶层 x-substore 必须是映射");
    for (const key of Object.keys(metadata)) {
      if (key !== "runtime-proxy-providers") fail(`顶层 x-substore.${key} 是未知字段`);
    }
    const path = "x-substore.runtime-proxy-providers";
    const names = metadata["runtime-proxy-providers"];
    if (names === void 0) return /* @__PURE__ */ new Set();
    if (!Array.isArray(names)) fail(`${path} 必须是数组`);
    const runtimeProviders = /* @__PURE__ */ new Set();
    for (const [index, name] of names.entries()) {
      if (typeof name !== "string" || !name.trim()) {
        fail(`${path}[${index}] 必须是非空字符串`);
      }
      if (runtimeProviders.has(name)) fail(`${path} 名称重复：${name}`);
      if (Object.hasOwn(config["proxy-providers"] ?? {}, name)) {
        fail(`${path} 与本地 proxy-providers 同名：${name}`);
      }
      runtimeProviders.add(name);
    }
    return runtimeProviders;
  }

  // src/merge-config/validation.ts
  var BUILTIN_TARGETS = /* @__PURE__ */ new Set([
    "DIRECT",
    "REJECT",
    "REJECT-DROP",
    "PASS",
    "PASS-RULE",
    "COMPATIBLE",
    "GLOBAL"
  ]);
  /**
   * 逻辑规则按括号之外的逗号拆分，其他规则沿用普通逗号拆分。
   * 不将普通正则规则中的转义括号误认为逻辑条件边界。
   * @preserve
   * @param {string} rule 原始规则字符串。
   * @returns {string[]} 去除字段首尾空白的顶层字段，不验证完整条件语法。
   */
  function splitRuleFields(rule) {
    if (!/^\s*(?:AND|OR|NOT)\s*,/.test(rule)) {
      return rule.split(",").map((part) => part.trim());
    }
    const fields = [];
    let depth = 0;
    let start = 0;
    for (let index = 0; index < rule.length; index += 1) {
      if (rule[index] === "(") depth += 1;
      else if (rule[index] === ")") depth -= 1;
      else if (rule[index] === "," && depth === 0) {
        fields.push(rule.slice(start, index).trim());
        start = index + 1;
      }
    }
    fields.push(rule.slice(start).trim());
    return fields;
  }
  /**
   * 检查规则中的策略与顶层 RULE-SET 引用，供合并和最终覆写共用。
   * 识别规则末尾的 no-resolve、no-track 选项，不解析客户端的完整规则语法。
   * @preserve
   * @param {*} rules 规则字符串数组，不修改输入。
   * @param {Set<string>} targets 可引用的节点、组及内置策略名称。
   * @param {Object} providers 已定义的 rule-provider 映射。
   * @param {Function} [fail=configError] 接收错误原因并抛出异常的函数。
   * @returns {void} 引用有效时正常返回。
   * @throws {Error} 规则列表、规则值或引用无效时抛出指定模块的配置错误。
   */
  function validateRuleReferences(rules, targets, providers, fail = configError) {
    if (!Array.isArray(rules)) fail("rules 必须是数组");
    for (const [index, rule] of rules.entries()) {
      if (typeof rule !== "string") fail(`rules[${index}] 必须是规则字符串`);
      const parts = splitRuleFields(rule);
      const requiredFields = ["MATCH", "FINAL"].includes(parts[0]) ? 2 : 3;
      while (parts.length > requiredFields && ["no-resolve", "no-track"].includes(parts.at(-1) ?? "")) {
        parts.pop();
      }
      const target = parts.at(-1) ?? "";
      if (!targets.has(target)) fail(`rules[${index}] 规则引用了不存在的策略：${target}`);
      if (parts[0] === "RULE-SET" && !Object.hasOwn(providers, parts[1])) {
        fail(`rules[${index}] 规则引用了不存在的 rule-provider：${parts[1]}`);
      }
    }
  }
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
  /**
   * 校验当前配置的名称、组 type、成员、provider 和规则引用，以及运行时 provider 声明。
   * 只检查已提供的数据，不修改配置，也不校验节点的 dialer-proxy 或覆写阶段的成员声明。
   *
   * @preserve
   * @param {Object<string, *>} config 含 proxy-groups 与 rules 的配置；节点和 provider 定义可省略。
   * @returns {void} 当前配置通过上述结构与引用检查时正常返回。
   * @throws {Error} 名称冲突、必需字段或列表类型无效，或引用目标不存在时抛出配置错误。
   */

  // src/config-overwrite/validation.ts
  /**
   * 抛出可在 Sub-Store 定位的最终配置错误，不输出节点凭据或 provider 地址。
   * @preserve
   * @param {string} message 字段路径、名称及错误原因，不应包含配置全文或订阅 URL。
   * @returns {never} 始终抛出异常。
   * @throws {Error} 带 config-overwrite 前缀的最终配置校验错误。
   */
  function validationError(message) {
    throw new Error(`[config-overwrite] 最终配置校验失败：${message}`);
  }
  /**
   * 校验可选列表的容器类型；仅缺省值按空数组处理。
   * @preserve
   * @param {*} value 原始字段值。
   * @param {string} path 错误定位使用的字段路径。
   * @returns {Array<*>} 原数组；省略字段时返回空数组，不修改输入。
   * @throws {Error} 字段已提供但不是数组。
   */
  function readList(value, path) {
    if (value === void 0) return [];
    if (!Array.isArray(value)) validationError(`${path} 必须是数组`);
    return value;
  }
  /**
   * 校验非空名称或字段字符串，保留原始字符串以确保精确引用匹配。
   * @preserve
   * @param {*} value 待校验的字段值。
   * @param {string} path 错误定位使用的字段路径。
   * @returns {string} 未修剪、未改名的原始字符串。
   * @throws {Error} 字段不是字符串或只有空白。
   */
  function readText(value, path) {
    if (typeof value !== "string" || !value.trim()) {
      validationError(`${path} 必须是非空字符串`);
    }
    return value;
  }
  /**
   * 读取 provider 定义，确认顶层及每个 provider 均为映射。
   * @preserve
   * @param {*} value 原始 provider 字段；省略时视为空映射。
   * @param {string} path proxy-providers 或 rule-providers。
   * @returns {Object<string, Object>} 原映射或空映射，不复制或修改 provider。
   * @throws {Error} 容器、名称或 provider 定义类型无效。
   */
  function readProviders(value, path) {
    if (value === void 0) return {};
    if (!isConfigMap(value)) validationError(`${path} 必须是映射`);
    for (const [name, provider] of Object.entries(value)) {
      readText(name, `${path} 的名称`);
      if (!isConfigMap(provider)) validationError(`${path}[${name}] 必须是映射`);
    }
    return value;
  }
  /**
   * 在分组计算前检查其依赖的输入形状，避免无效字段触发原生数组或字符串异常。
   * 不检查引用、重名、环路及 provider 地址，允许覆写移除旧成员或补入缺失地址。
   * @preserve
   * @param {*} config 待覆写或待最终校验的配置，不修改输入。
   * @returns {void} 结构有效时正常返回，并收窄配置类型。
   * @throws {Error} 配置、节点、组、成员列表或 provider 容器类型无效。
   */
  function validateOverwriteStructure(config) {
    if (!isConfigMap(config)) validationError("配置必须是映射");
    for (const field of ["proxies", "proxy-groups"]) {
      for (const [index, item] of readList(config[field], field).entries()) {
        const path = `${field}[${index}]`;
        if (!isConfigMap(item)) validationError(`${path} 必须是映射`);
        const name = readText(item.name, `${path}.name`);
        if (field === "proxy-groups") {
          readText(item.type, `${path}[${name}].type`);
          for (const memberField of ["proxies", "use"]) {
            readList(item[memberField], `${path}[${name}].${memberField}`).forEach((ref, i) => {
              readText(ref, `${path}[${name}].${memberField}[${i}]`);
            });
          }
        }
      }
    }
    readProviders(config["proxy-providers"], "proxy-providers");
    readProviders(config["rule-providers"], "rule-providers");
  }
  /**
   * 校验方括号主机中的 IPv6 地址，支持一次零压缩和末尾嵌入的 IPv4。
   * @preserve
   * @param {string} address 已移除方括号和可选 zone 的地址。
   * @returns {boolean} 分段格式、数量和 IPv4 数值有效时为 true，不修改输入。
   */
  function isIpv6(address) {
    const halves = address.split("::");
    if (halves.length > 2) return false;
    const words = halves.flatMap((half) => half ? half.split(":") : []);
    let units = words.length;
    const last = words.at(-1) ?? "";
    if (last.includes(".")) {
      if (!address.endsWith(last)) return false;
      const octets = last.split(".");
      if (octets.length !== 4 || octets.some((part) => !/^(?:0|[1-9]\d{0,2})$/.test(part) || Number(part) > 255))
        return false;
      words.pop();
      units += 1;
    }
    if (words.some((word) => !/^[\da-f]{1,4}$/i.test(word))) return false;
    return halves.length === 2 ? units < 8 : units === 8;
  }
  /**
   * 检查 HTTP(S) 绝对地址的基本格式，不依赖 URL 全局对象，也不进行网络访问。
   * 允许认证信息、内网主机、方括号 IPv6、端口和查询参数；不检查 DNS 或资源可达性。
   * @preserve
   * @param {*} value provider 的 url 字段。
   * @returns {boolean} 协议、主机和端口格式有效时为 true。
   */
  function isHttpUrl(value) {
    if (typeof value !== "string" || /[\s\u0000-\u001f\u007f\\]/u.test(value)) return false;
    if (/%(?![\da-f]{2})/i.test(value)) return false;
    const match = /^https?:\/\/([^/?#]+)(?:[/?#].*)?$/i.exec(value);
    if (!match) return false;
    const authority = match[1];
    const at = authority.lastIndexOf("@");
    if (at !== authority.indexOf("@")) return false;
    if (at >= 0 && /[[\]<>"`{}|^]/.test(authority.slice(0, at))) return false;
    const hostPort = authority.slice(at + 1);
    const hostMatch = hostPort.startsWith("[") ? /^\[([\da-f:.]+)(?:%25[\w.-]+)?\](?::(\d+))?$/i.exec(hostPort) : /^([^:[\]<>"`{}|^%]+)(?::(\d+))?$/.exec(hostPort);
    if (!hostMatch) return false;
    if (hostPort.startsWith("[") && !isIpv6(hostMatch[1])) return false;
    const port = hostMatch[2];
    return port === void 0 || Number(port) <= 65535;
  }
  /**
   * 对本地依赖图执行迭代深度优先遍历，报告完整循环路径。
   * 使用显式栈避免较长中转链耗尽 JavaScript 调用栈；不修改图。
   * @preserve
   * @param {Map<string, string[]>} graph 节点和策略组名称到其本地依赖的邻接表。
   * @returns {void} 图无环时正常返回。
   * @throws {Error} 遇到回到当前路径的依赖时抛出包含环路名称的错误。
   */
  function validateAcyclic(graph) {
    const completed = /* @__PURE__ */ new Set();
    const active = /* @__PURE__ */ new Map();
    for (const root of graph.keys()) {
      if (completed.has(root)) continue;
      const stack = [{ name: root, next: 0 }];
      active.set(root, 0);
      while (stack.length) {
        const frame = stack[stack.length - 1];
        const edges = graph.get(frame.name);
        if (frame.next === edges.length) {
          completed.add(frame.name);
          active.delete(frame.name);
          stack.pop();
          continue;
        }
        const target = edges[frame.next++];
        const start = active.get(target);
        if (start !== void 0) {
          const cycle = [...stack.slice(start).map(({ name }) => name), target];
          validationError(`代理依赖存在环路：${cycle.join(" → ")}`);
        }
        if (completed.has(target)) continue;
        active.set(target, stack.length);
        stack.push({ name: target, next: 0 });
      }
    }
  }
  /**
   * 检查覆写后的名称、组/规则/provider 引用、中转关系、依赖环路和 HTTP provider 地址。
   * GLOBAL 可显式定义为组；缺省 GLOBAL 按包含所有本地节点及组处理，防止中转回到自身。
   * 组的 use 可引用本地 provider 或顶层 x-substore 中明确声明的运行时 provider。
   * 不修改配置，不展开远程 provider 或 include-all 等客户端动态成员，也不验证协议完整语法。
   * @preserve
   * @param {*} config 已完成节点注入和分组计算、仍保留顶层运行时声明的候选配置。
   * @returns {void} 所有检查通过时正常返回。
   * @throws {Error} 名称、字段、引用、依赖或 HTTP 地址无效时抛出含定位信息的错误。
   */
  function validateFinalConfig(config) {
    validateOverwriteStructure(config);
    const runtimeProviders = readRuntimeProxyProviders(config, validationError);
    const proxies = config.proxies ?? [];
    const groups = config["proxy-groups"] ?? [];
    const definitions = /* @__PURE__ */ new Map();
    for (const [field, entries] of [
      ["proxies", proxies],
      ["proxy-groups", groups]
    ]) {
      for (const [index, entry] of entries.entries()) {
        const path = `${field}[${index}].name`;
        if (BUILTIN_TARGETS.has(entry.name) && !(field === "proxy-groups" && entry.name === "GLOBAL")) {
          validationError(`${path} 与内置策略重名：${entry.name}`);
        }
        const previous = definitions.get(entry.name);
        if (previous) validationError(`${path} 与 ${previous} 重名：${entry.name}`);
        definitions.set(entry.name, path);
      }
    }
    const targets = /* @__PURE__ */ new Set([...BUILTIN_TARGETS, ...definitions.keys()]);
    const graph = new Map([...definitions.keys()].map((name) => [name, []]));
    if (!graph.has("GLOBAL")) graph.set("GLOBAL", [...definitions.keys()]);
    const proxyProviders = readProviders(config["proxy-providers"], "proxy-providers");
    const ruleProviders = readProviders(config["rule-providers"], "rule-providers");
    /**
     * 校验目标名称，并将本地节点或组引用记录为依赖边。
     * @preserve
     * @param {string} owner 发起引用的本地节点或组名。
     * @param {*} value 被引用的目标名称。
     * @param {string} path 错误定位使用的字段路径。
     * @returns {void} 引用有效时正常返回，并更新本次校验的内部依赖图。
     * @throws {Error} 引用不是非空字符串或找不到目标。
     */
    function addReference(owner, value, path) {
      const target = readText(value, path);
      if (!targets.has(target)) validationError(`${path} 引用了不存在的代理或组：${target}`);
      if (graph.has(target)) graph.get(owner).push(target);
    }
    for (const proxy of proxies) {
      const dialer = proxy["dialer-proxy"];
      if (dialer !== void 0 && dialer !== null && dialer !== "") {
        addReference(proxy.name, dialer, `proxies[${proxy.name}].dialer-proxy`);
      }
    }
    for (const group of groups) {
      for (const [index, name] of (group.proxies ?? []).entries()) {
        addReference(group.name, name, `proxy-groups[${group.name}].proxies[${index}]`);
      }
      for (const name of group.use ?? []) {
        if (!Object.hasOwn(proxyProviders, name) && !runtimeProviders.has(name)) {
          validationError(`proxy-groups[${group.name}].use 引用了不存在的 proxy-provider：${name}`);
        }
      }
    }
    validateRuleReferences(
      config.rules === void 0 ? [] : config.rules,
      targets,
      ruleProviders,
      validationError
    );
    validateAcyclic(graph);
    for (const [field, providers] of [
      ["proxy-providers", proxyProviders],
      ["rule-providers", ruleProviders]
    ]) {
      for (const [name, provider] of Object.entries(providers)) {
        if (provider.type === "http" && !isHttpUrl(provider.url)) {
          validationError(`${field}[${name}].url 必须是包含有效主机的 HTTP(S) URL`);
        }
      }
    }
  }

  // src/config-overwrite/index.ts
  /**
   * 就地更新代理组成员，校验本地配置及明确声明的运行时 provider 引用。
   * 候选配置校验通过后才写回并移除组内和顶层内部声明；失败时不修改输入。
   * @preserve
   * @param {Object} config 本次合并、注入节点后的配置对象，会被就地修改。
   * @returns {Object} 传入的同一个配置对象，顶层与组内均已移除 x-substore 声明。
   * @throws {Error} 成员声明或最终配置无效，包括直接再次覆写已移除声明的最终配置。
   */
  function overwriteConfig(config) {
    validateOverwriteStructure(config);
    const candidate = {
      ...config,
      "proxy-groups": updateGroupMembers(config["proxy-groups"] ?? [], config.proxies ?? [])
    };
    validateFinalConfig(candidate);
    config["proxy-groups"] = candidate["proxy-groups"];
    delete config["x-substore"];
    return config;
  }

  // src/entries/config-overwrite.ts
  /**
   * 执行成员生成和最终配置校验；本入口不需要脚本参数。
   * @preserve
   * @param {Object} config 已完成合并和节点注入的配置，校验通过后就地更新，失败时保持不变。
   * @returns {Object} 同一个配置对象，顶层与组内的内部声明均已移除。
   * @throws {Error} 任一成员声明或最终配置无效；异常向 Sub-Store 传播，阻止本次输出。
   */
  function main(config) {
    return overwriteConfig(config);
  }
  return __toCommonJS(config_overwrite_exports);
})();
/**
 * 执行成员生成和最终配置校验；本入口不需要脚本参数。
 * @preserve
 * @param {Object} config 已完成合并和节点注入的配置，校验通过后就地更新，失败时保持不变。
 * @returns {Object} 同一个配置对象，顶层与组内的内部声明均已移除。
 * @throws {Error} 任一成员声明或最终配置无效；异常向 Sub-Store 传播，阻止本次输出。
 */
function main(config) {
  return __proxyConfigScript.main(config);
}
