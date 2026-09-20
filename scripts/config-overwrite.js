/**
 * @file Sub-Store 配置覆写脚本：筛选代理组成员、去重并注入可选 provider URL。
 * 在配置合并和节点注入后执行，保留分流规则及候选顺序。
 * 入口：function main(config)；接入与参数见 README.md。
 *
 * 此文件由 npm run build 自动生成，请修改 src/ 中的源码。
 * 源码入口：src/entries/config-overwrite.js。
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

  // src/entries/config-overwrite.js
  var config_overwrite_exports = {};
  __export(config_overwrite_exports, {
    main: () => main
  });

  // src/config-overwrite/member-policy.js
  var MEMBER_MODES = /* @__PURE__ */ new Set(["append", "replace", "manual"]);
  var MEMBER_FIELDS = /* @__PURE__ */ new Set(["mode", "exclude-dialer", "types"]);
  function policyError(group, field, message) {
    throw new Error(`[config-overwrite] ${group?.name || "未命名代理组"}.${field} ${message}`);
  }
  function requireMap(value, group, field) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      policyError(group, field, "必须为映射；请从合并后的模板生成，不要重复覆写最终配置");
    }
  }
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
    return { mode: policy.mode, excludeDialer: policy["exclude-dialer"] ?? false, types };
  }

  // src/config-overwrite/group-members.js
  function hasText(value) {
    return typeof value === "string" && value.trim() !== "";
  }
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
  function mergeProxyNames(existing, added) {
    return [.../* @__PURE__ */ new Set([...existing ?? [], ...added])];
  }
  function matchesPolicy(proxy, policy) {
    return (!policy.excludeDialer || !proxy["dialer-proxy"]) && (!policy.types || policy.types.has(String(proxy.type).toLowerCase()));
  }
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
  function updateGroupMembers(groups, proxies) {
    const policies = groups.map(readMemberPolicy);
    const allProxies = proxies.filter((proxy) => proxy?.name);
    const proxiesByName = new Map(allProxies.map((proxy) => [proxy.name, proxy]));
    return groups.map(
      (group, index) => updateGroup(group, policies[index], allProxies, proxiesByName)
    );
  }

  // src/config-overwrite/provider.js
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

  // src/config-overwrite/index.js
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

  // src/entries/config-overwrite.js
  function main(config) {
    return overwriteConfig(config, typeof $arguments === "undefined" ? {} : $arguments);
  }
  return __toCommonJS(config_overwrite_exports);
})();
function main(config) {
  return __proxyConfigScript.main(config);
}
