/**
 * @file Sub-Store 节点中转脚本：为自建落地节点或 Edge 订阅设置 dialer-proxy。
 * 通过 mode 选择 self-hosted 或 edge，在来源订阅中设置中转，再供配置文件注入使用。
 * 入口：function operator(proxies, targetPlatform, context)；接入与参数见 README.md。
 *
 * 此文件由 npm run build 自动生成，请修改 src/ 中的源码。
 * 源码入口：src/entries/dialer-proxy.ts。
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

  // src/entries/dialer-proxy.ts
  var dialer_proxy_exports = {};
  __export(dialer_proxy_exports, {
    operator: () => operator
  });

  // src/dialer-proxy/index.ts
  /**
   * 按来源模式就地设置节点的 dialer-proxy，保留原节点名称和输入顺序。
   * edge 为全部节点设置 Edge 中转；self-hosted 仅处理名称含“落地”的节点，
   * 其中含大写 SG 的使用亚太中转，其余使用美西中转，未命中的节点保留原字段。
   * @preserve
   * @param {Array<Object>} proxies 来源订阅节点；self-hosted 模式要求 name 为字符串。
   * @param {Object} [args={}] 中转脚本参数。
   * @param {'self-hosted'|'edge'} args.mode 必填的中转模式，无默认模式。
   * @returns {Array<Object>} 新数组，元素仍为原节点对象；命中节点的中转字段已被覆盖。
   * @throws {Error} mode 缺失或不受支持；模式校验失败时不会修改任何节点。
   */
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

  // src/entries/dialer-proxy.ts
  /**
   * 读取 Sub-Store 的 $arguments.mode，为来源订阅节点设置中转。
   * @preserve
   * @param {Array<Object>} proxies 来源订阅节点，命中的节点会就地更新 dialer-proxy。
   * @param {string} targetPlatform Sub-Store 传入的目标平台，本脚本不使用。
   * @param {Object} context Sub-Store 传入的处理上下文，本脚本不使用。
   * @returns {Array<Object>} 保持输入顺序的新数组，元素引用及节点名称保持不变。
   * @throws {Error} mode 缺失或不是 self-hosted、edge。
   */
  function operator(proxies, targetPlatform, context) {
    return assignDialerProxy(proxies, typeof $arguments === "undefined" ? {} : $arguments);
  }
  return __toCommonJS(dialer_proxy_exports);
})();
/**
 * 读取 Sub-Store 的 $arguments.mode，为来源订阅节点设置中转。
 * @preserve
 * @param {Array<Object>} proxies 来源订阅节点，命中的节点会就地更新 dialer-proxy。
 * @param {string} targetPlatform Sub-Store 传入的目标平台，本脚本不使用。
 * @param {Object} context Sub-Store 传入的处理上下文，本脚本不使用。
 * @returns {Array<Object>} 保持输入顺序的新数组，元素引用及节点名称保持不变。
 * @throws {Error} mode 缺失或不是 self-hosted、edge。
 */
function operator(proxies, targetPlatform, context) {
  return __proxyConfigScript.operator(proxies, targetPlatform, context);
}
