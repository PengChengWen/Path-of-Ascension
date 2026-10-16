import {
  BASE,
  ENEMIES,
  PASSIVES,
  RULES,
  SKILLS,
  type BuildId,
  type DotKind,
  type Effect,
  type EnemyConfig,
  type SkillConfig,
} from '../content/combat-design';

export interface DotStack {
  kind: DotKind;
  power: number;
  ticks: number;
  serial: number;
}
export interface ShieldLayer {
  value: number;
  expiresAt: number;
  serial: number;
}
export interface Combatant {
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  mana: number;
  maxMana: number;
  crit: number;
  intent: number;
  breaks: { stacks: number; ticks: number };
  dots: DotStack[];
  shields: ShieldLayer[];
  reduction: number;
  reductionExpires: number;
  shieldLockExpires: number;
  cooldowns: Record<string, number>;
}
export interface TraceRow {
  round: number;
  actor: string;
  action: string;
  hp: number;
  enemyHp: number;
  mana: number;
  shield: number;
  intent: number;
  dots: string;
}
export interface SimOptions {
  seed?: number;
  trace?: boolean;
  attackScale?: number;
  hpScale?: number;
  noPassives?: boolean;
  badStrategy?: boolean;
  enemy?: EnemyConfig;
  skillIds?: string[];
  passiveIds?: string[];
}
export interface SimResult {
  build: BuildId;
  enemy: string;
  outcome: 'win' | 'lose' | 'draw' | 'timeout';
  rounds: number;
  playerHp: number;
  enemyHp: number;
  damage: number;
  dotDamage: number;
  counterDamage: number;
  healing: number;
  shieldAbsorbed: number;
  manaFallbacks: number;
  seed: number;
  trace: TraceRow[];
}
export const mitigation = (defense: number) =>
  RULES.defenseK / (RULES.defenseK + Math.max(0, defense));
export const directFormula = (
  attack: number,
  ratio: number,
  defense: number,
  reduction = 0,
  crit = false,
  boost = 1,
) =>
  Math.max(
    1,
    Math.floor(
      attack *
        ratio *
        boost *
        mitigation(defense) *
        (1 - Math.min(RULES.reductionCap, Math.max(0, reduction))) *
        (crit ? RULES.critMultiplier : 1),
    ),
  );
export const healFormula = (attack: number, hp: number, a: number, h: number) =>
  Math.max(0, Math.floor(attack * a + hp * h));
export function makeCombatant(
  hp: number,
  attack: number,
  defense: number,
  crit: number,
  mana = 100,
): Combatant {
  return {
    hp,
    maxHp: hp,
    attack,
    defense,
    crit,
    mana,
    maxMana: mana,
    intent: 0,
    breaks: { stacks: 0, ticks: 0 },
    dots: [],
    shields: [],
    reduction: 0,
    reductionExpires: 0,
    shieldLockExpires: 0,
    cooldowns: {},
  };
}
export const shieldValue = (a: Combatant) => a.shields.reduce((n, s) => n + s.value, 0);
export function grantShield(
  a: Combatant,
  value: number,
  round: number,
  duration: number,
  serial: number,
): void {
  if (round < a.shieldLockExpires) return;
  const granted = Math.min(
    Math.max(0, Math.floor(value)),
    Math.max(0, Math.floor(a.maxHp * RULES.shieldCap) - shieldValue(a)),
  );
  if (granted > 0) a.shields.push({ value: granted, expiresAt: round + duration, serial });
}
export function applyDot(
  a: Combatant,
  kind: DotKind,
  power: number,
  ticks: number,
  stacks: number,
  nextSerial: () => number,
): void {
  for (let i = 0; i < stacks; i++) {
    const same = a.dots
      .filter((d) => d.kind === kind)
      .sort((x, y) => x.ticks - y.ticks || x.serial - y.serial);
    if (same.length >= RULES.maxDots) a.dots.splice(a.dots.indexOf(same[0]), 1);
    a.dots.push({ kind, power, ticks, serial: nextSerial() });
  }
}
export function absorbDamage(a: Combatant, damage: number): { hpDamage: number; absorbed: number } {
  let remaining = Math.max(0, Math.floor(damage)),
    absorbed = 0;
  a.shields.sort((x, y) => x.expiresAt - y.expiresAt || x.serial - y.serial);
  for (const s of a.shields) {
    const taken = Math.min(s.value, remaining);
    s.value -= taken;
    remaining -= taken;
    absorbed += taken;
    if (remaining === 0) break;
  }
  a.shields = a.shields.filter((s) => s.value > 0);
  const hpDamage = Math.min(a.hp, Math.max(0, remaining));
  a.hp -= hpDamage;
  return { hpDamage, absorbed };
}
function conditionMet(s: SkillConfig, p: Combatant, e: Combatant, round: number): boolean {
  switch (s.condition.type) {
    case 'all':
      return s.condition.conditions.every((c) => conditionMet({ ...s, condition: c }, p, e, round));
    case 'shieldAllowed':
      return round >= p.shieldLockExpires;
    case 'always':
      return true;
    case 'hpBelow':
      return p.hp / p.maxHp <= s.condition.value;
    case 'intentAtLeast':
      return p.intent >= s.condition.value;
    case 'armorBreakAtMost':
      return e.breaks.stacks <= s.condition.value;
    case 'dotComboAtLeast':
      return (
        e.dots.length >= s.condition.value &&
        e.dots.some((d) => d.kind === 'poison') &&
        e.dots.some((d) => d.kind === 'burn')
      );
    case 'shieldBelow':
      return shieldValue(p) < p.maxHp * s.condition.value;
    case 'shieldAtLeast':
      return shieldValue(p) >= p.maxHp * s.condition.value;
  }
}
export function chooseSkill(
  skills: SkillConfig[],
  p: Combatant,
  e: Combatant,
  round: number,
): SkillConfig | undefined {
  return skills
    .map((s, slot) => ({ s, slot }))
    .sort((a, b) => a.s.priority - b.s.priority || a.slot - b.slot)
    .find(
      ({ s }) =>
        p.mana >= s.cost && round >= (p.cooldowns[s.id] ?? 0) && conditionMet(s, p, e, round),
    )?.s;
}

