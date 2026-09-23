/**
 * @file Sub-Store 节点重命名脚本：仅按名称识别地区，整理序号、关键词和订阅名。
 * 用于订阅或组合订阅的节点处理，在配置文件注入节点前执行。
 * 入口：async function operator(proxies, targetPlatform, context)；接入与参数见 README.md。
 *
 * 此文件由 npm run build 自动生成，请修改 src/ 中的源码。
 * 源码入口：src/entries/rename.ts。
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

  // src/entries/rename.ts
  var rename_exports = {};
  __export(rename_exports, {
    operator: () => operator
  });

  // src/rename/regions.ts
  var REGIONS = [
    { code: "CN", chineseName: "中国", englishName: "China", flag: "🇨🇳" },
    { code: "HK", chineseName: "香港", englishName: "Hong Kong", flag: "🇭🇰" },
    { code: "MO", chineseName: "澳门", englishName: "Macao", flag: "🇲🇴" },
    { code: "TW", chineseName: "台湾", englishName: "Taiwan", flag: "🇹🇼" },
    { code: "JP", chineseName: "日本", englishName: "Japan", flag: "🇯🇵" },
    { code: "KR", chineseName: "韩国", englishName: "Korea", flag: "🇰🇷" },
    { code: "SG", chineseName: "新加坡", englishName: "Singapore", flag: "🇸🇬" },
    { code: "US", chineseName: "美国", englishName: "United States", flag: "🇺🇸" },
    { code: "GB", chineseName: "英国", englishName: "United Kingdom", flag: "🇬🇧" },
    { code: "FR", chineseName: "法国", englishName: "France", flag: "🇫🇷" },
    { code: "DE", chineseName: "德国", englishName: "Germany", flag: "🇩🇪" },
    { code: "AU", chineseName: "澳大利亚", englishName: "Australia", flag: "🇦🇺" },
    { code: "AE", chineseName: "阿联酋", englishName: "Dubai", flag: "🇦🇪" },
    { code: "AF", chineseName: "阿富汗", englishName: "Afghanistan", flag: "🇦🇫" },
    { code: "AL", chineseName: "阿尔巴尼亚", englishName: "Albania", flag: "🇦🇱" },
    { code: "DZ", chineseName: "阿尔及利亚", englishName: "Algeria", flag: "🇩🇿" },
    { code: "AO", chineseName: "安哥拉", englishName: "Angola", flag: "🇦🇴" },
    { code: "AR", chineseName: "阿根廷", englishName: "Argentina", flag: "🇦🇷" },
    { code: "AM", chineseName: "亚美尼亚", englishName: "Armenia", flag: "🇦🇲" },
    { code: "AT", chineseName: "奥地利", englishName: "Austria", flag: "🇦🇹" },
    { code: "AZ", chineseName: "阿塞拜疆", englishName: "Azerbaijan", flag: "🇦🇿" },
    { code: "BH", chineseName: "巴林", englishName: "Bahrain", flag: "🇧🇭" },
    { code: "BD", chineseName: "孟加拉国", englishName: "Bangladesh", flag: "🇧🇩" },
    { code: "BY", chineseName: "白俄罗斯", englishName: "Belarus", flag: "🇧🇾" },
    { code: "BE", chineseName: "比利时", englishName: "Belgium", flag: "🇧🇪" },
    { code: "BZ", chineseName: "伯利兹", englishName: "Belize", flag: "🇧🇿" },
    { code: "BJ", chineseName: "贝宁", englishName: "Benin", flag: "🇧🇯" },
    { code: "BT", chineseName: "不丹", englishName: "Bhutan", flag: "🇧🇹" },
    { code: "BO", chineseName: "玻利维亚", englishName: "Bolivia", flag: "🇧🇴" },
    {
      code: "BA",
      chineseName: "波斯尼亚和黑塞哥维那",
      englishName: "Bosnia and Herzegovina",
      flag: "🇧🇦"
    },
    { code: "BW", chineseName: "博茨瓦纳", englishName: "Botswana", flag: "🇧🇼" },
    { code: "BR", chineseName: "巴西", englishName: "Brazil", flag: "🇧🇷" },
    { code: "VG", chineseName: "英属维京群岛", englishName: "British Virgin Islands", flag: "🇻🇬" },
    { code: "BN", chineseName: "文莱", englishName: "Brunei", flag: "🇧🇳" },
    { code: "BG", chineseName: "保加利亚", englishName: "Bulgaria", flag: "🇧🇬" },
    { code: "BF", chineseName: "布基纳法索", englishName: "Burkina-faso", flag: "🇧🇫" },
    { code: "BI", chineseName: "布隆迪", englishName: "Burundi", flag: "🇧🇮" },
    { code: "KH", chineseName: "柬埔寨", englishName: "Cambodia", flag: "🇰🇭" },
    { code: "CM", chineseName: "喀麦隆", englishName: "Cameroon", flag: "🇨🇲" },
    { code: "CA", chineseName: "加拿大", englishName: "Canada", flag: "🇨🇦" },
    { code: "CV", chineseName: "佛得角", englishName: "CapeVerde", flag: "🇨🇻" },
    { code: "KY", chineseName: "开曼群岛", englishName: "CaymanIslands", flag: "🇰🇾" },
    { code: "CF", chineseName: "中非共和国", englishName: "Central African Republic", flag: "🇨🇫" },
    { code: "TD", chineseName: "乍得", englishName: "Chad", flag: "🇹🇩" },
    { code: "CL", chineseName: "智利", englishName: "Chile", flag: "🇨🇱" },
    { code: "CO", chineseName: "哥伦比亚", englishName: "Colombia", flag: "🇨🇴" },
    { code: "KM", chineseName: "科摩罗", englishName: "Comoros", flag: "🇰🇲" },
    { code: "CG", chineseName: "刚果(布)", englishName: "Congo-Brazzaville", flag: "🇨🇬" },
    { code: "CD", chineseName: "刚果(金)", englishName: "Congo-Kinshasa", flag: "🇨🇩" },
    { code: "CR", chineseName: "哥斯达黎加", englishName: "CostaRica", flag: "🇨🇷" },
    { code: "HR", chineseName: "克罗地亚", englishName: "Croatia", flag: "🇭🇷" },
    { code: "CY", chineseName: "塞浦路斯", englishName: "Cyprus", flag: "🇨🇾" },
    { code: "CZ", chineseName: "捷克", englishName: "Czech Republic", flag: "🇨🇿" },
    { code: "DK", chineseName: "丹麦", englishName: "Denmark", flag: "🇩🇰" },
    { code: "DJ", chineseName: "吉布提", englishName: "Djibouti", flag: "🇩🇯" },
    { code: "DO", chineseName: "多米尼加共和国", englishName: "Dominican Republic", flag: "🇩🇴" },
    { code: "EC", chineseName: "厄瓜多尔", englishName: "Ecuador", flag: "🇪🇨" },
    { code: "EG", chineseName: "埃及", englishName: "Egypt", flag: "🇪🇬" },
    { code: "SV", chineseName: "萨尔瓦多", englishName: "EISalvador", flag: "🇸🇻" },
    { code: "GQ", chineseName: "赤道几内亚", englishName: "Equatorial Guinea", flag: "🇬🇶" },
    { code: "ER", chineseName: "厄立特里亚", englishName: "Eritrea", flag: "🇪🇷" },
    { code: "EE", chineseName: "爱沙尼亚", englishName: "Estonia", flag: "🇪🇪" },
    { code: "ET", chineseName: "埃塞俄比亚", englishName: "Ethiopia", flag: "🇪🇹" },
    { code: "FJ", chineseName: "斐济", englishName: "Fiji", flag: "🇫🇯" },
    { code: "FI", chineseName: "芬兰", englishName: "Finland", flag: "🇫🇮" },
    { code: "GA", chineseName: "加蓬", englishName: "Gabon", flag: "🇬🇦" },
    { code: "GM", chineseName: "冈比亚", englishName: "Gambia", flag: "🇬🇲" },
    { code: "GE", chineseName: "格鲁吉亚", englishName: "Georgia", flag: "🇬🇪" },
    { code: "GH", chineseName: "加纳", englishName: "Ghana", flag: "🇬🇭" },
    { code: "GR", chineseName: "希腊", englishName: "Greece", flag: "🇬🇷" },
    { code: "GL", chineseName: "格陵兰", englishName: "Greenland", flag: "🇬🇱" },
    { code: "GT", chineseName: "危地马拉", englishName: "Guatemala", flag: "🇬🇹" },
    { code: "GN", chineseName: "几内亚", englishName: "Guinea", flag: "🇬🇳" },
    { code: "GY", chineseName: "圭亚那", englishName: "Guyana", flag: "🇬🇾" },
    { code: "HT", chineseName: "海地", englishName: "Haiti", flag: "🇭🇹" },
    { code: "HN", chineseName: "洪都拉斯", englishName: "Honduras", flag: "🇭🇳" },
    { code: "HU", chineseName: "匈牙利", englishName: "Hungary", flag: "🇭🇺" },
    { code: "IS", chineseName: "冰岛", englishName: "Iceland", flag: "🇮🇸" },
    { code: "IN", chineseName: "印度", englishName: "India", flag: "🇮🇳" },
    { code: "ID", chineseName: "印尼", englishName: "Indonesia", flag: "🇮🇩" },
    { code: "IR", chineseName: "伊朗", englishName: "Iran", flag: "🇮🇷" },
    { code: "IQ", chineseName: "伊拉克", englishName: "Iraq", flag: "🇮🇶" },
    { code: "IE", chineseName: "爱尔兰", englishName: "Ireland", flag: "🇮🇪" },
    { code: "IM", chineseName: "马恩岛", englishName: "Isle of Man", flag: "🇮🇲" },
    { code: "IL", chineseName: "以色列", englishName: "Israel", flag: "🇮🇱" },
    { code: "IT", chineseName: "意大利", englishName: "Italy", flag: "🇮🇹" },
    { code: "CI", chineseName: "科特迪瓦", englishName: "Ivory Coast", flag: "🇨🇮" },
    { code: "JM", chineseName: "牙买加", englishName: "Jamaica", flag: "🇯🇲" },
    { code: "JO", chineseName: "约旦", englishName: "Jordan", flag: "🇯🇴" },
    { code: "KZ", chineseName: "哈萨克斯坦", englishName: "Kazakstan", flag: "🇰🇿" },
    { code: "KE", chineseName: "肯尼亚", englishName: "Kenya", flag: "🇰🇪" },
    { code: "KW", chineseName: "科威特", englishName: "Kuwait", flag: "🇰🇼" },
    { code: "KG", chineseName: "吉尔吉斯斯坦", englishName: "Kyrgyzstan", flag: "🇰🇬" },
    { code: "LA", chineseName: "老挝", englishName: "Laos", flag: "🇱🇦" },
    { code: "LV", chineseName: "拉脱维亚", englishName: "Latvia", flag: "🇱🇻" },
    { code: "LB", chineseName: "黎巴嫩", englishName: "Lebanon", flag: "🇱🇧" },
    { code: "LS", chineseName: "莱索托", englishName: "Lesotho", flag: "🇱🇸" },
    { code: "LR", chineseName: "利比里亚", englishName: "Liberia", flag: "🇱🇷" },
    { code: "LY", chineseName: "利比亚", englishName: "Libya", flag: "🇱🇾" },
    { code: "LT", chineseName: "立陶宛", englishName: "Lithuania", flag: "🇱🇹" },
    { code: "LU", chineseName: "卢森堡", englishName: "Luxembourg", flag: "🇱🇺" },
    { code: "MK", chineseName: "马其顿", englishName: "Macedonia", flag: "🇲🇰" },
    { code: "MG", chineseName: "马达加斯加", englishName: "Madagascar", flag: "🇲🇬" },
    { code: "MW", chineseName: "马拉维", englishName: "Malawi", flag: "🇲🇼" },
    { code: "MY", chineseName: "马来", englishName: "Malaysia", flag: "🇲🇾" },
    { code: "MV", chineseName: "马尔代夫", englishName: "Maldives", flag: "🇲🇻" },
    { code: "ML", chineseName: "马里", englishName: "Mali", flag: "🇲🇱" },
    { code: "MT", chineseName: "马耳他", englishName: "Malta", flag: "🇲🇹" },
    { code: "MR", chineseName: "毛利塔尼亚", englishName: "Mauritania", flag: "🇲🇷" },
    { code: "MU", chineseName: "毛里求斯", englishName: "Mauritius", flag: "🇲🇺" },
    { code: "MX", chineseName: "墨西哥", englishName: "Mexico", flag: "🇲🇽" },
    { code: "MD", chineseName: "摩尔多瓦", englishName: "Moldova", flag: "🇲🇩" },
    { code: "MC", chineseName: "摩纳哥", englishName: "Monaco", flag: "🇲🇨" },
    { code: "MN", chineseName: "蒙古", englishName: "Mongolia", flag: "🇲🇳" },
    { code: "ME", chineseName: "黑山共和国", englishName: "Montenegro", flag: "🇲🇪" },
    { code: "MA", chineseName: "摩洛哥", englishName: "Morocco", flag: "🇲🇦" },
    { code: "MZ", chineseName: "莫桑比克", englishName: "Mozambique", flag: "🇲🇿" },
    { code: "MM", chineseName: "缅甸", englishName: "Myanmar(Burma)", flag: "🇲🇲" },
    { code: "NA", chineseName: "纳米比亚", englishName: "Namibia", flag: "🇳🇦" },
    { code: "NP", chineseName: "尼泊尔", englishName: "Nepal", flag: "🇳🇵" },
    { code: "NL", chineseName: "荷兰", englishName: "Netherlands", flag: "🇳🇱" },
    { code: "NZ", chineseName: "新西兰", englishName: "New Zealand", flag: "🇳🇿" },
    { code: "NI", chineseName: "尼加拉瓜", englishName: "Nicaragua", flag: "🇳🇮" },
    { code: "NE", chineseName: "尼日尔", englishName: "Niger", flag: "🇳🇪" },
    { code: "NG", chineseName: "尼日利亚", englishName: "Nigeria", flag: "🇳🇬" },
    { code: "KP", chineseName: "朝鲜", englishName: "NorthKorea", flag: "🇰🇵" },
    { code: "NO", chineseName: "挪威", englishName: "Norway", flag: "🇳🇴" },
    { code: "OM", chineseName: "阿曼", englishName: "Oman", flag: "🇴🇲" },
    { code: "PK", chineseName: "巴基斯坦", englishName: "Pakistan", flag: "🇵🇰" },
    { code: "PA", chineseName: "巴拿马", englishName: "Panama", flag: "🇵🇦" },
    { code: "PY", chineseName: "巴拉圭", englishName: "Paraguay", flag: "🇵🇾" },
    { code: "PE", chineseName: "秘鲁", englishName: "Peru", flag: "🇵🇪" },
    { code: "PH", chineseName: "菲律宾", englishName: "Philippines", flag: "🇵🇭" },
    { code: "PT", chineseName: "葡萄牙", englishName: "Portugal", flag: "🇵🇹" },
    { code: "PR", chineseName: "波多黎各", englishName: "PuertoRico", flag: "🇵🇷" },
    { code: "QA", chineseName: "卡塔尔", englishName: "Qatar", flag: "🇶🇦" },
    { code: "RO", chineseName: "罗马尼亚", englishName: "Romania", flag: "🇷🇴" },
    { code: "RU", chineseName: "俄罗斯", englishName: "Russia", flag: "🇷🇺" },
    { code: "RW", chineseName: "卢旺达", englishName: "Rwanda", flag: "🇷🇼" },
    { code: "SM", chineseName: "圣马力诺", englishName: "SanMarino", flag: "🇸🇲" },
    { code: "SA", chineseName: "沙特阿拉伯", englishName: "SaudiArabia", flag: "🇸🇦" },
    { code: "SN", chineseName: "塞内加尔", englishName: "Senegal", flag: "🇸🇳" },
    { code: "RS", chineseName: "塞尔维亚", englishName: "Serbia", flag: "🇷🇸" },
    { code: "SL", chineseName: "塞拉利昂", englishName: "SierraLeone", flag: "🇸🇱" },
    { code: "SK", chineseName: "斯洛伐克", englishName: "Slovakia", flag: "🇸🇰" },
    { code: "SI", chineseName: "斯洛文尼亚", englishName: "Slovenia", flag: "🇸🇮" },
    { code: "SO", chineseName: "索马里", englishName: "Somalia", flag: "🇸🇴" },
    { code: "ZA", chineseName: "南非", englishName: "SouthAfrica", flag: "🇿🇦" },
    { code: "ES", chineseName: "西班牙", englishName: "Spain", flag: "🇪🇸" },
    { code: "LK", chineseName: "斯里兰卡", englishName: "SriLanka", flag: "🇱🇰" },
    { code: "SD", chineseName: "苏丹", englishName: "Sudan", flag: "🇸🇩" },
    { code: "SR", chineseName: "苏里南", englishName: "Suriname", flag: "🇸🇷" },
    { code: "SZ", chineseName: "斯威士兰", englishName: "Swaziland", flag: "🇸🇿" },
    { code: "SE", chineseName: "瑞典", englishName: "Sweden", flag: "🇸🇪" },
    { code: "CH", chineseName: "瑞士", englishName: "Switzerland", flag: "🇨🇭" },
    { code: "SY", chineseName: "叙利亚", englishName: "Syria", flag: "🇸🇾" },
    { code: "TJ", chineseName: "塔吉克斯坦", englishName: "Tajikstan", flag: "🇹🇯" },
    { code: "TZ", chineseName: "坦桑尼亚", englishName: "Tanzania", flag: "🇹🇿" },
    { code: "TH", chineseName: "泰国", englishName: "Thailand", flag: "🇹🇭" },
    { code: "TG", chineseName: "多哥", englishName: "Togo", flag: "🇹🇬" },
    { code: "TO", chineseName: "汤加", englishName: "Tonga", flag: "🇹🇴" },
    { code: "TT", chineseName: "特立尼达和多巴哥", englishName: "TrinidadandTobago", flag: "🇹🇹" },
    { code: "TN", chineseName: "突尼斯", englishName: "Tunisia", flag: "🇹🇳" },
    { code: "TR", chineseName: "土耳其", englishName: "Turkey", flag: "🇹🇷" },
    { code: "TM", chineseName: "土库曼斯坦", englishName: "Turkmenistan", flag: "🇹🇲" },
    { code: "VI", chineseName: "美属维尔京群岛", englishName: "U.S.Virgin Islands", flag: "🇻🇮" },
    { code: "UG", chineseName: "乌干达", englishName: "Uganda", flag: "🇺🇬" },
    { code: "UA", chineseName: "乌克兰", englishName: "Ukraine", flag: "🇺🇦" },
    { code: "UY", chineseName: "乌拉圭", englishName: "Uruguay", flag: "🇺🇾" },
    { code: "UZ", chineseName: "乌兹别克斯坦", englishName: "Uzbekistan", flag: "🇺🇿" },
    { code: "VE", chineseName: "委内瑞拉", englishName: "Venezuela", flag: "🇻🇪" },
    { code: "VN", chineseName: "越南", englishName: "Vietnam", flag: "🇻🇳" },
    { code: "YE", chineseName: "也门", englishName: "Yemen", flag: "🇾🇪" },
    { code: "ZM", chineseName: "赞比亚", englishName: "Zambia", flag: "🇿🇲" },
    { code: "ZW", chineseName: "津巴布韦", englishName: "Zimbabwe", flag: "🇿🇼" },
    { code: "AD", chineseName: "安道尔", englishName: "Andorra", flag: "🇦🇩" },
    { code: "RE", chineseName: "留尼汪", englishName: "Reunion", flag: "🇷🇪" },
    { code: "PL", chineseName: "波兰", englishName: "Poland", flag: "🇵🇱" },
    { code: "GU", chineseName: "关岛", englishName: "Guam", flag: "🇬🇺" },
    { code: "VA", chineseName: "梵蒂冈", englishName: "Vatican", flag: "🇻🇦" },
    { code: "LI", chineseName: "列支敦士登", englishName: "Liechtensteins", flag: "🇱🇮" },
    { code: "CW", chineseName: "库拉索", englishName: "Curacao", flag: "🇨🇼" },
    { code: "SC", chineseName: "塞舌尔", englishName: "Seychelles", flag: "🇸🇨" },
    { code: "AQ", chineseName: "南极", englishName: "Antarctica", flag: "🇦🇶" },
    { code: "GI", chineseName: "直布罗陀", englishName: "Gibraltar", flag: "🇬🇮" },
    { code: "CU", chineseName: "古巴", englishName: "Cuba", flag: "🇨🇺" },
    { code: "FO", chineseName: "法罗群岛", englishName: "Faroe Islands", flag: "🇫🇴" },
    { code: "AX", chineseName: "奥兰群岛", englishName: "Ahvenanmaa", flag: "🇦🇽" },
    { code: "BM", chineseName: "百慕达", englishName: "Bermuda", flag: "🇧🇲" },
    { code: "TL", chineseName: "东帝汶", englishName: "Timor-Leste", flag: "🇹🇱" }
  ];
  var REGIONS_BY_CODE = new Map(
    REGIONS.map((region) => [region.code, region])
  );
  var HOT_REGIONS = /* @__PURE__ */ new Set(["HK", "TW", "CN", "JP", "SG", "US"]);

  // src/rename/options.ts
  var DEFAULT_FILTER_WORDS = [
    "过期",
    "剩余",
    "官网",
    "套餐",
    "重置",
    "到期",
    "Traffic",
    "Expire",
    "一元机场",
    "客户端",
    "网站"
  ];
  var VALID_OUTPUT_FIELDS = /* @__PURE__ */ new Set(["FG", "ZH", "EN", "QC"]);
  /**
   * 将 hot 参数转为允许保留的地区集合。
   * 真值中没有有效地区代码时使用内置热门集合；返回内置集合时不复制它。
   *
   * @preserve
   * @param {*} [value] hot 原始值；假值关闭筛选，真值按竖线分隔并忽略大小写。
   * @returns {Set<string>|null} 有效地区集合；关闭筛选时返回 null。
   */
  function parseHotRegions(value) {
    if (!value) return null;
    const codes = String(value).toUpperCase().split("|").map((code) => code.trim()).filter(Boolean);
    const matched = new Set(codes.filter((code) => REGIONS_BY_CODE.has(code)));
    return matched.size > 0 ? matched : HOT_REGIONS;
  }
  /**
   * 将内置信息节点过滤词和自定义词合并为不区分大小写的字面匹配正则。
   * 仅显式值转为字符串并去空白后为空时禁用过滤；undefined、false 和 0 仍使用内置词表。
   *
   * @preserve
   * @param {*} [value] filter 原始值；真值先 URL 解码，再按竖线拆分自定义过滤词。
   * @returns {RegExp|null} 信息节点过滤正则；显式禁用时返回 null。
   * @throws {URIError} 自定义值包含无效的 URL 百分号编码时抛出。
   */
  function parseFilterPattern(value) {
    if (value !== void 0 && String(value).trim() === "") return null;
    const customWords = value ? decodeURIComponent(String(value)).split("|").map((word) => word.trim()).filter(Boolean) : [];
    return new RegExp(
      [...DEFAULT_FILTER_WORDS, ...customWords].map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
      "i"
    );
  }
  /**
   * 解析自定义保留关键词，独立识别 false/0 字符串并移除 true/1 开关词。
   * 不进行 URL 解码；空数组表示启用内置保留词且不追加自定义词。
   *
   * @preserve
   * @param {*} [value] retain 原始值；undefined 使用默认词表，字符串化后的 false 或 0 禁用保留。
   * @returns {string[]|null} 按竖线拆分并去空白的自定义关键词；禁用时返回 null。
   */
  function parseRetainKeywords(value) {
    if (value === void 0) return [];
    const text = String(value).trim();
    if (text === "0" || text.toLowerCase() === "false") return null;
    return text.split("|").map((word) => word.trim()).filter((word) => word && word !== "1" && word.toLowerCase() !== "true");
  }
  /**
   * 将 Sub-Store 参数归一化为过滤、地区选择、关键词保留和命名选项。
   * remove/one 使用 JavaScript 真值语义，filter/block 解码 URL 文本，retain 单独识别 false/0。
   *
   * @preserve
   * @param {Object|null} [args={}] 原始脚本参数；null 同样使用默认值。
   * @param {*} [args.remove=true] 是否移除原名；只有 undefined 使用默认 true。
   * @param {*} [args.one=false] 是否移除唯一完整名称的 01 序号。
   * @param {*} [args.hot] 热门地区开关或竖线分隔代码；假值不筛选。
   * @param {*} [args.filter] 自定义信息节点过滤词；省略保留内置词表，空白字符串关闭过滤。
   * @param {*} [args.block] URL 编码的屏蔽正则；假值不屏蔽，启用时使用 gi 标记。
   * @param {*} [args.retain] 自定义保留词或开关；省略启用内置词，false/0 禁用。
   * @param {*} [args.out='FG|EN'] 竖线分隔输出字段；有效项为空时回退到 FG、EN。
   * @returns {RenameOptions} 已解析的重命名选项，不修改传入参数。
   * @throws {URIError} filter 或 block 包含无效 URL 编码时抛出。
   * @throws {SyntaxError} 解码后的 block 无法编译为正则时抛出。
   */
  function parseRenameOptions(args = {}) {
    const outputFields = (args?.out ? String(args.out) : "FG|EN").split("|").map((field) => field.trim().toUpperCase()).filter((field) => VALID_OUTPUT_FIELDS.has(field));
    return {
      removeOriginalName: args?.remove === void 0 ? true : !!args.remove,
      removeUniqueSequence: !!args?.one,
      hotRegions: parseHotRegions(args?.hot),
      filterPattern: parseFilterPattern(args?.filter),
      blockPattern: args?.block ? new RegExp(decodeURIComponent(String(args.block)), "gi") : null,
      retainKeywords: parseRetainKeywords(args?.retain),
      outputFields: outputFields.length > 0 ? outputFields : ["FG", "EN"]
    };
  }

  // src/rename/aliases.ts
  var REGION_ALIASES = {
    香港: /Hongkong|HONG KONG|HKG|港(?!.*线)/gi,
    台湾: /新台|新北|TPE|TSA|台(?!.*线)/g,
    Taiwan: /Taipei/g,
    日本: /东京|大坂|NRT|HND|KIX|OSA|(深|沪|呼|京|广|杭|中|辽)日(?!.*(I|线))/g,
    Japan: /Tokyo|Osaka/g,
    韩国: /春川|首尔|ICN|GMP|韩(?!.*国)/g,
    Korea: /Seoul|Chuncheon/g,
    新加坡: /狮城|SIN|(深|沪|呼|京|广|杭)新/g,
    美国: /USA|LAX|SJC|SEA|SFO|JFK|EWR|IAD|ORD|DFW|MIA|ATL|IAH|PHX|DEN|LAS|BOS|Los Angeles|San Jose|Silicon Valley|Michigan|波特兰|芝加哥|哥伦布|纽约|硅谷|俄勒冈|西雅图|(深|沪|呼|京|广|杭)美/g,
    英国: /伦敦|LHR|LGW|STN|MAN|BHX|EDI|GLA/g,
    "United Kingdom": /UK|Great Britain|London/g,
    澳大利亚: /澳洲|墨尔本|悉尼|SYD|MEL|BNE|PER|ADL|CBR|(深|沪|呼|京|广|杭)澳/g,
    Australia: /Sydney|Melbourne/g,
    德国: /法兰克福|FRA|MUC|DUS|BER|HAM|STR|CGN|(深|沪|呼|京|广|杭)德(?!.*(I|线))/g,
    Germany: /Frankfurt/g,
    俄罗斯: /莫斯科|SVO|DME|LED|VKO/g,
    Russia: /Moscow/g,
    土耳其: /伊斯坦布尔|IST|SAW|ESB/g,
    Turkey: /Istanbul/g,
    印度: /孟买|BOM|DEL|BLR|MAA|CCU|HYD/g,
    India: /Mumbai/g,
    印尼: /印度尼西亚|雅加达|CGK|SUB|DPS/g,
    Indonesia: /Jakarta/g,
    法国: /巴黎|CDG|ORY|LYS|NCE|MRS/g,
    France: /Paris/g,
    Switzerland: /Zurich|ZRH|GVA/g,
    阿联酋: /迪拜|阿拉伯联合酋长国|DXB|AUH|SHJ/g,
    Dubai: /United Arab Emirates/g,
    泰国: /泰國|曼谷|BKK|DMK|HKT/g,
    中国: /中國/g,
    // 新增地区机场代码
    荷兰: /AMS/g,
    马来: /KUL|PEN|BKI/g,
    菲律宾: /MNL|CEB/g,
    加拿大: /YYZ|YVR|YUL|YYC|YEG|YOW/g,
    波兰: /WAW|KRK/g,
    捷克: /PRG/g,
    奥地利: /VIE/g,
    匈牙利: /BUD/g,
    比利时: /BRU/g,
    葡萄牙: /LIS|OPO/g,
    西班牙: /MAD|BCN/g,
    意大利: /FCO|MXP|VCE/g,
    挪威: /OSL/g,
    瑞典: /ARN/g,
    芬兰: /HEL/g,
    丹麦: /CPH/g,
    罗马尼亚: /OTP/g,
    以色列: /TLV/g,
    沙特阿拉伯: /RUH|JED/g,
    卡塔尔: /DOH/g,
    南非: /JNB|CPT/g,
    墨西哥: /MEX|CUN/g,
    阿根廷: /EZE/g,
    哥伦比亚: /BOG/g,
    巴西: /GRU|GIG/g
  };

  // src/rename/identify.ts
  /**
   * 先替换地区别名，再依次匹配中文名、国旗、英文全称和地区代码。
   * 各阶段均按地区表顺序返回首个命中；别名替换后的代码匹配忽略大小写并限制字母边界。
   *
   * @preserve
   * @param {string} name 待识别的节点名称。
   * @returns {string|null} 命中的标准地区代码；没有匹配时返回 null。
   */
  function matchNameToCode(name) {
    let processed = name;
    for (const [target, pattern] of Object.entries(REGION_ALIASES)) {
      if (pattern.test(processed)) processed = processed.replace(pattern, target);
    }
    for (const field of ["chineseName", "flag", "englishName"]) {
      for (const region of REGIONS) {
        if (processed.includes(region[field])) return region.code;
      }
    }
    for (const region of REGIONS) {
      const pattern = new RegExp(`(?<![A-Za-z])${region.code}(?![A-Za-z])`, "i");
      if (pattern.test(processed)) return region.code;
    }
    return null;
  }
  /**
   * 将地区代码转为大写，并把展示用的 UK 映射为标准代码 GB。
   *
   * @preserve
   * @param {*} code 待归一化的代码；假值按空字符串处理。
   * @returns {string|null} 地区表中存在的标准代码；未知代码返回 null。
   */
  function normalizeCountryCode(code) {
    const upper = String(code || "").toUpperCase();
    if (REGIONS_BY_CODE.has(upper)) return upper;
    return upper === "UK" ? "GB" : null;
  }
  /**
   * 解析 COUNTRY-NN-PROVIDER 或 COUNTRY-LINE-NN-PROVIDER 格式。
   * 不检查订阅来源；允许开头带国旗，序号为一至三位数字，服务商可包含连字符分段。
   *
   * @preserve
   * @param {*} name 原节点名；假值按空字符串处理，其余值转为字符串并去除首尾空白。
   * @returns {VikingName|null} 标准代码、展示代码、原旗帜及后缀；格式或地区无效时返回 null。
   */
  function parseVikingName(name) {
    const trimmed = String(name || "").trim();
    const flagMatch = trimmed.match(/^([\u{1F1E6}-\u{1F1FF}]{2})\s*/u);
    const rawName = flagMatch ? trimmed.slice(flagMatch[0].length) : trimmed;
    const parts = rawName.split("-").map((part) => part.trim()).filter(Boolean);
    if (parts.length < 3 || !/^[A-Z]{2}$/i.test(parts[0])) return null;
    const displayCode = parts[0].toUpperCase();
    const countryCode = normalizeCountryCode(displayCode);
    if (!countryCode) return null;
    let line = "";
    let providerParts = [];
    if (/^\d{1,3}$/.test(parts[1])) {
      providerParts = parts.slice(2);
    } else if (parts.length >= 4 && /^\d{1,3}$/.test(parts[2])) {
      line = parts[1];
      providerParts = parts.slice(3);
    } else {
      return null;
    }
    const provider = providerParts.join(" ").replace(/\s+/g, " ").trim();
    if (!provider) return null;
    return {
      countryCode,
      displayCode,
      flag: flagMatch?.[1] || "",
      suffix: [line, provider].filter(Boolean).join(" ")
    };
  }
  /**
   * 从节点名称识别地区：先尝试 Viking 格式，再剥离域名并匹配地区。
   * 与服务器地址和订阅来源无关，不访问网络。
   *
   * @preserve
   * @param {string} name 待识别的节点名称。
   * @returns {string|null} 命中的标准地区代码；无法识别时返回 null。
   */
  function identifyCountryFromName(name) {
    const vikingName = parseVikingName(name);
    const withoutDomains = name.replace(/[a-zA-Z0-9]([a-zA-Z0-9-]*\.)+[a-zA-Z]+/g, "");
    return vikingName?.countryCode || matchNameToCode(withoutDomains);
  }
  /**
   * 仅从节点名称识别地区：先移除屏蔽内容并尝试 Viking 格式，再剥离域名并匹配地区。
   * 不修改节点；server 为假值时直接返回 null，不执行名称识别。
   *
   * @preserve
   * @param {Object} proxy 待识别的节点。
   * @param {string} proxy.name 原节点名。
   * @param {string} [proxy.server] 节点服务器；仅用于判断是否允许识别，不查询其地理位置。
   * @param {RegExp|null} [blockPattern] 识别前移除名称片段的正则；省略或 null 时不屏蔽。
   * @returns {string|null} 命中的标准地区代码；无法识别时返回 null。
   */
  function identifyCountry(proxy, blockPattern) {
    if (!proxy.server) return null;
    const cleanName = blockPattern ? proxy.name.replace(blockPattern, "") : proxy.name;
    return identifyCountryFromName(cleanName);
  }

  // src/rename/keywords.ts
  var RETAIN_KEYWORDS = [
    // 日本
    "东京",
    "大坂",
    "Tokyo",
    "Osaka",
    "NRT",
    "HND",
    "KIX",
    "OSA",
    // 韩国
    "首尔",
    "春川",
    "Seoul",
    "Chuncheon",
    "ICN",
    "GMP",
    // 美国
    "纽约",
    "洛杉矶",
    "硅谷",
    "西雅图",
    "芝加哥",
    "波特兰",
    "哥伦布",
    "俄勒冈",
    "Los Angeles",
    "San Jose",
    "Silicon Valley",
    "New York",
    "Seattle",
    "Chicago",
    "LAX",
    "SJC",
    "SEA",
    "SFO",
    "JFK",
    "EWR",
    "IAD",
    "ORD",
    "DFW",
    "MIA",
    "ATL",
    "IAH",
    "PHX",
    "DEN",
    "LAS",
    "BOS",
    // 英国
    "伦敦",
    "London",
    "LHR",
    "LGW",
    "STN",
    "MAN",
    // 澳大利亚
    "悉尼",
    "墨尔本",
    "Sydney",
    "Melbourne",
    "SYD",
    "MEL",
    "BNE",
    "PER",
    // 德国
    "法兰克福",
    "Frankfurt",
    "FRA",
    "MUC",
    "BER",
    // 俄罗斯
    "莫斯科",
    "Moscow",
    "SVO",
    "DME",
    // 土耳其
    "伊斯坦布尔",
    "Istanbul",
    "IST",
    "SAW",
    // 印度
    "孟买",
    "Mumbai",
    "BOM",
    "DEL",
    "BLR",
    // 印尼
    "雅加达",
    "Jakarta",
    "CGK",
    "DPS",
    // 法国
    "巴黎",
    "Paris",
    "CDG",
    "ORY",
    // 瑞士
    "苏黎世",
    "Zurich",
    "ZRH",
    // 阿联酋
    "迪拜",
    "Dubai",
    "DXB",
    "AUH",
    // 泰国
    "曼谷",
    "Bangkok",
    "BKK",
    "DMK",
    // 台湾
    "台北",
    "Taipei",
    "TPE",
    // 荷兰
    "阿姆斯特丹",
    "Amsterdam",
    "AMS",
    // 加拿大
    "多伦多",
    "温哥华",
    "Toronto",
    "Vancouver",
    "YYZ",
    "YVR",
    // 马来西亚
    "吉隆坡",
    "Kuala Lumpur",
    "KUL",
    // 菲律宾
    "马尼拉",
    "Manila",
    "MNL",
    // 波兰
    "华沙",
    "Warsaw",
    "WAW",
    // 捷克
    "布拉格",
    "Prague",
    "PRG",
    // 奥地利
    "维也纳",
    "Vienna",
    "VIE",
    // 西班牙
    "马德里",
    "巴塞罗那",
    "Madrid",
    "Barcelona",
    "MAD",
    "BCN",
    // 意大利
    "米兰",
    "罗马",
    "Milan",
    "Rome",
    "MXP",
    "FCO",
    // 葡萄牙
    "里斯本",
    "Lisbon",
    "LIS",
    // 瑞典
    "斯德哥尔摩",
    "Stockholm",
    "ARN",
    // 芬兰
    "赫尔辛基",
    "Helsinki",
    "HEL",
    // 丹麦
    "哥本哈根",
    "Copenhagen",
    "CPH",
    // 挪威
    "奥斯陆",
    "Oslo",
    "OSL",
    // 以色列
    "特拉维夫",
    "Tel Aviv",
    "TLV",
    // 沙特阿拉伯
    "利雅得",
    "吉达",
    "Riyadh",
    "Jeddah",
    "RUH",
    "JED",
    // 卡塔尔
    "多哈",
    "Doha",
    "DOH",
    // 南非
    "约翰内斯堡",
    "Johannesburg",
    "JNB",
    // 巴西
    "圣保罗",
    "Sao Paulo",
    "GRU",
    // 墨西哥
    "墨西哥城",
    "Mexico City",
    "MEX",
    "via",
    //VPS商/专线常见词
    "BAGE",
    "GOMAMI",
    "AKARI",
    "DMIT",
    "NETCUP",
    "NUBE",
    "MISAKA",
    "Sakura",
    "家宽",
    "专线",
    "高级专线",
    "IEPL",
    "Edge",
    "HKT",
    "HINET",
    "GIA",
    "CIA",
    "BGP",
    "流媒体",
    "高速",
    "移动",
    "联通",
    "电信",
    "移联",
    "AWS",
    "RS",
    "OVH",
    "CDN",
    "下载",
    "OCTO",
    "CTCUCM",
    "CMCU",
    "CUCM",
    "CTCU",
    "CM",
    "CT",
    "CU"
  ];
  var RETAIN_PIPE_TAG_PATTERNS = [/^(?:CM|CT|CU)+$/i, /^(?:\d+(?:\.\d+)?|\.\d+)x$/i];
  /**
   * 从首个管道之后的分段中提取完整的运营商组合标签或数字倍率标签。
   * 保留标签原文和顺序，此步骤不去重。
   *
   * @preserve
   * @param {*} name 原节点名；假值按空字符串处理，其余值转为字符串。
   * @returns {string[]} 去除首尾空白的匹配标签；没有后续分段或匹配时返回空数组。
   */
  function extractRetainPipeTags(name) {
    const parts = String(name || "").split("|").map((s) => s.trim()).filter(Boolean);
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
  function extractRetainKeywords(name, retainKeys) {
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
      const isAscii = /^[A-Za-z0-9]+$/.test(kw);
      const re = isAscii ? new RegExp(`(?<![A-Za-z0-9])${kwLower}(?![A-Za-z0-9])`) : new RegExp(kwLower);
      const m = re.exec(nameLower);
      if (!m) return;
      const original = name.slice(m.index, m.index + kw.length);
      pushOriginal(original);
    };
    for (const kw of RETAIN_KEYWORDS) pushHit(kw);
    for (const tag of extractRetainPipeTags(name)) pushOriginal(tag);
    for (const kw of retainKeys) pushHit(kw);
    hits.sort((a, b) => nameLower.indexOf(a.toLowerCase()) - nameLower.indexOf(b.toLowerCase()));
    return hits.filter(
      (kw) => !hits.some((other) => other !== kw && other.toLowerCase().includes(kw.toLowerCase()))
    );
  }

  // src/rename/format.ts
  /**
   * 将地区代码中的英文字母转为区域指示符，TW 按现有展示约定使用萨摩亚旗帜。
   *
   * @preserve
   * @param {string|null} [countryCode] 地区代码；假值使用通用地球图标。
   * @returns {string} 地区旗帜，或缺少代码时的 🌐。
   */
  function getFlagEmoji(countryCode) {
    if (!countryCode) return "🌐";
    if (countryCode.toUpperCase() === "TW") return "🇼🇸";
    return countryCode.toUpperCase().replace(/[A-Z]/gu, (char) => String.fromCodePoint(char.charCodeAt(0) + 127397));
  }
  /**
   * 按指定字段顺序组合地区标签，优先保留 Viking 名称自带的旗帜和展示代码。
   * 中文名和英文全称查不到地区记录时回退到传入代码。
   *
   * @preserve
   * @param {string} countryCode 已识别的标准地区代码。
   * @param {import('./identify.ts').VikingName|null} vikingName Viking 解析结果；null 使用标准地区展示。
   * @param {string[]} outputFields 输出字段顺序，可包含 FG、ZH、EN、QC。
   * @returns {string} 用空格连接的地区标签。
   */
  function formatCountryLabel(countryCode, vikingName, outputFields) {
    const region = REGIONS_BY_CODE.get(countryCode);
    const values = {
      FG: vikingName?.flag || getFlagEmoji(countryCode),
      ZH: region?.chineseName || countryCode,
      QC: region?.englishName || countryCode,
      EN: vikingName ? vikingName.displayCode : countryCode
    };
    return outputFields.map((field) => values[field]).join(" ");
  }
  /**
   * 组合地区标签、至少两位序号、原名或保留关键词以及订阅名，不修改节点。
   * Viking 后缀按未经 block 清理的原名解析，仅在其地区与识别结果一致时采用。
   *
   * @preserve
   * @param {Object} proxy 待命名的节点。
   * @param {string} proxy.name 原节点名，用于保留原文、提取关键词和解析 Viking 格式。
   * @param {string} [proxy._subName] 追加到名称末尾的订阅名；假值不追加。
   * @param {string} countryCode 已识别的标准地区代码。
   * @param {number} sequence 当前订阅及地区分组中的序号，从 1 开始。
   * @param {import('./options.ts').RenameOptions} options 已解析的输出格式和保留选项。
   * @returns {string} 格式化后的完整节点名称。
   * @throws {SyntaxError} 需要提取关键词且某个关键词无法编译为正则时抛出。
   */
  function formatProxyName(proxy, countryCode, sequence, options) {
    const parsedName = parseVikingName(proxy.name);
    const vikingName = parsedName?.countryCode === countryCode ? parsedName : null;
    const subName = proxy._subName || "";
    const countryLabel = formatCountryLabel(countryCode, vikingName, options.outputFields);
    const baseName = [countryLabel, String(sequence).padStart(2, "0")].filter(Boolean).join(" ");
    /**
     * 在名称后追加当前节点的订阅名，忽略空片段。
     *
     * @preserve
     * @param {string} name 需要保留的名称或关键词片段。
     * @returns {string} 用空格连接的片段与订阅名。
     */
    const appendSubName = (name) => [name, subName].filter(Boolean).join(" ");
    /**
     * 用管道分隔非空命名片段。
     *
     * @preserve
     * @param {...string} parts 按输出顺序传入的地区序号和名称后缀。
     * @returns {string} 用“ | ”连接且不含空片段的名称。
     */
    const joinNameParts = (...parts) => parts.filter(Boolean).join(" | ");
    if (!options.removeOriginalName) return joinNameParts(baseName, appendSubName(proxy.name));
    if (!options.retainKeywords) return joinNameParts(baseName, subName);
    if (vikingName) return joinNameParts(baseName, appendSubName(vikingName.suffix));
    const retained = extractRetainKeywords(proxy.name, options.retainKeywords);
    return joinNameParts(baseName, appendSubName(retained.join(" ")));
  }
  /**
   * 按去掉两位序号后的完整名称计数，只为计数为一的名称移除 01 序号。
   * 后缀不同视为不同名称；直接修改传入节点对象的 name，其他序号保持原样。
   *
   * @preserve
   * @param {Array<{name: string}>} proxies 已完成命名和筛选的节点，亦可包含保留原名的未知地区节点。
   * @returns {void} 无返回值，修改结果保存在原节点对象中。
   */
  function removeUniqueSequence(proxies) {
    /**
     * 移除位于名称末尾或管道后缀之前的两位序号，用于归并完整名称。
     *
     * @preserve
     * @param {string} name 待计算归并键的完整名称。
     * @returns {string} 移除两位序号但保留原管道后缀的名称；不匹配时返回原文。
     */
    const withoutSequence = (name) => name.replace(/\s+\d{2}(\s*\|.*)?$/, (_, suffix) => suffix || "");
    const nameCounts = /* @__PURE__ */ new Map();
    for (const proxy of proxies) {
      const baseName = withoutSequence(proxy.name);
      nameCounts.set(baseName, (nameCounts.get(baseName) || 0) + 1);
    }
    for (const proxy of proxies) {
      if (nameCounts.get(withoutSequence(proxy.name)) === 1) {
        proxy.name = proxy.name.replace(/\s+01(\s*\|)/, "$1").replace(/\s+01$/, "");
      }
    }
  }

  // src/rename/index.ts
  /**
   * 按热门地区、其他已识别地区、未知地区排序，已识别节点再按地区代码和最终名称排序。
   * 两个未知节点视为相等，以便稳定排序保留它们的输入顺序。
   *
   * @preserve
   * @param {{name: string}} a 待比较的前一个节点。
   * @param {{name: string}} b 待比较的后一个节点。
   * @param {Map<Object, string>} countries 按节点对象引用保存的已识别地区代码。
   * @returns {number} 负数表示 a 在前，正数表示 b 在前，0 表示排序等价。
   */
  function compareProxiesByRegion(a, b, countries) {
    const countryA = countries.get(a);
    const countryB = countries.get(b);
    if (!countryA && !countryB) return 0;
    if (!countryA) return 1;
    if (!countryB) return -1;
    const hotA = HOT_REGIONS.has(countryA);
    const hotB = HOT_REGIONS.has(countryB);
    if (hotA && !hotB) return -1;
    if (!hotA && hotB) return 1;
    return countryA.localeCompare(countryB) || a.name.localeCompare(b.name);
  }
  /**
   * 过滤信息节点、识别地区，按订阅和地区编号命名，再进行 hot 筛选、排序和可选去序号。
   * 仅使用传入数据并通过 logger.log 输出处理日志，不读取 Sub-Store 全局变量或访问网络。
   * 已识别节点浅拷贝后改名，未知节点保留对象引用；启用 one 时可能修改未知节点的原对象名称。
   *
   * @preserve
   * @param {Object[]} proxies 输入节点数组，节点应包含 name，并可包含 server、_subName 及其他协议字段。
   * @param {Object|null} [args={}] 原始脚本参数，字段和默认值由 parseRenameOptions 定义。
   * @param {{log: function(...*): void}} [logger=console] 接收处理进度和重命名信息的日志对象。
   * @returns {Object[]} 筛选和排序后的新数组，保留节点的非名称字段。
   * @throws {URIError} filter 或 block 参数包含无效 URL 编码时抛出。
   * @throws {SyntaxError} block 或保留关键词无法编译为正则时抛出。
   */
  function renameProxies(proxies, args = {}, logger = console) {
    const options = parseRenameOptions(args);
    const hotOnly = options.hotRegions !== null;
    logger.log(
      `[geo-tag] 开始处理，共 ${proxies.length} 个节点，removeOriginalName=${options.removeOriginalName}，hotOnly=${hotOnly}`
    );
    if (options.filterPattern) {
      const before = proxies.length;
      proxies = proxies.filter((proxy) => !options.filterPattern.test(proxy.name));
      logger.log(
        `[geo-tag] filter 过滤: ${before - proxies.length} 个节点被丢弃，剩余 ${proxies.length} 个`
      );
    }
    const countries = /* @__PURE__ */ new Map();
    let nameHitCount = 0;
    for (const proxy of proxies) {
      const countryCode = identifyCountry(proxy, options.blockPattern);
      if (countryCode) {
        countries.set(proxy, countryCode);
        nameHitCount++;
        logger.log(`[geo-tag] 名称命中: ${proxy.name} → ${countryCode}`);
      }
    }
    logger.log(`[geo-tag] 名称命中 ${nameHitCount}/${proxies.length} 个节点`);
    const sequenceByGroup = /* @__PURE__ */ new Map();
    const renamedProxies = proxies.map((proxy) => {
      const countryCode = countries.get(proxy);
      if (!countryCode) return proxy;
      const key = `${proxy._subName || ""}|${countryCode}`;
      const sequence = (sequenceByGroup.get(key) || 0) + 1;
      sequenceByGroup.set(key, sequence);
      const name = formatProxyName(proxy, countryCode, sequence, options);
      logger.log(`[geo-tag] 重命名: ${proxy.name} → ${name}`);
      const renamed = { ...proxy, name };
      countries.set(renamed, countryCode);
      return renamed;
    });
    logger.log(`[geo-tag] 完成。名称命中: ${nameHitCount}，未识别: ${proxies.length - nameHitCount}`);
    const result = hotOnly ? renamedProxies.filter((proxy) => {
      const code = countries.get(proxy);
      return code && options.hotRegions.has(code);
    }) : renamedProxies;
    if (hotOnly) logger.log(`[geo-tag] hot 过滤后剩余: ${result.length} 个节点`);
    result.sort((a, b) => compareProxiesByRegion(a, b, countries));
    if (options.removeUniqueSequence) removeUniqueSequence(result);
    return result;
  }

  // src/entries/rename.ts
  /**
   * 使用 Sub-Store 的 $arguments 和控制台日志，按节点名称识别地区并整理名称。
   * @preserve
   * @param {Array<Object>} proxies 待重命名的订阅节点；已识别节点浅拷贝，未知节点保留引用。
   * @param {string} targetPlatform Sub-Store 传入的目标平台，本脚本不使用。
   * @param {Object} context Sub-Store 传入的处理上下文，本脚本不使用。
   * @returns {Promise<Array<Object>>} 按地区排序、完成命名的节点数组；hot 可过滤地区，one 可能改写未知节点的原对象名称。
   * @throws {Error} 参数解码、正则构造或重命名处理失败时，返回的 Promise 拒绝。
   */
  async function operator(proxies, targetPlatform, context) {
    return renameProxies(proxies, $arguments, console);
  }
  return __toCommonJS(rename_exports);
})();
/**
 * 使用 Sub-Store 的 $arguments 和控制台日志，按节点名称识别地区并整理名称。
 * @preserve
 * @param {Array<Object>} proxies 待重命名的订阅节点；已识别节点浅拷贝，未知节点保留引用。
 * @param {string} targetPlatform Sub-Store 传入的目标平台，本脚本不使用。
 * @param {Object} context Sub-Store 传入的处理上下文，本脚本不使用。
 * @returns {Promise<Array<Object>>} 按地区排序、完成命名的节点数组；hot 可过滤地区，one 可能改写未知节点的原对象名称。
 * @throws {Error} 参数解码、正则构造或重命名处理失败时，返回的 Promise 拒绝。
 */
async function operator(proxies, targetPlatform, context) {
  return __proxyConfigScript.operator(proxies, targetPlatform, context);
}
