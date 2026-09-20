/**
 * @file Sub-Store 配置覆写脚本：筛选代理组成员、去重并注入可选 provider URL。
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

  // src/config-overwrite/provider.ts
  /**
   * 创建 oixCloud provider，或复制已有配置并仅替换 URL，不修改输入对象。
   * @preserve
   * @param {*} url 订阅地址；非字符串或空白字符串表示不创建、不更新。
   * @param {Object|null|undefined} existingProvider 已有 provider，省略时使用默认 HTTP 和健康检查设置。
   * @returns {Object|null} 新 provider 对象；未提供有效地址时为 null。地址保持原值，不移除首尾空白。
   */
  function buildOixCloudProvider(url, existingProvider) {
    if (typeof url !== "string" || url.trim() === "") return null;
    if (existingProvider) {
      return { ...existingProvider, url };
    }
    return {
      type: "http",
      url,
      path: "./proxy_provider/oixCloud.yaml",
      interval: 86400,
      proxy: "DIRECT",
      "health-check": {
        enable: true,
        interval: 600,
        url: "http://www.gstatic.com/generate_204"
      }
    };
  }

  // src/config-overwrite/index.ts
  /**
   * 就地更新代理组成员并移除内部声明，按参数补入 oixCloud provider 的订阅地址。
   * 成员声明全部校验成功后才替换组数组；保留规则和注入节点。
   * @preserve
   * @param {Object} config 本次合并、注入节点后的配置对象，会被就地修改。
   * @param {Object} [args={}] 覆写脚本参数。
   * @param {string} [args.oixCloudEdgePath] 可选订阅地址；缺失或为空白时不更新 provider。
   * @returns {Object} 传入的同一个配置对象，其中组已不再包含 x-substore 声明。
   * @throws {Error} 任一组的成员声明无效，包括直接再次覆写已移除声明的最终配置。
   */
  function overwriteConfig(config, args = {}) {
    config["proxy-groups"] = updateGroupMembers(
      config?.["proxy-groups"] ?? [],
      config?.proxies ?? []
    );
    const providers = config?.["proxy-providers"] ?? {};
    const oixCloud = buildOixCloudProvider(args?.oixCloudEdgePath || "", providers.oixCloud);
    if (oixCloud) {
      config["proxy-providers"] = { ...providers, oixCloud };
    }
    return config;
  }

  // src/entries/config-overwrite.ts
  /**
   * 读取 Sub-Store 的 $arguments，执行成员生成和可选的 provider URL 注入。
   * @preserve
   * @param {Object} config 已完成合并和节点注入的配置，会就地更新代理组及 provider。
   * @returns {Object} 同一个配置对象，最终代理组已移除内部生成声明。
   * @throws {Error} 任一成员声明缺失或不符合要求。
   */
  function main(config) {
    return overwriteConfig(config, typeof $arguments === "undefined" ? {} : $arguments);
  }
  return __toCommonJS(config_overwrite_exports);
})();
/**
 * 读取 Sub-Store 的 $arguments，执行成员生成和可选的 provider URL 注入。
 * @preserve
 * @param {Object} config 已完成合并和节点注入的配置，会就地更新代理组及 provider。
 * @returns {Object} 同一个配置对象，最终代理组已移除内部生成声明。
 * @throws {Error} 任一成员声明缺失或不符合要求。
 */
function main(config) {
  return __proxyConfigScript.main(config);
}
