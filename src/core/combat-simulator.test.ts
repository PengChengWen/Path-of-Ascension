import { describe, it, expect } from 'vitest';
import {
  SKILLS,
  ENEMIES,
  RULES,
  validateCombatContent,
  type BuildId,
} from '../content/combat-design';
import {
  absorbDamage,
  applyDot,
  chooseSkill,
  directFormula,
  grantShield,
  healFormula,
  makeCombatant,
  settleDots,
  shieldValue,
  simulate,
} from './combat-simulator';

describe('战斗合同与数值不变量', () => {
  it('配置满足每流派4主动4被动且ID唯一', () => expect(() => validateCombatContent()).not.toThrow());
  it('防御和暴击按规定顺序计算', () => expect(directFormula(120, 1.5, 100, 0.1, true)).toBe(162));
  it('减伤上限50%，正伤害最低1', () => {
    expect(directFormula(100, 1, 0, 0.9)).toBe(50);
    expect(directFormula(1, 1, 10000)).toBe(1);
  });
  it('治疗先合并攻击和生命系数再取整', () => expect(healFormula(120, 1800, 0.8, 0.1)).toBe(276));
  it('护盾不超过最大生命50%', () => {
    const a = makeCombatant(100, 10, 0, 0);
    grantShield(a, 80, 1, 2, 1);
    expect(shieldValue(a)).toBe(50);
  });
  it('护盾按最早到期顺序吸收，剩余伤害扣生命', () => {
    const a = makeCombatant(1000, 10, 0, 0);
    grantShield(a, 100, 1, 2, 1);
    grantShield(a, 100, 2, 3, 2);
    expect(absorbDamage(a, 150)).toEqual({ hpDamage: 0, absorbed: 150 });
    expect(a.shields).toHaveLength(1);
    expect(a.shields[0].serial).toBe(2);
    expect(absorbDamage(a, 100)).toEqual({ hpDamage: 50, absorbed: 50 });
  });
  it('负伤害不能增加护盾或生命', () => {
    const a = makeCombatant(100, 10, 0, 0);
    grantShield(a, 20, 1, 2, 1);
    absorbDamage(a, -30);
    expect(a.hp).toBe(100);
    expect(shieldValue(a)).toBe(20);
  });
  it('禁盾期间不能生成新护盾，到期可恢复', () => {
    const a = makeCombatant(100, 10, 0, 0);
    a.shieldLockExpires = 6;
    grantShield(a, 20, 5, 2, 1);
    expect(shieldValue(a)).toBe(0);
    grantShield(a, 20, 6, 2, 2);
    expect(shieldValue(a)).toBe(20);
  });
  it('毒层数上限5，替换最先到期的独立层', () => {
    const a = makeCombatant(100, 10, 0, 0);
    let n = 0;
    applyDot(a, 'poison', 10, 3, 5, () => ++n);
    a.dots[2].ticks = 1;
    applyDot(a, 'poison', 20, 3, 1, () => ++n);
    expect(a.dots).toHaveLength(5);
    expect(a.dots.some((d) => d.serial === 3)).toBe(false);
  });
  it('持续3次轮末的状态恰好触发3次，不额外触发', () => {
    const a = makeCombatant(100, 10, 0, 0);
    applyDot(a, 'burn', 10, 3, 1, () => 1);
    for (let i = 0; i < 4; i++) settleDots([a]);
    expect(a.hp).toBe(70);
    expect(a.dots).toHaveLength(0);
  });
  it('两侧轮末持续伤害可同归于尽', () => {
    const a = makeCombatant(1, 10, 0, 0),
      b = makeCombatant(1, 10, 0, 0);
    applyDot(a, 'poison', 10, 1, 1, () => 1);
    applyDot(b, 'burn', 10, 1, 1, () => 2);
    settleDots([a, b]);
    expect([a.hp, b.hp]).toEqual([0, 0]);
  });
  it('破甲在持续伤害之后衰减', () => {
    const a = makeCombatant(100, 10, 200, 0);
    a.breaks = { stacks: 3, ticks: 1 };
    applyDot(a, 'burn', 100, 1, 1, () => 1);
    const [t] = settleDots([a]);
    expect(t.damage).toBe(64);
    expect(a.breaks.stacks).toBe(0);
  });
  it('生命阈值包含等号，抢救优先于输出', () => {
    const p = makeCombatant(100, 10, 0, 0),
      e = makeCombatant(100, 10, 0, 0);
    p.hp = 45;
    const s = chooseSkill(
      SKILLS.filter((s) => s.build === 'sword'),
      p,
      e,
      1,
    );
    expect(s?.id).toBe('sword_heal');
  });
  it('CD3在第1轮使用后，第2至4轮不可用，第5轮恢复', () => {
    const p = makeCombatant(100, 10, 0, 0),
      e = makeCombatant(100, 10, 0, 0);
    const s = SKILLS.find((s) => s.id === 'sword_break')!;
    p.cooldowns[s.id] = 1 + s.cooldown + 1;
    expect(chooseSkill([s], p, e, 4)).toBeUndefined();
    expect(chooseSkill([s], p, e, 5)?.id).toBe(s.id);
  });
  it('灵力不足会跳过高优先级技能，无技能可用时普通攻击', () => {
    const p = makeCombatant(100, 10, 0, 0),
      e = makeCombatant(100, 10, 0, 0);
    p.mana = 0;
    expect(chooseSkill(SKILLS, p, e, 1)).toBeUndefined();
  });
  it('禁盾条件使玄水镜跳过，不浪费主动行动', () => {
    const p = makeCombatant(100, 10, 0, 0),
      e = makeCombatant(100, 10, 0, 0);
    p.shieldLockExpires = 6;
    const s = SKILLS.find((s) => s.id === 'ward_guard')!;
    expect(chooseSkill([s], p, e, 5)).toBeUndefined();
  });
  it('固定种子结果完全可复现，记录开关不改变计算', () => {
    const a = simulate('toxin', 'tiger', { seed: 42 }),
      b = simulate('toxin', 'tiger', { seed: 42, trace: true });
    expect({ ...b, trace: [] }).toEqual(a);
  });
  it('只支持4个不重复的主动与被动槽', () => {
    expect(() => simulate('sword', 'wolf', { skillIds: ['sword_focus'] })).toThrow();
    expect(() => simulate('sword', 'wolf', { passiveIds: ['ward_regen'] })).toThrow();
  });
  it('每轮反击至多一次，多段攻击不会触发连锁', () => {
    const r = simulate('ward', 'bat', { seed: 42, trace: true });
    const turns = r.trace.filter((t) => t.action === '回澜反击').map((t) => t.round);
    expect(new Set(turns).size).toBe(turns.length);
  });
  it('所有敌人与流派不会出现负生命或超出回合上限', () => {
    for (const b of ['sword', 'toxin', 'ward'] as BuildId[])
      for (const e of ENEMIES)
        for (let seed = 1; seed <= 20; seed++) {
          const r = simulate(b, e.id, { seed, trace: true });
          expect(r.playerHp).toBeGreaterThanOrEqual(0);
          expect(r.enemyHp).toBeGreaterThanOrEqual(0);
          expect(r.rounds).toBeLessThanOrEqual(
            e.tier === 'boss' ? RULES.maxBossRounds : RULES.maxNormalRounds,
          );
          expect(r.trace.every((t) => t.mana >= 0 && t.mana <= 100)).toBe(true);
        }
  });
});
