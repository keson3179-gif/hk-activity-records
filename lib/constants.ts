export type CategoryKey =
  | "自治綜合性社團"
  | "全校性自治組織"
  | "康樂性社團"
  | "學藝性社團"
  | "服務性社團"
  | "體能性社團";

export type CategoryMeta = {
  color: string;
  activeText: string;
  clubs: string[];
};

export const CLUB_CATEGORIES: Record<CategoryKey, CategoryMeta> = {
  自治綜合性社團: {
    color: "bg-red-600",
    activeText: "text-white",
    clubs: [
      "護理系學會", "物治系學會", "動保系學會", "語聽系學會", "老福系學會",
      "健管系學會", "醫材系學會", "幼保系學會", "美髮系學會", "文化設計系學會",
      "運休系學會", "環安系學會", "智科系學會", "餐旅系學會(日)", "食科系學會(日)",
      "國際語言系學會", "餐旅系學會(夜)", "食科系學會(夜)", "畢聯會(日)", "畢聯會(夜)",
    ],
  },
  全校性自治組織: {
    color: "bg-gray-800",
    activeText: "text-white",
    clubs: ["學生會"],
  },
  康樂性社團: {
    color: "bg-yellow-500",
    activeText: "text-white",
    clubs: [
      "熱舞社", "火舞藝術社", "穿越炸雞社", "國際學生聯誼社", "弘韻國樂社",
      "鋼琴音樂社", "弘櫻吉他社", "熱門音樂社", "管樂社",
    ],
  },
  學藝性社團: {
    color: "bg-green-600",
    activeText: "text-white",
    clubs: [
      "動漫畫研習社", "企業研習社", "桌遊社", "品酒社", "生命探索社",
      "弘光攝影社", "調香社", "創意飲調社", "日本茶道社", "國際餐旅青年學習社",
      "西餐廚藝社", "創藝蔬食崇德社", "時尚甜點社", "原住民食育研究社", "餐飲服務社",
      "餐旅技藝競賽研究社", "延年益智遊戲社",
    ],
  },
  服務性社團: {
    color: "bg-cyan-500",
    activeText: "text-white",
    clubs: [
      "佳音社", "崇德文化青年社", "慈濟青年社", "春暉社", "弘櫻志工隊",
      "原住民文化推廣社", "交通服務隊", "健康天使服務隊", "諮輔志工隊", "住宿志工隊",
    ],
  },
  體能性社團: {
    color: "bg-blue-800",
    activeText: "text-white",
    clubs: [
      "翔風羽球社", "跆拳道社", "棒壘社", "居合劍道社", "空手道社",
      "傳統射箭社", "急速銀籃社", "健身運動指導社", "水上休閒社", "撞球社", "戶外探索社",
    ],
  },
};

export const CATEGORY_KEYS = Object.keys(CLUB_CATEGORIES) as CategoryKey[];
