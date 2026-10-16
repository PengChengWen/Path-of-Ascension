/** 自动战斗预设与数值基线，供原型和独立模拟器共同使用。 */
export type BuildId = 'sword' | 'toxin' | 'ward';
export type DotKind = 'poison' | 'burn';
export type Condition =
  | { type: 'all'; conditions: Condition[] }
  | { type: 'shieldAllowed' }
  | { type: 'always' }
  | { type: 'hpBelow'; value: number }
  | { type: 'intentAtLeast'; value: number }
  | { type: 'armorBreakAtMost'; value: number }
  | { type: 'dotComboAtLeast'; value: number }
  | { type: 'shieldBelow'; value: number }
  | { type: 'shieldAtLeast'; value: number };
export type Effect =
  | { type: 'damage'; attackRatio: number; shieldRatio?: number; intentRatio?: number }
  | { type: 'intent'; stacks: number }
  | { type: 'break'; stacks: number; ticks: number }
  | { type: 'dot'; kind: DotKind; stacks: number; ticks: number; attackRatio: number }
  | { type: 'detonate'; remainingRatio: number }
  | { type: 'shield'; attackRatio: number; hpRatio: number; rounds: number }
  | { type: 'heal'; attackRatio: number; hpRatio: number; perDotHpRatio?: number }
  | { type: 'reduction'; value: number; rounds: number };
export interface SkillConfig {
  id: string;
  name: string;
  build: BuildId;
  cost: number;
  cooldown: number;
  priority: number;
  condition: Condition;
  effects: Effect[];
}
export const RULES = {
  defenseK: 200,
  critMultiplier: 1.5,
  critCap: 0.6,
  reductionCap: 0.5,
  shieldCap: 0.5,
  maxIntent: 6,
  maxDots: 5,
  maxBreak: 3,
  breakPerStack: 0.15,
  manaRegen: 12,
  maxNormalRounds: 20,
  maxBossRounds: 30,
} as const;

export const SKILLS: SkillConfig[] = [
  {
    id: 'sword_focus',
    name: '养锋剑诀',
    build: 'sword',
    cost: 8,
    cooldown: 0,
    priority: 40,
    condition: { type: 'always' },
    effects: [
      { type: 'damage', attackRatio: 1.05 },
      { type: 'intent', stacks: 2 },
    ],
  },
  {
    id: 'sword_break',
    name: '破岳斩',
    build: 'sword',
    cost: 16,
    cooldown: 3,
    priority: 30,
    condition: { type: 'armorBreakAtMost', value: 2 },
    effects: [
      { type: 'damage', attackRatio: 1.45 },
      { type: 'break', stacks: 2, ticks: 5 },
    ],
  },
  {
    id: 'sword_finish',
    name: '万剑归一',
    build: 'sword',
    cost: 28,
    cooldown: 3,
    priority: 20,
    condition: { type: 'intentAtLeast', value: 5 },
    effects: [{ type: 'damage', attackRatio: 1.15, intentRatio: 0.3 }],
  },
  {
    id: 'sword_heal',
    name: '回元诀',
    build: 'sword',
    cost: 12,
    cooldown: 4,
    priority: 10,
    condition: { type: 'hpBelow', value: 0.45 },
    effects: [{ type: 'heal', attackRatio: 0.9, hpRatio: 0.08 }],
  },
  {
    id: 'toxin_seed',
    name: '青蚀蛊',
    build: 'toxin',
    cost: 12,
    cooldown: 0,
    priority: 40,
    condition: { type: 'always' },
    effects: [
      { type: 'damage', attackRatio: 0.55 },
      { type: 'dot', kind: 'poison', stacks: 2, ticks: 3, attackRatio: 0.18 },
    ],
  },
  {
    id: 'toxin_fire',
    name: '离火印',
    build: 'toxin',
    cost: 14,
    cooldown: 1,
    priority: 30,
    condition: { type: 'always' },
    effects: [
      { type: 'damage', attackRatio: 0.65 },
      { type: 'dot', kind: 'burn', stacks: 2, ticks: 3, attackRatio: 0.16 },
    ],
  },
  {
    id: 'toxin_burst',
    name: '灰烬引',
    build: 'toxin',
    cost: 26,
    cooldown: 3,
    priority: 20,
    condition: { type: 'dotComboAtLeast', value: 6 },
    effects: [
      { type: 'damage', attackRatio: 1.2 },
      { type: 'detonate', remainingRatio: 0.65 },
    ],
  },
  {
    id: 'toxin_heal',
    name: '血焰回生',
    build: 'toxin',
    cost: 12,
    cooldown: 4,
    priority: 10,
    condition: { type: 'hpBelow', value: 0.45 },
    effects: [{ type: 'heal', attackRatio: 0.65, hpRatio: 0.06, perDotHpRatio: 0.015 }],
  },
  {
    id: 'ward_strike',
    name: '镇岳印',
    build: 'ward',
    cost: 12,
    cooldown: 0,
    priority: 40,
    condition: { type: 'always' },
    effects: [
      { type: 'damage', attackRatio: 0.9 },
      { type: 'shield', attackRatio: 0.4, hpRatio: 0.025, rounds: 2 },
    ],
  },
  {
    id: 'ward_guard',
    name: '玄水镜',
    build: 'ward',
    cost: 20,
    cooldown: 3,
    priority: 30,
    condition: {
      type: 'all',
      conditions: [{ type: 'shieldBelow', value: 0.15 }, { type: 'shieldAllowed' }],
    },
    effects: [
      { type: 'shield', attackRatio: 0.85, hpRatio: 0.065, rounds: 2 },
      { type: 'reduction', value: 0.2, rounds: 2 },
    ],
  },
  {
    id: 'ward_bash',
    name: '厚土反震',
    build: 'ward',
    cost: 20,
    cooldown: 2,
    priority: 20,
    condition: { type: 'shieldAtLeast', value: 0.1 },
    effects: [{ type: 'damage', attackRatio: 1.1, shieldRatio: 0.6 }],
  },
  {
    id: 'ward_heal',
    name: '润脉诀',
    build: 'ward',
    cost: 18,
    cooldown: 4,
    priority: 10,
    condition: { type: 'hpBelow', value: 0.55 },
    effects: [{ type: 'heal', attackRatio: 0.8, hpRatio: 0.1 }],
  },
];

