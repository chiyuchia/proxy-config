/**
 * @file 节点名称中的内置关键词、运营商及倍率标签提取规则。
 * 合并自定义关键词，按原名中的位置排序、去重，并移除被完整词包含的片段。
 */

const RETAIN_KEYWORDS = [
  // 日本
  '东京',
  '大坂',
  'Tokyo',
  'Osaka',
  'NRT',
  'HND',
  'KIX',
  'OSA',
  // 韩国
  '首尔',
  '春川',
  'Seoul',
  'Chuncheon',
  'ICN',
  'GMP',
  // 美国
  '纽约',
  '洛杉矶',
  '硅谷',
  '西雅图',
  '芝加哥',
  '波特兰',
  '哥伦布',
  '俄勒冈',
  'Los Angeles',
  'San Jose',
  'Silicon Valley',
  'New York',
  'Seattle',
  'Chicago',
  'LAX',
  'SJC',
  'SEA',
  'SFO',
  'JFK',
  'EWR',
  'IAD',
  'ORD',
  'DFW',
  'MIA',
  'ATL',
  'IAH',
  'PHX',
  'DEN',
  'LAS',
  'BOS',
  // 英国
  '伦敦',
  'London',
  'LHR',
  'LGW',
  'STN',
  'MAN',
  // 澳大利亚
  '悉尼',
  '墨尔本',
  'Sydney',
  'Melbourne',
  'SYD',
  'MEL',
  'BNE',
  'PER',
  // 德国
  '法兰克福',
  'Frankfurt',
  'FRA',
  'MUC',
  'BER',
  // 俄罗斯
  '莫斯科',
  'Moscow',
  'SVO',
  'DME',
  // 土耳其
  '伊斯坦布尔',
  'Istanbul',
  'IST',
  'SAW',
  // 印度
  '孟买',
  'Mumbai',
  'BOM',
  'DEL',
  'BLR',
  // 印尼
  '雅加达',
  'Jakarta',
  'CGK',
  'DPS',
  // 法国
  '巴黎',
  'Paris',
  'CDG',
  'ORY',
  // 瑞士
  '苏黎世',
  'Zurich',
  'ZRH',
  // 阿联酋
  '迪拜',
  'Dubai',
  'DXB',
  'AUH',
  // 泰国
  '曼谷',
  'Bangkok',
  'BKK',
  'DMK',
  // 台湾
  '台北',
  'Taipei',
  'TPE',
  // 荷兰
  '阿姆斯特丹',
  'Amsterdam',
  'AMS',
  // 加拿大
  '多伦多',
  '温哥华',
  'Toronto',
  'Vancouver',
  'YYZ',
  'YVR',
  // 马来西亚
  '吉隆坡',
  'Kuala Lumpur',
  'KUL',
  // 菲律宾
  '马尼拉',
  'Manila',
  'MNL',
  // 波兰
  '华沙',
  'Warsaw',
  'WAW',
  // 捷克
  '布拉格',
  'Prague',
  'PRG',
  // 奥地利
  '维也纳',
  'Vienna',
  'VIE',
  // 西班牙
  '马德里',
  '巴塞罗那',
  'Madrid',
  'Barcelona',
  'MAD',
  'BCN',
  // 意大利
  '米兰',
  '罗马',
  'Milan',
  'Rome',
  'MXP',
  'FCO',
  // 葡萄牙
  '里斯本',
  'Lisbon',
  'LIS',
  // 瑞典
  '斯德哥尔摩',
  'Stockholm',
  'ARN',
  // 芬兰
  '赫尔辛基',
  'Helsinki',
  'HEL',
  // 丹麦
  '哥本哈根',
  'Copenhagen',
  'CPH',
  // 挪威
  '奥斯陆',
  'Oslo',
  'OSL',
  // 以色列
  '特拉维夫',
  'Tel Aviv',
  'TLV',
  // 沙特阿拉伯
  '利雅得',
  '吉达',
  'Riyadh',
  'Jeddah',
  'RUH',
  'JED',
  // 卡塔尔
  '多哈',
  'Doha',
  'DOH',
  // 南非
  '约翰内斯堡',
  'Johannesburg',
  'JNB',
  // 巴西
  '圣保罗',
  'Sao Paulo',
  'GRU',
  // 墨西哥
  '墨西哥城',
  'Mexico City',
  'MEX',

  'via',

  //VPS商/专线常见词
  'BAGE',
  'GOMAMI',
  'AKARI',
  'DMIT',
  'NETCUP',
  'NUBE',
  'MISAKA',
  'Sakura',
  '家宽',
  '专线',
  '高级专线',
  'IEPL',
  'Edge',
  'HKT',
  'HINET',
  'GIA',
  'CIA',
  'BGP',
  '流媒体',
  '高速',
  '移动',
  '联通',
  '电信',
  '移联',
  'AWS',
  'RS',
  'OVH',
  'CDN',
  '下载',
  'OCTO',
  'CTCUCM',
  'CMCU',
  'CUCM',
  'CTCU',
  'CM',
  'CT',
  'CU',
];

