/**
 * @file 不依赖 URL 全局对象的 HTTP(S) 地址格式检查，供构建和 Sub-Store 共用。
 */

/**
 * 校验方括号主机中的 IPv6 地址，支持一次零压缩和末尾嵌入的 IPv4。
 * @preserve
 * @param {string} address 已移除方括号和可选 zone 的地址。
 * @returns {boolean} 分段格式、数量和 IPv4 数值有效时为 true，不修改输入。
 */
function isIpv6(address: string): boolean {
  const halves = address.split('::');
  if (halves.length > 2) return false;
  const words = halves.flatMap((half) => (half ? half.split(':') : []));
  let units = words.length;
  const last = words.at(-1) ?? '';
  if (last.includes('.')) {
    if (!address.endsWith(last)) return false;
    const octets = last.split('.');
    if (
      octets.length !== 4 ||
      octets.some((part) => !/^(?:0|[1-9]\d{0,2})$/.test(part) || Number(part) > 255)
    )
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
 * @param {*} value 待检查的 HTTP(S) 地址字段。
 * @returns {boolean} 协议、主机和端口格式有效时为 true。
 */
export function isHttpUrl(value: unknown): boolean {
  if (typeof value !== 'string' || /[\s\u0000-\u001f\u007f\\]/u.test(value)) return false;
  if (/%(?![\da-f]{2})/i.test(value)) return false;
  const match = /^https?:\/\/([^/?#]+)(?:[/?#].*)?$/i.exec(value);
  if (!match) return false;
  const authority = match[1];
  const at = authority.lastIndexOf('@');
  if (at !== authority.indexOf('@')) return false;
  if (at >= 0 && /[[\]<>"`{}|^]/.test(authority.slice(0, at))) return false;
  const hostPort = authority.slice(at + 1);
  const hostMatch = hostPort.startsWith('[')
    ? /^\[([\da-f:.]+)(?:%25[\w.-]+)?\](?::(\d+))?$/i.exec(hostPort)
    : /^([^:[\]<>"`{}|^%]+)(?::(\d+))?$/.exec(hostPort);
  if (!hostMatch) return false;
  if (hostPort.startsWith('[') && !isIpv6(hostMatch[1])) return false;
  const port = hostMatch[2];
  return port === undefined || Number(port) <= 65535;
}
