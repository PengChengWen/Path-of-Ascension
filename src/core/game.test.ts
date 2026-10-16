import { describe, it, expect } from 'vitest';
import { GAME } from '../content/game';
import {
  advanceGame,
  createGame,
  cultivationRate,
  gameSchema,
  requiredExp,
  runCommand,
} from './game';

const now = 1_800_000_000_000;
describe('修炼与存档规则', () => {
  it('初始存档有效，起始炼气六层', () => {
    const s = gameSchema.parse(createGame(now));
    expect(s.level).toBe(6);
    expect(cultivationRate(s)).toBe(72);
  });
  it('连续推进与分段推进一致，保留修为余数', () => {
    let split = createGame(now);
    for (let i = 1; i <= 60; i++) split = advanceGame(split, now + i * 1000);
    expect(split).toEqual(advanceGame(createGame(now), now + 60_000));
  });
  it('奇遇奖励不能重复领取，原状态不被突变', () => {
    const old = createGame(now);
    const next = runCommand(old, { type: 'legacy' }, now);
    expect(old.flags.legacy).toBe(false);
    expect(next.exp).toBe(2000);
    expect(() => runCommand(next, { type: 'legacy' }, now)).toThrow();
  });
  it('突破扣除一次材料和修为，不能连点重复突破', () => {
    const s = runCommand(createGame(now), { type: 'legacy' }, now);
    const next = runCommand(s, { type: 'breakthrough' }, now);
    expect(next.level).toBe(7);
    expect(next.spirit).toBe(s.spirit - 100);
    expect(next.exp).toBe(80);
    expect(() => runCommand(next, { type: 'breakthrough' }, now)).toThrow();
  });
  it('修为达到储存上限后停止，但历练继续', () => {
    const s = runCommand(createGame(now), { type: 'outing', id: 'herb' }, now);
    const next = advanceGame(s, now + GAME.offlineMs);
    expect(next.exp).toBe(Math.floor(requiredExp(s) * 1.5));
    expect(next.inventory.herb).toBe(s.inventory.herb + 144 * 3);
  });
  it('离线最多12小时，丢弃超限时段，不在下一次重复补发', () => {
    const s = runCommand(createGame(now), { type: 'outing', id: 'herb' }, now);
    const a = advanceGame(s, now + 24 * 60 * 60 * 1000);
    expect(a.inventory.herb).toBe(12 + 144 * 3);
    const b = advanceGame(a, a.lastSettledAt + 1000);
    expect(b.inventory.herb).toBe(a.inventory.herb);
    expect(a.outing!.nextAt).toBeGreaterThan(a.lastSettledAt);
  });
  it('丹炉完成后只发放一次产出', () => {
    const s = runCommand(createGame(now), { type: 'craft', id: 'spirit' }, now);
    const a = advanceGame(s, now + 60_000);
    const b = advanceGame(a, now + 120_000);
    expect(a.inventory.pill).toBe(3);
    expect(b.inventory.pill).toBe(3);
    expect(a.craft).toBeNull();
  });
  it('丹药到期按时间边界分段结算', () => {
    const s = createGame(now);
    s.exp = 0;
    s.level = 9;
    s.boostUntil = now + 30_000;
    const a = advanceGame(s, now + 60_000);
    let b = advanceGame(s, now + 30_000);
    b = advanceGame(b, now + 60_000);
    expect(a).toEqual(b);
  });
  it('材料不足时炼丹不扣灵石或部分材料', () => {
    const s = createGame(now);
    s.inventory.dew = 0;
    expect(() => runCommand(s, { type: 'craft', id: 'foundation' }, now)).toThrow();
    expect(s.spirit).toBe(8436);
    expect(s.inventory.herb).toBe(12);
  });
  it('闭关暂停历练，提高吐纳效率', () => {
    let s = runCommand(createGame(now), { type: 'outing', id: 'herb' }, now);
    s = runCommand(s, { type: 'toggleCultivation' }, now);
    expect(s.outing).toBeNull();
    expect(cultivationRate(s)).toBe(94);
  });
  it('系统时间倒退不扣收益，也不允许插入过去的操作', () => {
    const s = createGame(now);
    expect(advanceGame(s, now - 1000)).toEqual(s);
    expect(() => runCommand(s, { type: 'ponder' }, now - 1000)).toThrow();
  });
  it('导入时拒绝会造成无限追溯的活动时间', () => {
    const s = createGame(now);
    s.outing = { locationId: 'herb', nextAt: 0 };
    expect(gameSchema.safeParse(s).success).toBe(false);
  });
  it('筑基条件全部满足后一次突破，成长不会倒退', () => {
    const s = createGame(now);
    s.level = 9;
    s.exp = 12000;
    s.inventory.foundationPill = 1;
    s.inventory.seal = 1;
    const oldRate = cultivationRate(s);
    const next = runCommand(s, { type: 'breakthrough' }, now);
    expect(next.foundation).toBe(true);
    expect(next.inventory.foundationPill).toBe(0);
    expect(cultivationRate(next)).toBeGreaterThan(oldRate);
  });
  it('进入战斗后奖励只结算一次，不能连续重复挑战', () => {
    const s = createGame(now);
    const a = runCommand(s, { type: 'fight' }, now);
    expect(a.battle?.frames.length).toBeGreaterThan(0);
    expect(() => runCommand(a, { type: 'fight' }, now)).toThrow();
    expect(s.battleCounter).toBe(0);
  });
  it('无法以未解锁的地点绕过境界条件', () =>
    expect(() => runCommand(createGame(now), { type: 'outing', id: 'ridge' }, now)).toThrow());
});
