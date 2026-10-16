import { writeFileSync, mkdirSync } from 'node:fs';
import {
  BASE,
  BUILD_NAMES,
  ENEMIES,
  validateCombatContent,
  type BuildId,
} from '../src/content/combat-design';
import { simulate } from '../src/core/combat-simulator';

validateCombatContent();
const builds = Object.keys(BUILD_NAMES) as BuildId[];
const samples = 1000;
const round = (n: number) => Math.round(n * 100) / 100;
const rows = ENEMIES.flatMap((enemy) =>
  builds.map((build) => {
    const all = Array.from({ length: samples }, (_, i) =>
      simulate(build, enemy.id, { seed: i + 1 }),
    );
    const wins = all.filter((r) => r.outcome === 'win');
    const sorted = wins.map((r) => r.rounds).sort((a, b) => a - b);
    const p = wins.length / samples,
      z = 1.96,
      den = 1 + (z * z) / samples;
    const center = (p + (z * z) / (2 * samples)) / den;
    const half = (z * Math.sqrt((p * (1 - p)) / samples + (z * z) / (4 * samples * samples))) / den;
    return {
      enemy: enemy.id,
      name: enemy.name,
      tier: enemy.tier,
      build,
      buildName: BUILD_NAMES[build],
      samples,
      wins: wins.length,
      winRate: round(p * 100),
      wilson95: [round((center - half) * 100), round((center + half) * 100)],
      meanRounds: round(all.reduce((n, r) => n + r.rounds, 0) / samples),
      winMeanRounds: wins.length
        ? round(wins.reduce((n, r) => n + r.rounds, 0) / wins.length)
        : null,
      winP90: sorted.length ? sorted[Math.ceil(sorted.length * 0.9) - 1] : null,
      winHpPercent: wins.length
        ? round(wins.reduce((n, r) => n + (r.playerHp / BASE.hp) * 100, 0) / wins.length)
        : null,
      timeout: all.filter((r) => r.outcome === 'timeout').length,
      dotDamageMean: round(all.reduce((n, r) => n + r.dotDamage, 0) / samples),
      counterDamageMean: round(all.reduce((n, r) => n + r.counterDamage, 0) / samples),
      manaFallbackMean: round(all.reduce((n, r) => n + r.manaFallbacks, 0) / samples),
    };
  }),
);
const ablations = builds.flatMap((build) =>
  ['noPassives', 'badStrategy'].map((mode) => {
    const all = Array.from({ length: samples }, (_, i) =>
      simulate(build, 'tiger', {
        seed: i + 1,
        ...(mode === 'noPassives' ? { noPassives: true } : { badStrategy: true }),
      }),
    );
    return {
      build,
      mode,
      winRate: round((all.filter((r) => r.outcome === 'win').length / samples) * 100),
      meanRounds: round(all.reduce((n, r) => n + r.rounds, 0) / samples),
    };
  }),
);
const sensitivity = builds.flatMap((build) =>
  [0.9, 1, 1.1].map((attackScale) => {
    const all = Array.from({ length: samples }, (_, i) =>
      simulate(build, 'tiger', { seed: i + 1, attackScale }),
    );
    return {
      build,
      attackScale,
      winRate: round((all.filter((r) => r.outcome === 'win').length / samples) * 100),
      meanRounds: round(all.reduce((n, r) => n + r.rounds, 0) / samples),
    };
  }),
);
const traces = builds.map((build) => simulate(build, 'tiger', { seed: 42, trace: true }));
const adaptive = [
  {
    name: '水土将玄水镜换为破岳斩',
    build: 'ward' as BuildId,
    enemy: 'breaker',
    options: { skillIds: ['sword_break', 'ward_bash', 'ward_strike', 'ward_heal'] },
  },
  {
    name: '毒火对净化首领提前引爆',
    build: 'toxin' as BuildId,
    enemy: 'bird',
    options: { badStrategy: true },
  },
].map((c) => {
  const all = Array.from({ length: samples }, (_, i) =>
    simulate(c.build, c.enemy, { seed: i + 1, ...c.options }),
  );
  return {
    name: c.name,
    build: c.build,
    enemy: c.enemy,
    winRate: round((all.filter((r) => r.outcome === 'win').length / samples) * 100),
    meanRounds: round(all.reduce((n, r) => n + r.rounds, 0) / samples),
  };
});
const result = {
  version: '1.0',
  samplesPerCell: samples,
  totalBattles:
    rows.length * samples +
    ablations.length * samples +
    sensitivity.length * samples +
    adaptive.length * samples,
  seedRange: [1, samples],
  baseStats: BASE,
  rows,
  ablations,
  sensitivity,
  adaptive,
  traces,
};
mkdirSync('docs/combat', { recursive: true });
writeFileSync('docs/combat/simulation-results.json', JSON.stringify(result, null, 2) + '\n');
const md = [
  '# 问道余烬战斗预设模拟报告',
  '',
  `固定配置，种子 1–${samples}，每个组合 ${samples} 场，共 ${result.totalBattles} 场。胜场回合均值与胜场剩余生命只统计胜场；全样本回合均值包含失败和超时。`,
  '',
  '| 敌人 | 流派 | 胜率 | 全样本回合 | 胜场回合 | 胜场P90 | 胜场余血 | 超时 |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ...rows.map(
    (r) =>
      `| ${r.name} | ${r.buildName} | ${r.winRate}% | ${r.meanRounds} | ${r.winMeanRounds ?? '无'} | ${r.winP90 ?? '无'} | ${r.winHpPercent ?? '无'}% | ${r.timeout} |`,
  ),
  '',
  '## 消融验证',
  '',
  '| 流派 | 配置 | 胜率 | 全样本回合 |',
  '| --- | --- | --- | --- |',
  ...ablations.map(
    (r) => `| ${BUILD_NAMES[r.build]} | ${r.mode} | ${r.winRate}% | ${r.meanRounds} |`,
  ),
  '',
  '## 攻击敏感性',
  '',
  '| 流派 | 攻击倍率 | 胜率 | 全样本回合 |',
  '| --- | --- | --- | --- |',
  ...sensitivity.map(
    (r) => `| ${BUILD_NAMES[r.build]} | ${r.attackScale} | ${r.winRate}% | ${r.meanRounds} |`,
  ),
  '',
  '## 种子42逐回合轨迹',
];
for (const t of traces)
  md.push(
    '',
    `### ${BUILD_NAMES[t.build]}`,
    `结果 ${t.outcome}，${t.rounds}轮，余血${t.playerHp}。`,
    '',
    '| 轮 | 执行者 | 行动 | 玩家生命 | 敌人生命 | 灵力 | 护盾 | 剑意 | 毒火 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...t.trace.map(
      (r) =>
        `| ${r.round} | ${r.actor} | ${r.action} | ${r.hp} | ${r.enemyHp} | ${r.mana} | ${r.shield} | ${r.intent} | ${r.dots} |`,
    ),
  );
md.push(
  '',
  '## 针对性换装与策略',
  '',
  '| 调整 | 胜率 | 全样本回合 |',
  '| --- | --- | --- |',
  ...adaptive.map((r) => `| ${r.name} | ${r.winRate}% | ${r.meanRounds} |`),
);
writeFileSync('docs/combat/simulation-report.md', md.join('\n') + '\n');
console.table(
  rows.map((r) => ({
    enemy: r.name,
    build: r.buildName,
    win: r.winRate,
    rounds: r.winMeanRounds,
    hp: r.winHpPercent,
    timeout: r.timeout,
  })),
);
console.table(ablations);
console.table(sensitivity);
console.table(adaptive);
