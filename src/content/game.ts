export const GAME = {
  offlineMs: 12 * 60 * 60 * 1000,
  outingMs: 5 * 60 * 1000,
  saveMs: 10_000,
} as const;
export const REALM_COSTS = [30, 60, 120, 240, 480, 1920, 3840, 7680, 12000];
export const ITEMS = {
  herb: {
    name: '青灵草',
    category: '灵材',
    description: '青岚山常见的灵草，可炼制聚灵丹与筑基丹。',
    glyph: '草',
  },
  dew: {
    name: '凝露花',
    category: '灵材',
    description: '生于雾溪石隙，凝聚晨露，是筑基丹的主材。',
    glyph: '花',
  },
  core: {
    name: '一阶妖丹',
    category: '灵材',
    description: '猎杀妖兽所得，可用于炼制突破丹药。',
    glyph: '丹',
  },
  pill: {
    name: '聚灵丹',
    category: '丹药',
    description: '服用后10分钟内修炼效率提高50%，重复服用延长时间。',
    glyph: '灵',
  },
  foundationPill: {
    name: '筑基丹',
    category: '丹药',
    description: '炼气九层圆满时使用，帮助凝聚道基。',
    glyph: '筑',
  },
  seal: {
    name: '青岚地脉印',
    category: '信物',
    description: '首次击败黑旗妖虎必得，首次筑基的关键凭证。',
    glyph: '印',
  },
} as const;
export type ItemId = keyof typeof ITEMS;
export const LOCATIONS = [
  {
    id: 'herb',
    name: '青岚药径',
    tag: '采集',
    description: '沿着山间药径缓行，寻得草木间的一缕灵机。',
    item: 'herb' as ItemId,
    amount: 3,
    coins: 24,
    level: 1,
  },
  {
    id: 'mist',
    name: '雾溪深处',
    tag: '探查',
    description: '溪雾终年不散，石隙中偶有凝露花绽放。',
    item: 'dew' as ItemId,
    amount: 1,
    coins: 36,
    level: 7,
  },
  {
    id: 'ridge',
    name: '黑旗岭',
    tag: '猎妖',
    description: '妖气盘踞的旧山道，磨砺术法，也收获妖丹。',
    item: 'core' as ItemId,
    amount: 1,
    coins: 50,
    level: 8,
  },
] as const;
export const RECIPES = [
  {
    id: 'spirit',
    name: '聚灵丹',
    description: '养气凝神，助益吐纳。',
    cost: { herb: 3 },
    coins: 30,
    duration: 60_000,
    output: 'pill' as ItemId,
  },
  {
    id: 'foundation',
    name: '筑基丹',
    description: '炼气归元，以灵药凝聚道基。',
    cost: { herb: 6, dew: 3, core: 2 },
    coins: 80,
    duration: 180_000,
    output: 'foundationPill' as ItemId,
  },
] as const;
export const CN_NUMBERS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
