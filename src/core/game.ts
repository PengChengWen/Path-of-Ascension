import { z } from 'zod';
import {
  GAME,
  ITEMS,
  LOCATIONS,
  REALM_COSTS,
  RECIPES,
  CN_NUMBERS,
  type ItemId,
} from '../content/game';
import { BASE, ENEMIES, type BuildId } from '../content/combat-design';
import { simulate } from './combat-simulator';

const count = z.number().int().min(0).max(1e12);
const timestamp = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const frame = z.object({
  round: count,
  actor: z.string(),
  action: z.string(),
  hp: count,
  enemyHp: count,
  mana: count,
  shield: count,
  intent: count,
  dots: z.string(),
});
export const gameSchema = z
  .object({
    id: z.literal('main'),
    version: z.literal(1),
    revision: count,
    lastSettledAt: timestamp,
    name: z.string().min(1).max(20),
    level: z.number().int().min(1).max(9),
    foundation: z.boolean(),
    exp: count,
    carry: z.number().min(0).lt(60_000),
    spirit: count,
    insight: count,
    homeLevel: z.number().int().min(1).max(3),
    abilityLevel: z.number().int().min(1).max(10),
    mode: z.enum(['normal', 'secluded']),
    build: z.enum(['sword', 'toxin', 'ward']),
    boostUntil: timestamp,
    inventory: z.object({
      herb: count,
      dew: count,
      core: count,
      pill: count,
      foundationPill: count,
      seal: count,
    }),
    outing: z
      .object({ locationId: z.enum(['herb', 'mist', 'ridge']), nextAt: timestamp })
      .nullable(),
    craft: z.object({ recipeId: z.enum(['spirit', 'foundation']), finishAt: timestamp }).nullable(),
    companion: z.object({
      met: z.boolean(),
      bond: z.number().int().min(0).max(100),
      travel: z.boolean(),
    }),
    flags: z.object({ legacy: z.boolean(), tiger: z.boolean(), friendQuest: z.boolean() }),
    battleCounter: count,
    battleReadyAt: timestamp,
    battle: z
      .object({
        id: count,
        enemyId: z.string(),
        won: z.boolean(),
        rounds: count,
        playerMax: count,
        enemyMax: count,
        frames: z.array(frame).max(200),
      })
      .nullable(),
    logSeq: count,
    logs: z
      .array(
        z.object({
          id: count,
          time: timestamp,
          text: z.string().max(300),
          kind: z.enum(['normal', 'good', 'story']),
        }),
      )
      .max(40),
  })
  .superRefine((s, ctx) => {
    if (s.outing && s.outing.nextAt <= s.lastSettledAt)
      ctx.addIssue({ code: 'custom', message: '历练时间与存档时间不一致' });
    if (s.craft && s.craft.finishAt <= s.lastSettledAt)
      ctx.addIssue({ code: 'custom', message: '炼丹时间与存档时间不一致' });
  });
export type GameState = z.infer<typeof gameSchema>;
export type Command =
  | { type: 'tick' }
  | { type: 'toggleCultivation' }
  | { type: 'breakthrough' }
  | { type: 'ponder' }
  | { type: 'outing'; id: string }
  | { type: 'stopOuting' }
  | { type: 'craft'; id: string }
  | { type: 'usePill' }
  | { type: 'upgradeHome' }
  | { type: 'upgradeAbility' }
  | { type: 'build'; id: BuildId }
  | { type: 'fight' }
  | { type: 'legacy' }
  | { type: 'meet' }
  | { type: 'friendQuest' }
  | { type: 'travel' };
export const realmName = (s: GameState) =>
  s.foundation ? '筑基初期' : `炼气${CN_NUMBERS[s.level - 1]}层`;