export const PASSIVES = [
  {
    id: 'sword_intent',
    name: '凝意',
    build: 'sword',
    hook: 'ownActionEnd',
    value: 1,
    rule: '剑意 +1，上限6',
  },
  {
    id: 'sword_crit',
    name: '剑锋常锐',
    build: 'sword',
    hook: 'battleStart',
    value: 0.08,
    rule: '暴击率 +8 个百分点',
  },
  {
    id: 'sword_mana',
    name: '剑心回流',
    build: 'sword',
    hook: 'directCrit',
    value: 5,
    rule: '恢复5灵力，每次自身行动至多一次',
  },
  {
    id: 'sword_edge',
    name: '淬锋',
    build: 'sword',
    hook: 'directDamage',
    value: 0.12,
    rule: '目标有破甲时，直接伤害 +12%',
  },
  {
    id: 'toxin_power',
    name: '毒劲',
    build: 'toxin',
    hook: 'applyDot',
    value: 0.15,
    rule: '毒伤施加快照 +15%',
  },
  {
    id: 'toxin_firelink',
    name: '薪火续燃',
    build: 'toxin',
    hook: 'applyBurn',
    value: 1,
    rule: '目标有毒时，额外施加1层同规格灼烧，每次行动一次',
  },
  {
    id: 'toxin_edge',
    name: '蚀脉',
    build: 'toxin',
    hook: 'directDamage',
    value: 0.1,
    rule: '目标同时有毒和灼烧时，直接伤害 +10%',
  },
  {
    id: 'toxin_mana',
    name: '纳煞',
    build: 'toxin',
    hook: 'beforeDotTick',
    value: 4,
    rule: '敌方有自身施加的毒或火时恢复4灵力，每轮一次',
  },
  {
    id: 'ward_reduction',
    name: '不动身',
    build: 'ward',
    hook: 'battleStart',
    value: 0.1,
    rule: '最终伤害减免 +10 个百分点',
  },
  {
    id: 'ward_shield',
    name: '岩甲',
    build: 'ward',
    hook: 'gainShield',
    value: 0.15,
    rule: '获得护盾量 +15%',
  },
  {
    id: 'ward_counter',
    name: '回澜',
    build: 'ward',
    hook: 'shieldDirectHit',
    value: 0.55,
    rule: '反击造成0.55攻击伤害，每轮一次，不暴击不连锁',
  },
  {
    id: 'ward_regen',
    name: '水土相生',
    build: 'ward',
    hook: 'ownActionEnd',
    value: 0.01,
    rule: '仍有护盾时恢复最大生命1%',
  },
] as const;

