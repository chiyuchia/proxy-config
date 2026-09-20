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

  // src/config-overwrite/group-members.js
  var AIRPORT_ASIA_GROUPS = /* @__PURE__ */ new Set(["✈️ VikingLinks 亚太", "✈️ 良心云 亚太", "✈️ 吹雪云 亚太"]);
  var GROUP_PROTOCOLS = /* @__PURE__ */ new Map([
    ["✈️ 良心云 Hy2", ["hysteria2", "hy2"]],
    ["✈️ 良心云 亚太", ["vless"]]
  ]);
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
  function updateGroup(group, allProxies, directProxies) {
    const name = group?.name ?? "";
    if (name.includes("全球直连")) return group;
    const allowedTypes = GROUP_PROTOCOLS.get(name);
    const isAsiaGroup = AIRPORT_ASIA_GROUPS.has(name);
    const rebuildMembers = isAsiaGroup || allowedTypes !== void 0;
    const requiresDirect = name.includes("中转") || rebuildMembers;
    let candidates = requiresDirect ? directProxies : allProxies;
    if (allowedTypes) {
      candidates = candidates.filter(
        (proxy) => allowedTypes.includes(String(proxy.type).toLowerCase())
      );
    }
    const existing = rebuildMembers ? [] : group?.proxies;
    return {
      ...group,
      proxies: mergeProxyNames(existing, matchingProxyNames(group, candidates))
    };
  }
  function updateGroupMembers(groups, proxies) {
    const allProxies = proxies.filter((proxy) => proxy?.name);
    const directProxies = allProxies.filter((proxy) => !proxy["dialer-proxy"]);
    return groups.map((group) => updateGroup(group, allProxies, directProxies));
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
