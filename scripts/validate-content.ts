import { validateCombatContent, SKILLS, PASSIVES, ENEMIES } from '../src/content/combat-design';
import { createGame, gameSchema } from '../src/core/game';
import { ITEMS, LOCATIONS, RECIPES } from '../src/content/game';
validateCombatContent();
gameSchema.parse(createGame(Date.now()));
for (const l of LOCATIONS) if (!ITEMS[l.item] || l.amount <= 0) throw new Error('历练产出错误');
for (const r of RECIPES) {
  if (!ITEMS[r.output]) throw new Error('丹方产物错误');
  for (const [id, n] of Object.entries(r.cost))
    if (!(id in ITEMS) || n <= 0) throw new Error('丹方材料错误');
}
console.log(
  `战斗设计配置通过：${SKILLS.length}主动 / ${PASSIVES.length}被动 / ${ENEMIES.length}敌人。`,
);
console.log('初始存档、历练地点与丹方引用通过。');
