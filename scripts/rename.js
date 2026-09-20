/**
 * @file Sub-Store 节点重命名脚本：仅按名称识别地区，整理序号、关键词和订阅名。
 * 用于订阅或组合订阅的节点处理，在配置文件注入节点前执行。
 * 入口：async function operator(proxies, targetPlatform, context)；接入与参数见 README.md。
 *
 * 此文件由 npm run build 自动生成，请修改 src/ 中的源码。
 * 源码入口：src/entries/rename.js。
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

  // src/entries/rename.js
  var rename_exports = {};
  __export(rename_exports, {
    operator: () => operator
  });

  // src/rename/regions.js
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
  var REGIONS_BY_CODE = new Map(REGIONS.map((region) => [region.code, region]));
  var HOT_REGIONS = /* @__PURE__ */ new Set(["HK", "TW", "CN", "JP", "SG", "US"]);

  // src/rename/options.js
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
  function parseHotRegions(value) {
    if (!value) return null;
    const codes = String(value).toUpperCase().split("|").map((code) => code.trim()).filter(Boolean);
    const matched = new Set(codes.filter((code) => REGIONS_BY_CODE.has(code)));
    return matched.size > 0 ? matched : HOT_REGIONS;
  }
  function parseFilterPattern(value) {
    if (value !== void 0 && String(value).trim() === "") return null;
    const customWords = value ? decodeURIComponent(String(value)).split("|").map((word) => word.trim()).filter(Boolean) : [];
    return new RegExp(
      [...DEFAULT_FILTER_WORDS, ...customWords].map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
      "i"
    );
  }
  function parseRetainKeywords(value) {
    if (value === void 0) return [];
    const text = String(value).trim();
    if (text === "0" || text.toLowerCase() === "false") return null;
    return text.split("|").map((word) => word.trim()).filter((word) => word && word !== "1" && word.toLowerCase() !== "true");
  }
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

  // src/rename/aliases.js
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

  // src/rename/identify.js
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
  function normalizeCountryCode(code) {
    const upper = String(code || "").toUpperCase();
    if (REGIONS_BY_CODE.has(upper)) return upper;
    return upper === "UK" ? "GB" : null;
  }
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
  function identifyCountry(proxy, blockPattern) {
    if (!proxy.server) return null;
    const cleanName = blockPattern ? proxy.name.replace(blockPattern, "") : proxy.name;
    const vikingName = parseVikingName(cleanName);
    const withoutDomains = cleanName.replace(/[a-zA-Z0-9]([a-zA-Z0-9-]*\.)+[a-zA-Z]+/g, "");
    return vikingName?.countryCode || matchNameToCode(withoutDomains);
  }

  // src/rename/keywords.js
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
  function extractRetainPipeTags(name) {
    const parts = String(name || "").split("|").map((s) => s.trim()).filter(Boolean);
    if (parts.length < 2) return [];
    return parts.slice(1).filter((part) => RETAIN_PIPE_TAG_PATTERNS.some((re) => re.test(part)));
  }
  function extractRetainKeywords(name, retainKeys) {
    const hits = [];
    const nameLower = name.toLowerCase();
    const pushOriginal = (value) => {
      if (value && !hits.includes(value)) hits.push(value);
    };
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

  // src/rename/format.js
  function getFlagEmoji(countryCode) {
    if (!countryCode) return "🌐";
    if (countryCode.toUpperCase() === "TW") return "🇼🇸";
    return countryCode.toUpperCase().replace(/[A-Z]/gu, (char) => String.fromCodePoint(char.charCodeAt(0) + 127397));
  }
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
  function formatProxyName(proxy, countryCode, sequence, options) {
    const parsedName = parseVikingName(proxy.name);
    const vikingName = parsedName?.countryCode === countryCode ? parsedName : null;
    const subName = proxy._subName || "";
    const countryLabel = formatCountryLabel(countryCode, vikingName, options.outputFields);
    const baseName = [countryLabel, String(sequence).padStart(2, "0")].filter(Boolean).join(" ");
    const appendSubName = (name) => [name, subName].filter(Boolean).join(" ");
    const joinNameParts = (...parts) => parts.filter(Boolean).join(" | ");
    if (!options.removeOriginalName) return joinNameParts(baseName, appendSubName(proxy.name));
    if (!options.retainKeywords) return joinNameParts(baseName, subName);
    if (vikingName) return joinNameParts(baseName, appendSubName(vikingName.suffix));
    const retained = extractRetainKeywords(proxy.name, options.retainKeywords);
    return joinNameParts(baseName, appendSubName(retained.join(" ")));
  }
  function removeUniqueSequence(proxies) {
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

  // src/rename/index.js
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

  // src/entries/rename.js
  async function operator(proxies, targetPlatform, context) {
    return renameProxies(proxies, $arguments, console);
  }
  return __toCommonJS(rename_exports);
})();
async function operator(proxies, targetPlatform, context) {
  return __proxyConfigScript.operator(proxies, targetPlatform, context);
}