const RETAIN_PIPE_TAG_PATTERNS = [/^(?:CM|CT|CU)+$/i, /^(?:\d+(?:\.\d+)?|\.\d+)x$/i];

/**
 * 从首个管道之后的分段中提取完整的运营商组合标签或数字倍率标签。
 * 保留标签原文和顺序，此步骤不去重。
 *
 * @preserve
 * @param {*} name 原节点名；假值按空字符串处理，其余值转为字符串。
 * @returns {string[]} 去除首尾空白的匹配标签；没有后续分段或匹配时返回空数组。
 */
function extractRetainPipeTags(name) {
  const parts = String(name || '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length < 2) return [];

  return parts.slice(1).filter((part) => RETAIN_PIPE_TAG_PATTERNS.some((re) => re.test(part)));
}

/**
 * 依次提取内置城市及线路关键词、尾部管道标签和自定义关键词。
 * 保留原文大小写，按首次出现位置排序并去重，再移除被其他完整命中词包含的片段。
 * 关键词按正则解释，纯字母数字词额外限制字母数字边界。
 *
 * @preserve
 * @param {string} name 原节点名。
 * @param {string[]} retainKeys 追加的自定义关键词；空数组仅使用内置关键词和管道标签。
 * @returns {string[]} 整理后的命中词；未命中时返回空数组。
 * @throws {SyntaxError} 内置或自定义关键词不能编译为正则时抛出。
 */
export function extractRetainKeywords(name, retainKeys) {
  const hits = [];
  const nameLower = name.toLowerCase();
  /**
   * 将非空且未出现过的原文片段追加到当前 hits 数组。
   *
   * @preserve
   * @param {string} value 待保留的原文片段，使用大小写敏感的完全相等判断去重。
   * @returns {void} 无返回值，直接更新外层 hits 数组。
   */
  const pushOriginal = (value) => {
    if (value && !hits.includes(value)) hits.push(value);
  };
  /**
   * 查找关键词正则的首个匹配，并截取与关键词等长的原文加入当前命中列表。
   * 通过小写文本匹配；纯字母数字关键词增加边界，其余词保留原有正则语义。
   *
   * @preserve
   * @param {string} kw 内置或自定义关键词。
   * @returns {void} 无返回值；命中时通过 pushOriginal 更新外层 hits 数组。
   * @throws {SyntaxError} 关键词不能编译为正则时抛出。
   */
  const pushHit = (kw) => {
    const kwLower = kw.toLowerCase();
    // 英文关键词加单词边界，避免匹配单词内部（如 ist 命中 Registry）
    const isAscii = /^[A-Za-z0-9]+$/.test(kw);
    const re = isAscii
      ? new RegExp(`(?<![A-Za-z0-9])${kwLower}(?![A-Za-z0-9])`)
      : new RegExp(kwLower);
    const m = re.exec(nameLower);
    if (!m) return;
    const original = name.slice(m.index, m.index + kw.length);
    pushOriginal(original);
  };
  for (const kw of RETAIN_KEYWORDS) pushHit(kw);
  for (const tag of extractRetainPipeTags(name)) pushOriginal(tag);
  for (const kw of retainKeys) pushHit(kw);
  // 按关键词在原节点名中的首次出现位置排序，保留源词序
  hits.sort((a, b) => nameLower.indexOf(a.toLowerCase()) - nameLower.indexOf(b.toLowerCase()));
  // 过滤掉被其他命中词包含的子串（如同时命中"高级专线"和"专线"，保留前者）
  return hits.filter(
    (kw) => !hits.some((other) => other !== kw && other.toLowerCase().includes(kw.toLowerCase())),
  );
}