export const requiredExp = (s: GameState) => (s.foundation ? 24000 : REALM_COSTS[s.level - 1]);
export function cultivationRate(s: GameState, time = s.lastSettledAt): number {
  const base =
    (60 + s.abilityLevel * 4) *
    Math.pow(1.25, (s.foundation ? 10 : s.level) - 6) *
    (1 + 0.12 * (s.homeLevel - 1));
  return Math.round(
    base * (s.mode === 'secluded' ? 1.3 : s.outing ? 0.7 : 1) * (s.boostUntil > time ? 1.5 : 1),
  );
}
export function createGame(now: number): GameState {
  return {
    id: 'main',
    version: 1,
    revision: 0,
    lastSettledAt: now,
    name: '无尘',
    level: 6,
    foundation: false,
    exp: 1280,
    carry: 0,
    spirit: 8436,
    insight: 128,
    homeLevel: 1,
    abilityLevel: 3,
    mode: 'normal',
    build: 'sword',
    boostUntil: 0,
    inventory: { herb: 12, dew: 2, core: 1, pill: 2, foundationPill: 0, seal: 0 },
    outing: null,
    craft: null,
    companion: { met: false, bond: 0, travel: false },
    flags: { legacy: false, tiger: false, friendQuest: false },
    battleCounter: 0,
    battleReadyAt: 0,
    battle: null,
    logSeq: 3,
    logs: [
      { id: 3, time: now, text: '照尘炉微微发热，一缕残念似在等你回应。', kind: 'story' },
      { id: 2, time: now - 90_000, text: '抵达青岚山，在无名洞府暂且落脚。', kind: 'normal' },
      { id: 1, time: now - 300_000, text: '引气入体，踏上问道之途。', kind: 'good' },
    ],
  };
}
function log(
  s: GameState,
  text: string,
  kind: 'normal' | 'good' | 'story' = 'normal',
  time = s.lastSettledAt,
): void {
  s.logs.unshift({ id: ++s.logSeq, time, text, kind });
  s.logs = s.logs.slice(0, 40);
}
export function advanceGame(original: GameState, now: number): GameState {
  const s = structuredClone(original);
  if (now < s.lastSettledAt) return s;
  const end = s.lastSettledAt + Math.min(now - s.lastSettledAt, GAME.offlineMs);
  let t = s.lastSettledAt;
  while (t < end) {
    const next = Math.min(
      end,
      s.outing?.nextAt ?? Infinity,
      s.craft?.finishAt ?? Infinity,
      s.boostUntil > t ? s.boostUntil : Infinity,
    );
    const boundary = Math.max(t, next);
    const rate = cultivationRate(s, t);
    const numerator = (boundary - t) * rate + s.carry;
    s.exp = Math.min(Math.floor(requiredExp(s) * 1.5), s.exp + Math.floor(numerator / 60_000));
    s.carry = s.exp >= Math.floor(requiredExp(s) * 1.5) ? 0 : numerator % 60_000;
    t = boundary;
    if (s.outing && s.outing.nextAt <= t) {
      const location = LOCATIONS.find((l) => l.id === s.outing!.locationId)!;
      s.inventory[location.item] += location.amount;
      s.spirit += location.coins;
      log(
        s,
        `${location.name}历练完成，获得${ITEMS[location.item].name} ×${location.amount}、灵石 ${location.coins}。`,
        'good',
        t,
      );
      s.outing.nextAt += GAME.outingMs;
    }
    if (s.craft && s.craft.finishAt <= t) {
      const recipe = RECIPES.find((r) => r.id === s.craft!.recipeId)!;
      s.inventory[recipe.output]++;
      log(s, `丹香渐起，${recipe.name}炼制完成。`, 'good', t);
      s.craft = null;
    }
    if (s.boostUntil && s.boostUntil <= t) s.boostUntil = 0;
  }
  // 超出离线上限的空白时段不产生收益，也不让活动在下次结算中重复补发。
  const skipped = now - end;
  if (s.outing) s.outing.nextAt += skipped;
  if (s.craft) s.craft.finishAt += skipped;
  if (s.boostUntil > end) s.boostUntil += skipped;
  s.lastSettledAt = now;
  return s;
}
export function runCommand(original: GameState, command: Command, now: number): GameState {
  if (now < original.lastSettledAt && command.type !== 'tick')
    throw new Error('系统时间早于上次修行，请校准时间后继续。');
  const s = advanceGame(original, now);
  const fail = (message: string): never => {
    throw new Error(message);
  };
  const spend = (amount: number) => {
    if (s.spirit < amount) fail('灵石不足，先去历练积攒一些。');
    s.spirit -= amount;
  };
  switch (command.type) {
    case 'tick':
      break;
    case 'toggleCultivation':
      s.mode = s.mode === 'normal' ? 'secluded' : 'normal';
      if (s.mode === 'secluded') s.outing = null;
      log(
        s,
        s.mode === 'secluded'
          ? '静心闭关，吐纳效率提升30%，历练已暂停。'
          : '结束闭关，重新感受山间灵机。',
      );
      break;
    case 'ponder':
      if (s.insight < 5) fail('悟性不足。');
      if (s.exp >= requiredExp(s)) fail('修为已满，可以尝试突破。');
      s.insight -= 5;
      s.exp = Math.min(requiredExp(s), s.exp + Math.ceil(requiredExp(s) * 0.25));
      log(s, '参悟古卷，修为有所精进。', 'good');
      break;
    case 'breakthrough': {
      if (s.foundation) fail('后续境界将在下一版开放。');
      const cost = requiredExp(s);
      if (s.exp < cost) fail('修为尚未圆满。');
      if (s.level === 9) {
        if (!s.inventory.foundationPill || !s.inventory.seal) fail('还需要筑基丹与青岚地脉印。');
        spend(300);
        s.inventory.foundationPill--;
        s.inventory.seal--;
        s.foundation = true;
        s.level = 1;
      } else {
        spend(100);
        s.level++;
      }
      s.exp -= cost;
      s.carry = 0;
      log(s, `气海澄明，成功突破至${realmName(s)}！`, 'story');
      break;
    }
    case 'outing': {
      const l = LOCATIONS.find((l) => l.id === command.id);
      if (!l) fail('未知地点。');
      if (!s.foundation && s.level < l!.level) fail(`此处需要炼气${CN_NUMBERS[l!.level - 1]}层。`);
      s.mode = 'normal';
      s.outing = { locationId: l!.id, nextAt: now + GAME.outingMs };
      log(s, `前往${l!.name}，每五分钟收获一次。`);
      break;
    }
    case 'stopOuting':
      s.outing = null;
      log(s, '已结束历练，返回洞府。');
      break;
    case 'craft': {
      if (s.craft) fail('丹炉正在炼制，请稍候。');
      const r = RECIPES.find((r) => r.id === command.id);
      if (!r) fail('未知丹方。');
      for (const [id, n] of Object.entries(r!.cost))
        if (s.inventory[id as ItemId] < (n ?? 0)) fail(`${ITEMS[id as ItemId].name}不足。`);
      spend(r!.coins);
      for (const [id, n] of Object.entries(r!.cost)) s.inventory[id as ItemId] -= n ?? 0;
      s.craft = { recipeId: r!.id, finishAt: now + r!.duration };
      log(s, `添薪起炉，开始炼制${r!.name}。`);
      break;
    }
    case 'usePill':
      if (!s.inventory.pill) fail('没有可服用的聚灵丹。');
      s.inventory.pill--;
      s.boostUntil = Math.max(now, s.boostUntil) + 600_000;
      log(s, '服下聚灵丹，十分钟内修炼效率提升50%。', 'good');
      break;
    case 'upgradeHome':
      if (s.homeLevel >= 3) fail('洞府灵脉已达到当前上限。');
      spend(300 * s.homeLevel);
      s.homeLevel++;
      log(s, `洞府灵脉提升至${s.homeLevel}级，灵气更加充盈。`, 'good');
      break;
    case 'upgradeAbility':
      if (s.abilityLevel >= 10) fail('功法已达到当前上限。');
      spend(120 * s.abilityLevel);
      s.abilityLevel++;
      log(s, `功法精研至${s.abilityLevel}重，修炼与战斗能力提升。`, 'good');
      break;
    case 'build':
      s.build = command.id;
      log(s, `已调整功法构筑。`);
      break;
    case 'legacy':
      if (s.flags.legacy) fail('这段残念已经参悟过了。');
      s.flags.legacy = true;
      s.exp = Math.min(Math.floor(requiredExp(s) * 1.5), s.exp + 720);
      s.insight += 5;
      log(s, '照尘炉传来古老丹音，获得修为720、悟性5。', 'story');
      break;
    case 'meet':
      if (s.companion.met) fail('已经结识沈青禾。');
      if (s.inventory.herb < 3) fail('需要青灵草三株，帮助她救治山中伤者。');
      s.inventory.herb -= 3;
      s.companion.met = true;
      s.companion.bond = 10;
      log(s, '与医修沈青禾相识，她愿与你同行一段山路。', 'story');
      break;
    case 'friendQuest':
      if (!s.companion.met) fail('尚未结识沈青禾。');
      if (s.flags.friendQuest) fail('药庐委托已经完成。');
      if (s.inventory.herb < 5) fail('需要青灵草五株。');
      s.inventory.herb -= 5;
      s.flags.friendQuest = true;
      s.companion.bond = 30;
      s.insight += 10;
      log(s, '送来救急的灵草，沈青禾与你渐生信任。获得悟性10。', 'story');
      break;
    case 'travel':
      if (s.companion.bond < 30) fail('先完成药庐委托，再邀请她同行。');
      s.companion.travel = !s.companion.travel;
      log(
        s,
        s.companion.travel
          ? '沈青禾加入同行，为战斗提供气血助益。'
          : '沈青禾留在药庐，等候你平安归来。',
      );
      break;
    case 'fight': {
      if (now < s.battleReadyAt) fail('正在调息，片刻后可再次挑战。');
      const combatLevel = s.foundation ? 10 : s.level;
      const hpScale =
        1 + 0.12 * (combatLevel - 6) + 0.03 * (s.homeLevel - 1) + (s.companion.travel ? 0.15 : 0);
      const attackScale = 1 + 0.1 * (combatLevel - 6) + 0.04 * (s.abilityLevel - 3);
      const r = simulate(s.build, 'tiger', {
        seed: ++s.battleCounter * 7919,
        trace: true,
        hpScale,
        attackScale,
      });
      const won = r.outcome === 'win';
      s.battle = {
        id: s.battleCounter,
        enemyId: 'tiger',
        won,
        rounds: r.rounds,
        playerMax: Math.round(BASE.hp * hpScale),
        enemyMax: ENEMIES.find((e) => e.id === 'tiger')!.hp,
        frames: r.trace,
      };
      s.battleReadyAt = now + (won ? 10_000 : 30_000);
      if (won) {
        s.spirit += 150;
        s.inventory.core += 2;
        if (!s.flags.tiger) {
          s.inventory.seal++;
          s.flags.tiger = true;
          log(s, '击败黑旗妖虎，首次获得青岚地脉印。', 'story');
        } else log(s, '再次击败黑旗妖虎，获得妖丹×2、灵石150。', 'good');
      } else log(s, '妖虎攻势凌厉，暂退洞府调息。试试精研功法或调整构筑。');
      break;
    }
  }
  return gameSchema.parse(s);
}
