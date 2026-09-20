/**
 * @file Sub-Store 节点中转脚本：为自建落地节点或 Edge 订阅设置 dialer-proxy。
 * 通过 mode 选择 self-hosted 或 edge，在来源订阅中设置中转，再供配置文件注入使用。
 * 入口：function operator(proxies, targetPlatform, context)；接入与参数见 README.md。
 *
 * 此文件由 npm run build 自动生成，请修改 src/ 中的源码。
 * 源码入口：src/entries/dialer-proxy.js。
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

  // src/entries/dialer-proxy.js
  var dialer_proxy_exports = {};
  __export(dialer_proxy_exports, {
    operator: () => operator
  });

  // src/dialer-proxy/index.js
  function assignDialerProxy(proxies, args = {}) {
    const mode = args?.mode;
    if (mode !== "self-hosted" && mode !== "edge") {
      throw new Error("[dialer-proxy] mode 必须为 self-hosted 或 edge");
    }
    return proxies.map((proxy) => {
      if (mode === "edge") {
        proxy["dialer-proxy"] = "🛡️ Edge 中转";
      } else if (proxy.name.includes("落地")) {
        proxy["dialer-proxy"] = proxy.name.includes("SG") ? "🛡️ 亚太中转" : "🛡️ 美西中转";
      }
      return proxy;
    });
  }

  // src/entries/dialer-proxy.js
  function operator(proxies, targetPlatform, context) {
    return assignDialerProxy(proxies, typeof $arguments === "undefined" ? {} : $arguments);
  }
  return __toCommonJS(dialer_proxy_exports);
})();
function operator(proxies, targetPlatform, context) {
  return __proxyConfigScript.operator(proxies, targetPlatform, context);
}
