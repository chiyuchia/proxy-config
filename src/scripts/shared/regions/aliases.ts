/**
 * @file 地区识别使用的国家规范化与城市、机场代码别名替换表。
 * 先规范化原名中的完整国家名，再按声明顺序替换城市和机场代码；
 * 英文词与三字母代码均限制字母边界以避免跨词误命中，并保留原有目标名与优先级。
 */

/** 地区别名替换规则：按数组顺序将命中文本替换为标准地区名称。 */
export interface RegionAlias {
  /** 替换后的标准地区名称，用于后续地区表匹配。 */
  target: string;
  /** 限制边界的地区或城市匹配正则。 */
  pattern: RegExp;
  /** 原名命中该正则时跳过本条替换，避免有歧义的城市名覆盖已明确标注的国家。 */
  skipIf?: RegExp;
}

const COSTA_RICA_MARKER = /哥斯达黎加|🇨🇷|(?<![A-Za-z])(?:Costa[\s_-]*Rica|CR)(?![A-Za-z])/i;

export const REGION_ALIASES: readonly RegionAlias[] = [
  // 先规范化原名中的完整国家名，避免后续城市别名替换与相邻词拼出错误国家。
  { target: 'NorthKorea', pattern: /(?<![A-Za-z])North[\s_-]+Korea(?![A-Za-z])/gi },
  { target: 'Korea', pattern: /(?<![A-Za-z])South[\s_-]*Korea(?![A-Za-z])/gi },
  { target: 'Isle of Man', pattern: /(?<![A-Za-z])Isle[\s_-]+of[\s_-]+Man(?![A-Za-z])/gi },

  // 城市与机场代码别名，保留各条原有目标名及匹配优先级。
  { target: '香港', pattern: /(?<![A-Za-z])(?:Hong[\s_-]*Kong|HKG)(?![A-Za-z])|港(?!.*线)/gi },
  { target: '台湾', pattern: /(?<![A-Za-z])(?:TPE|TSA)(?![A-Za-z])|新台|新北|台北|台(?!.*线)/g },
  { target: 'Taiwan', pattern: /(?<![A-Za-z])Taipei(?![A-Za-z])/gi },
  {
    target: '日本',
    pattern:
      /(?<![A-Za-z])(?:NRT|HND|KIX|OSA)(?![A-Za-z])|东京|大阪|大坂|(深|沪|呼|京|广|杭|中|辽)日(?!.*(I|线))/g,
  },
  { target: 'Japan', pattern: /(?<![A-Za-z])(?:Tokyo|Osaka)(?![A-Za-z])/gi },
  { target: '韩国', pattern: /(?<![A-Za-z])(?:ICN|GMP)(?![A-Za-z])|春川|首尔|韩(?!.*国)/g },
  { target: 'Korea', pattern: /(?<![A-Za-z])(?:Seoul|Chuncheon)(?![A-Za-z])/gi },
  { target: '新加坡', pattern: /(?<![A-Za-z])SIN(?![A-Za-z])|狮城|(深|沪|呼|京|广|杭)新/g },
  {
    target: '美国',
    // 不映射中文“圣何塞”，避免覆盖哥斯达黎加首都等明确国家名。
    pattern:
      /(?<![A-Za-z])(?:LAX|SJC|SEA|SFO|JFK|EWR|IAD|ORD|DFW|MIA|ATL|IAH|PHX|DEN|LAS|BOS)(?![A-Za-z])|洛杉矶|波特兰|芝加哥|哥伦布|纽约|硅谷|俄勒冈|西雅图|(深|沪|呼|京|广|杭)美/g,
  },
  {
    target: '美国',
    pattern: /(?<![A-Za-z])(?:USA|Los[\s_-]+Angeles|Silicon[\s_-]+Valley|Michigan)(?![A-Za-z])/gi,
  },
  {
    target: '美国',
    // 圣何塞同时为哥斯达黎加首都与美国城市，原名已明确标注哥斯达黎加时不按美国替换。
    pattern: /(?<![A-Za-z])San[\s_-]+Jose(?![A-Za-z])/gi,
    skipIf: COSTA_RICA_MARKER,
  },
  { target: '英国', pattern: /(?<![A-Za-z])(?:LHR|LGW|STN|MAN|BHX|EDI|GLA)(?![A-Za-z])|伦敦/g },
  {
    target: 'United Kingdom',
    pattern: /(?<![A-Za-z])(?:UK|Great[\s_-]+Britain|London)(?![A-Za-z])/gi,
  },
  {
    target: '澳大利亚',
    pattern:
      /(?<![A-Za-z])(?:SYD|MEL|BNE|PER|ADL|CBR)(?![A-Za-z])|澳洲|墨尔本|悉尼|(深|沪|呼|京|广|杭)澳/g,
  },
  { target: 'Australia', pattern: /(?<![A-Za-z])(?:Sydney|Melbourne)(?![A-Za-z])/gi },
  {
    target: '德国',
    pattern:
      /(?<![A-Za-z])(?:FRA|MUC|DUS|BER|HAM|STR|CGN)(?![A-Za-z])|法兰克福|(深|沪|呼|京|广|杭)德(?!.*(I|线))/g,
  },
  { target: 'Germany', pattern: /(?<![A-Za-z])Frankfurt(?![A-Za-z])/gi },
  { target: '俄罗斯', pattern: /(?<![A-Za-z])(?:SVO|DME|LED|VKO)(?![A-Za-z])|莫斯科/g },
  { target: 'Russia', pattern: /(?<![A-Za-z])Moscow(?![A-Za-z])/gi },
  { target: '土耳其', pattern: /(?<![A-Za-z])(?:IST|SAW|ESB)(?![A-Za-z])|伊斯坦布尔/g },
  { target: 'Turkey', pattern: /(?<![A-Za-z])Istanbul(?![A-Za-z])/gi },
  { target: '印度', pattern: /(?<![A-Za-z])(?:BOM|DEL|BLR|MAA|CCU|HYD)(?![A-Za-z])|孟买/g },
  { target: 'India', pattern: /(?<![A-Za-z])Mumbai(?![A-Za-z])/gi },
  { target: '印尼', pattern: /(?<![A-Za-z])(?:CGK|SUB|DPS)(?![A-Za-z])|印度尼西亚|雅加达/g },
  { target: 'Indonesia', pattern: /(?<![A-Za-z])Jakarta(?![A-Za-z])/gi },
  { target: '法国', pattern: /(?<![A-Za-z])(?:CDG|ORY|LYS|NCE|MRS)(?![A-Za-z])|巴黎/g },
  { target: 'France', pattern: /(?<![A-Za-z])Paris(?![A-Za-z])/gi },
  { target: '瑞士', pattern: /苏黎世/g },
  { target: 'Switzerland', pattern: /(?<![A-Za-z])(?:ZRH|GVA)(?![A-Za-z])/g },
  { target: 'Switzerland', pattern: /(?<![A-Za-z])Zurich(?![A-Za-z])/gi },
  { target: '阿联酋', pattern: /(?<![A-Za-z])(?:DXB|AUH|SHJ)(?![A-Za-z])|迪拜|阿拉伯联合酋长国/g },
  {
    target: 'Dubai',
    pattern: /(?<![A-Za-z])(?:United[\s_-]+Arab[\s_-]+Emirates|UAE)(?![A-Za-z])/gi,
  },
  // 排除与香港电讯 HKT 冲突的普吉机场代码，避免香港节点被误判为泰国。
  { target: '泰国', pattern: /(?<![A-Za-z])(?:BKK|DMK)(?![A-Za-z])|泰國|曼谷/g },
  { target: '中国', pattern: /中國/g },
  // 新增地区机场代码
  { target: '荷兰', pattern: /(?<![A-Za-z])AMS(?![A-Za-z])/g },
  { target: '马来', pattern: /(?<![A-Za-z])(?:KUL|PEN|BKI)(?![A-Za-z])/g },
  { target: '菲律宾', pattern: /(?<![A-Za-z])(?:MNL|CEB)(?![A-Za-z])/g },
  { target: '加拿大', pattern: /(?<![A-Za-z])(?:YYZ|YVR|YUL|YYC|YEG|YOW)(?![A-Za-z])/g },
  { target: '波兰', pattern: /(?<![A-Za-z])(?:WAW|KRK)(?![A-Za-z])/g },
  { target: '捷克', pattern: /(?<![A-Za-z])PRG(?![A-Za-z])/g },
  { target: '奥地利', pattern: /(?<![A-Za-z])VIE(?![A-Za-z])/g },
  { target: '匈牙利', pattern: /(?<![A-Za-z])BUD(?![A-Za-z])/g },
  { target: '比利时', pattern: /(?<![A-Za-z])BRU(?![A-Za-z])/g },
  { target: '葡萄牙', pattern: /(?<![A-Za-z])(?:LIS|OPO)(?![A-Za-z])/g },
  { target: '西班牙', pattern: /(?<![A-Za-z])(?:MAD|BCN)(?![A-Za-z])/g },
  { target: '意大利', pattern: /(?<![A-Za-z])(?:FCO|MXP|VCE)(?![A-Za-z])/g },
  { target: '挪威', pattern: /(?<![A-Za-z])OSL(?![A-Za-z])/g },
  { target: '瑞典', pattern: /(?<![A-Za-z])ARN(?![A-Za-z])/g },
  { target: '芬兰', pattern: /(?<![A-Za-z])HEL(?![A-Za-z])/g },
  { target: '丹麦', pattern: /(?<![A-Za-z])CPH(?![A-Za-z])/g },
  { target: '罗马尼亚', pattern: /(?<![A-Za-z])OTP(?![A-Za-z])/g },
  { target: '以色列', pattern: /(?<![A-Za-z])TLV(?![A-Za-z])/g },
  { target: '沙特阿拉伯', pattern: /(?<![A-Za-z])(?:RUH|JED)(?![A-Za-z])/g },
  { target: '卡塔尔', pattern: /(?<![A-Za-z])DOH(?![A-Za-z])/g },
  { target: '南非', pattern: /(?<![A-Za-z])(?:JNB|CPT)(?![A-Za-z])/g },
  { target: '墨西哥', pattern: /(?<![A-Za-z])(?:MEX|CUN)(?![A-Za-z])/g },
  { target: '阿根廷', pattern: /(?<![A-Za-z])EZE(?![A-Za-z])/g },
  { target: '哥伦比亚', pattern: /(?<![A-Za-z])BOG(?![A-Za-z])/g },
  { target: '巴西', pattern: /(?<![A-Za-z])(?:GRU|GIG)(?![A-Za-z])/g },
];