export interface EnemyConfig {
  id: string;
  name: string;
  tier: 'normal' | 'elite' | 'boss';
  hp: number;
  attack: number;
  defense: number;
  crit: number;
  burstEvery?: number;
  burstRatio?: number;
  cleanseEvery?: number;
  breakShieldEvery?: number;
  hits?: number;
}
export const ENEMIES: EnemyConfig[] = [
  { id: 'wolf', name: '石牙狼', tier: 'normal', hp: 1100, attack: 110, defense: 60, crit: 0.08 },
  { id: 'ape', name: '铁背猿', tier: 'normal', hp: 1050, attack: 105, defense: 130, crit: 0.08 },
  {
    id: 'bat',
    name: '血羽蝠',
    tier: 'normal',
    hp: 1100,
    attack: 115,
    defense: 45,
    crit: 0.1,
    hits: 2,
  },
  {
    id: 'elite_armor',
    name: '铁甲精英',
    tier: 'elite',
    hp: 1600,
    attack: 125,
    defense: 180,
    crit: 0.1,
  },
  {
    id: 'elite_cleanse',
    name: '净灵使',
    tier: 'elite',
    hp: 1450,
    attack: 120,
    defense: 80,
    crit: 0.1,
    cleanseEvery: 3,
  },
  {
    id: 'elite_breaker',
    name: '碎岩兽',
    tier: 'elite',
    hp: 1600,
    attack: 130,
    defense: 80,
    crit: 0.1,
    breakShieldEvery: 4,
  },
  {
    id: 'tiger',
    name: '黑旗妖虎',
    tier: 'boss',
    hp: 2700,
    attack: 125,
    defense: 90,
    crit: 0.1,
    burstEvery: 4,
    burstRatio: 1.85,
  },
  {
    id: 'golem',
    name: '玄甲古傀',
    tier: 'boss',
    hp: 2100,
    attack: 110,
    defense: 220,
    crit: 0.06,
    burstEvery: 5,
    burstRatio: 1.5,
  },
  {
    id: 'bird',
    name: '濯灵青鸾',
    tier: 'boss',
    hp: 2500,
    attack: 115,
    defense: 85,
    crit: 0.1,
    cleanseEvery: 3,
  },
  {
    id: 'breaker',
    name: '裂盾妖猿',
    tier: 'boss',
    hp: 2600,
    attack: 130,
    defense: 80,
    crit: 0.1,
    breakShieldEvery: 4,
    burstEvery: 4,
    burstRatio: 1.65,
  },
];
export const BASE = { hp: 1800, attack: 120, defense: 80, mana: 100, crit: 0.15 } as const;
export const BUILD_NAMES: Record<BuildId, string> = { sword: '剑修', toxin: '毒火', ward: '水土' };

export function validateCombatContent(): void {
  const ids = new Set<string>();
  for (const item of [...SKILLS, ...PASSIVES, ...ENEMIES]) {
    if (ids.has(item.id)) throw new Error(`重复ID ${item.id}`);
    ids.add(item.id);
  }
  for (const build of Object.keys(BUILD_NAMES) as BuildId[]) {
    if (
      SKILLS.filter((s) => s.build === build).length !== 4 ||
      PASSIVES.filter((s) => s.build === build).length !== 4
    )
      throw new Error('必须4主动4被动');
  }
  for (const s of SKILLS) {
    if (s.cost < 0 || s.cooldown < 0 || !Number.isInteger(s.cooldown))
      throw new Error('非法技能参数');
    if (!s.effects.length) throw new Error('空技能');
  }
}