/** 先取两侧快照，再扣血，最后衰减；防止结算顺序消除同归于尽。 */
export function settleDots(
  actors: Combatant[],
): { damage: number; hpDamage: number; absorbed: number }[] {
  const values = actors.map((a) =>
    a.dots.reduce(
      (n, d) =>
        n +
        Math.max(
          1,
          Math.floor(
            d.power *
              mitigation(a.defense * (1 - RULES.breakPerStack * a.breaks.stacks)) *
              (1 - Math.min(RULES.reductionCap, a.reduction)),
          ),
        ),
      0,
    ),
  );
  const losses = actors.map((a, i) => ({ damage: values[i], ...absorbDamage(a, values[i]) }));
  for (const a of actors) {
    a.dots = a.dots.map((d) => ({ ...d, ticks: d.ticks - 1 })).filter((d) => d.ticks > 0);
    if (a.breaks.ticks > 0 && --a.breaks.ticks === 0) a.breaks.stacks = 0;
  }
  return losses;
}

export function simulate(build: BuildId, enemyId: string, options: SimOptions = {}): SimResult {
  const cfg = options.enemy ?? ENEMIES.find((e) => e.id === enemyId);
  if (!cfg) throw new Error('未知敌人');
  let random = (options.seed ?? 1) >>> 0;
  const initialSeed = random;
  // Mulberry32：避免连续小种子在简单LCG的首抽中形成偏斜。
  const rand = () => {
    random = (random + 0x6d2b79f5) >>> 0;
    let t = random;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const passiveIds = options.noPassives
    ? []
    : (options.passiveIds ?? PASSIVES.filter((s) => s.build === build).map((s) => s.id));
  if (!options.noPassives && (passiveIds.length !== 4 || new Set(passiveIds).size !== 4))
    throw new Error('被动功法必须4种且不重复');
  if (passiveIds.some((id) => !PASSIVES.some((s) => s.id === id))) throw new Error('未知被动功法');
  const has = (id: string) => passiveIds.includes(id);
  const value = (id: string) => (has(id) ? (PASSIVES.find((s) => s.id === id)?.value ?? 0) : 0);
  const p = makeCombatant(
    Math.round(BASE.hp * (options.hpScale ?? 1)),
    Math.round(BASE.attack * (options.attackScale ?? 1)),
    BASE.defense,
    BASE.crit + value('sword_crit'),
  );
  const e = makeCombatant(cfg.hp, cfg.attack, cfg.defense, cfg.crit, 80);
  p.reduction = value('ward_reduction');
  const selected = options.skillIds
    ? options.skillIds.map((id) => {
        const s = SKILLS.find((s) => s.id === id);
        if (!s) throw new Error('未知功法');
        return s;
      })
    : SKILLS.filter((s) => s.build === build);
  if (selected.length !== 4 || new Set(selected.map((s) => s.id)).size !== 4)
    throw new Error('主动功法必须4种且不重复');
  const skills = structuredClone(selected);
  if (options.badStrategy) {
    const burst = skills.find((s) => s.id === 'sword_finish' || s.id === 'toxin_burst');
    if (burst)
      burst.condition =
        build === 'sword'
          ? { type: 'intentAtLeast', value: 1 }
          : { type: 'dotComboAtLeast', value: 2 };
    if (build === 'ward') {
      const heal = skills.find((s) => s.id === 'ward_heal');
      if (heal) heal.condition = { type: 'hpBelow', value: 1 };
    }
  }
  let serial = 0,
    round = 0,
    counterRound = 0,
    manaCritTriggered = false;
  const result: SimResult = {
    build,
    enemy: cfg.id,
    outcome: 'timeout',
    rounds: 0,
    playerHp: p.hp,
    enemyHp: e.hp,
    damage: 0,
    dotDamage: 0,
    counterDamage: 0,
    healing: 0,
    shieldAbsorbed: 0,
    manaFallbacks: 0,
    seed: initialSeed,
    trace: [],
  };
  const record = (actor: string, action: string) => {
    if (options.trace)
      result.trace.push({
        round,
        actor,
        action,
        hp: p.hp,
        enemyHp: e.hp,
        mana: p.mana,
        shield: shieldValue(p),
        intent: p.intent,
        dots: `毒${e.dots.filter((d) => d.kind === 'poison').length}/火${e.dots.filter((d) => d.kind === 'burn').length}`,
      });
  };
  const defense = (a: Combatant) => a.defense * (1 - RULES.breakPerStack * a.breaks.stacks);
  const reduction = (a: Combatant) => Math.min(RULES.reductionCap, a.reduction);
  const heal = (value: number) => {
    const gain = Math.min(Math.floor(value), p.maxHp - p.hp);
    p.hp += gain;
    result.healing += gain;
    return gain;
  };
  const critRegen = (crit: boolean) => {
    if (crit && !manaCritTriggered) {
      p.mana = Math.min(p.maxMana, p.mana + value('sword_mana'));
      manaCritTriggered = true;
    }
  };
  const hurtEnemy = (
    raw: number,
    type: 'direct' | 'dot' | 'counter' | 'explosion',
    crit = false,
  ) => {
    let boost = 1;
    if (type === 'direct' && e.breaks.stacks > 0) boost += value('sword_edge');
    if (
      type === 'direct' &&
      e.dots.some((d) => d.kind === 'poison') &&
      e.dots.some((d) => d.kind === 'burn')
    )
      boost += value('toxin_edge');
    const amount = Math.max(
      1,
      Math.floor(
        raw *
          boost *
          mitigation(defense(e)) *
          (1 - reduction(e)) *
          (crit ? RULES.critMultiplier : 1),
      ),
    );
    const loss = absorbDamage(e, amount);
    result.damage += loss.hpDamage + loss.absorbed;
    if (type === 'dot') result.dotDamage += loss.hpDamage + loss.absorbed;
    if (type === 'counter') result.counterDamage += loss.hpDamage + loss.absorbed;
    return amount;
  };
  const effect = (x: Effect): number => {
    if (x.type === 'damage') {
      const intent = x.intentRatio ? p.intent : 0;
      const shield = x.shieldRatio ? shieldValue(p) : 0;
      const raw =
        p.attack * (x.attackRatio + (x.intentRatio ?? 0) * intent) + (x.shieldRatio ?? 0) * shield;
      if (x.intentRatio) p.intent = 0;
      if (x.shieldRatio) {
        let spend = Math.floor(shield * 0.25);
        for (const s of p.shields) {
          const v = Math.min(spend, s.value);
          s.value -= v;
          spend -= v;
        }
        p.shields = p.shields.filter((s) => s.value > 0);
      }
      const crit = rand() < Math.min(RULES.critCap, p.crit);
      const amount = hurtEnemy(raw, 'direct', crit);
      critRegen(crit);
      return amount;
    }
    if (x.type === 'intent') p.intent = Math.min(RULES.maxIntent, p.intent + x.stacks);
    if (x.type === 'break')
      e.breaks = { stacks: Math.min(RULES.maxBreak, e.breaks.stacks + x.stacks), ticks: x.ticks };
    if (x.type === 'dot') {
      const bonus =
        x.kind === 'burn' && e.dots.some((d) => d.kind === 'poison') ? value('toxin_firelink') : 0;
      applyDot(
        e,
        x.kind,
        p.attack * x.attackRatio * (x.kind === 'poison' ? 1 + value('toxin_power') : 1),
        x.ticks,
        x.stacks + bonus,
        () => ++serial,
      );
    }
    if (x.type === 'detonate') {
      const raw = e.dots.reduce((n, d) => n + d.power * d.ticks, 0) * x.remainingRatio;
      e.dots = [];
      if (e.hp > 0) return hurtEnemy(raw, 'explosion');
    }
    if (x.type === 'shield')
      grantShield(
        p,
        healFormula(p.attack, p.maxHp, x.attackRatio, x.hpRatio) * (1 + value('ward_shield')),
        round,
        x.rounds,
        ++serial,
      );
    if (x.type === 'heal')
      heal(
        healFormula(p.attack, p.maxHp, x.attackRatio, x.hpRatio) +
          Math.floor(p.maxHp * Math.min(0.09, (x.perDotHpRatio ?? 0) * e.dots.length)),
      );
    if (x.type === 'reduction') {
      p.reduction = value('ward_reduction') + x.value;
      p.reductionExpires = round + x.rounds;
    }
    return 0;
  };
  const ownAction = () => {
    manaCritTriggered = false;
    const s = chooseSkill(skills, p, e, round);
    let damage = 0;
    if (s) {
      p.mana -= s.cost;
      p.cooldowns[s.id] = round + s.cooldown + 1;
      for (const x of s.effects) {
        if (e.hp <= 0) break;
        damage += effect(x);
      }
    } else {
      const crit = rand() < Math.min(RULES.critCap, p.crit);
      damage = hurtEnemy(p.attack, 'direct', crit);
      critRegen(crit);
      result.manaFallbacks++;
    }
    p.intent = Math.min(RULES.maxIntent, p.intent + value('sword_intent'));
    if (shieldValue(p) > 0) heal(p.maxHp * value('ward_regen'));
    record('玩家', `${s?.name ?? '普通攻击'}${damage ? ` 造成${damage}` : ''}`);
  };
  const enemyAction = () => {
    if (cfg.cleanseEvery && round % cfg.cleanseEvery === 0) {
      e.dots = [];
      record(cfg.name, '净灵：清除全部毒与灼烧');
    }
    if (cfg.breakShieldEvery && round % cfg.breakShieldEvery === 0) {
      p.shields = [];
      if (cfg.tier === 'boss') p.shieldLockExpires = round + 2;
      record(
        cfg.name,
        cfg.tier === 'boss' ? '裂盾：清除护盾并禁盾至本轮及下轮结束' : '裂盾：清除护盾',
      );
    }
    const ratio = cfg.burstEvery && round % cfg.burstEvery === 0 ? (cfg.burstRatio ?? 1) : 1;
    let total = 0;
    for (let i = 0; i < (cfg.hits ?? 1) && p.hp > 0 && e.hp > 0; i++) {
      const hadShield = shieldValue(p) > 0;
      const damage = directFormula(
        e.attack,
        ratio / (cfg.hits ?? 1),
        defense(p),
        reduction(p),
        rand() < Math.min(RULES.critCap, e.crit),
      );
      const loss = absorbDamage(p, damage);
      result.shieldAbsorbed += loss.absorbed;
      total += damage;
      // 反击在本次伤害及死亡检查之后结算，禁止反击递归。
      if (hadShield && p.hp > 0 && has('ward_counter') && counterRound !== round) {
        counterRound = round;
        hurtEnemy(p.attack * value('ward_counter'), 'counter');
        record('玩家', '回澜反击');
      }
    }
    record(cfg.name, `${ratio > 1 ? '蓄力重击' : '攻击'} 造成${total}`);
  };
  const maxRounds = cfg.tier === 'boss' ? RULES.maxBossRounds : RULES.maxNormalRounds;
  for (round = 1; round <= maxRounds; round++) {
    for (const a of [p, e]) {
      a.shields = a.shields.filter((s) => s.expiresAt > round);
      if (a.reductionExpires && a.reductionExpires <= round) {
        a.reduction = a === p ? value('ward_reduction') : 0;
        a.reductionExpires = 0;
      }
      a.mana = Math.min(a.maxMana, a.mana + RULES.manaRegen);
    }
    const turns = round % 2 === 1 ? [ownAction, enemyAction] : [enemyAction, ownAction];
    for (const action of turns) {
      action();
      if (p.hp <= 0 || e.hp <= 0) break;
    }
    if (p.hp <= 0 || e.hp <= 0) {
      result.outcome = p.hp <= 0 ? 'lose' : 'win';
      break;
    }
    if (e.dots.length) p.mana = Math.min(p.maxMana, p.mana + value('toxin_mana'));
    const [pTick, eTick] = settleDots([p, e]);
    result.shieldAbsorbed += pTick.absorbed;
    result.damage += eTick.hpDamage + eTick.absorbed;
    result.dotDamage += eTick.hpDamage + eTick.absorbed;
    if (pTick.damage || eTick.damage)
      record('轮末', `持续伤害 玩家-${pTick.damage} 敌方-${eTick.damage}`);
    if (p.hp <= 0 || e.hp <= 0) {
      result.outcome = p.hp <= 0 && e.hp <= 0 ? 'draw' : p.hp <= 0 ? 'lose' : 'win';
      break;
    }
  }
  result.rounds = Math.min(round, maxRounds);
  result.playerHp = p.hp;
  result.enemyHp = e.hp;
  return result;
}
