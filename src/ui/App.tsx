import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowUpRight,
  Backpack,
  Bell,
  BookOpen,
  Check,
  ChevronRight,
  Compass,
  Download,
  Flame,
  Gem,
  Heart,
  Leaf,
  Lock,
  Mountain,
  ScrollText,
  Settings,
  Shield,
  Sparkles,
  Swords,
  Upload,
  Wind,
  X,
  Layers,
  FastForward,
} from 'lucide-react';
import { BUILD_NAMES, PASSIVES, SKILLS, type BuildId } from '../content/combat-design';
import { GAME, ITEMS, LOCATIONS, RECIPES, type ItemId } from '../content/game';
import {
  cultivationRate,
  realmName,
  requiredExp,
  type Command,
  type GameState,
} from '../core/game';
import {
  dispatch,
  exportRawSave,
  exportSave,
  importSave,
  initializeGame,
  useGameStore,
  type Page,
} from '../store/game-store';
import landscape from '../assets/cultivation-landscape.png';
import battleImage from '../assets/tiger-battle.png';
import s from './App.module.css';

type Dialog = 'settings' | 'alchemy' | 'event' | 'journal' | null;
const number = (n: number) => n.toLocaleString('zh-CN');
const leftTime = (ms: number) => {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
};
const elapsed = (time: number, now: number) => {
  const m = Math.max(0, Math.floor((now - time) / 60_000));
  return m < 1 ? '片刻前' : m < 60 ? `${m}分钟前` : `${Math.floor(m / 60)}小时前`;
};
const NAV = [
  { id: 'home', name: '洞府修炼', icon: Mountain },
  { id: 'explore', name: '山海历练', icon: Compass },
  { id: 'techniques', name: '功法典籍', icon: BookOpen },
  { id: 'companion', name: '仙缘道侣', icon: Heart },
  { id: 'tower', name: '通天塔', icon: Layers },
  { id: 'inventory', name: '行囊藏珍', icon: Backpack },
] as const;
const TITLES: Record<Page, [string, string]> = {
  home: ['洞府修炼', '一方洞天，静养一念仙机。'],
  explore: ['山海历练', '循山川灵脉，寻一场问道机缘。'],
  techniques: ['功法典籍', '万法有别，道心归一。'],
  companion: ['仙缘道侣', '仙途漫漫，幸有同路之人。'],
  tower: ['通天塔', '层楼望尽，问道无穷。'],
  inventory: ['行囊藏珍', '山河所赠，皆有所用。'],
  battle: ['妖兽挑战', '凝神御敌，以所学印证修行。'],
};

function PanelTitle({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className={s.panelTitle}>
      <span>
        {icon}
        <h3>{title}</h3>
      </span>
      {children}
    </div>
  );
}
function Progress({ value, gold = false }: { value: number; gold?: boolean }) {
  return (
    <div className={`${s.progress} ${gold ? s.goldProgress : ''}`}>
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
function Action({
  children,
  secondary = false,
  onClick,
  disabled = false,
  className = '',
}: {
  children: ReactNode;
  secondary?: boolean;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const busy = useGameStore((x) => x.busy),
    readonly = useGameStore((x) => x.readonly);
  return (
    <button
      className={`${secondary ? s.secondary : s.primary} ${className}`}
      onClick={onClick}
      disabled={disabled || busy || readonly}
    >
      {children}
    </button>
  );
}
const act = (command: Command) => {
  void dispatch(command);
};

export function App() {
  const {
    status,
    snapshot: g,
    page,
    message,
    error,
    readonly,
    offline,
    navigate,
    dismiss,
    dismissOffline,
  } = useGameStore();
  const [now, setNow] = useState(Date.now()),
    [dialog, setDialog] = useState<Dialog>(null);
  useEffect(() => {
    initializeGame();
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(dismiss, 5500);
    return () => clearTimeout(timer);
  }, [message, dismiss]);
  if (status !== 'ready' || !g)
    return (
      <main
        className={s.loading}
        style={{ backgroundImage: `linear-gradient(#0c1819a8,#0c1819ed),url(${landscape})` }}
      >
        <div className={s.seal}>问</div>
        <h1>问道余烬</h1>
        <p>{status === 'error' ? error : '山门渐开，静候灵机……'}</p>
        {status === 'error' && (
          <button className={s.secondary} onClick={() => void exportRawSave()}>
            导出原始存档备份
          </button>
        )}
      </main>
    );
  return (
    <div className={s.app}>
      <aside className={s.sidebar}>
        <div className={s.brand}>
          <span className={s.seal}>问</span>
          <div>
            <strong>问道余烬</strong>
            <small>山海有尽 · 仙途未央</small>
          </div>
        </div>
        <div className={s.navHeading}>
          修 行 天 地 <span>壹</span>
        </div>
        <nav aria-label="主要导航">
          {NAV.map((n) => (
            <button
              key={n.id}
              className={`${s.navItem} ${page === n.id || (page === 'battle' && n.id === 'explore') ? s.navActive : ''}`}
              onClick={() => navigate(n.id)}
            >
              <n.icon size={20} />
              <span>{n.name}</span>
              {n.id === 'tower' ? (
                <Lock size={12} className={s.navLock} />
              ) : (
                <ChevronRight size={13} className={s.navChevron} />
              )}
            </button>
          ))}
        </nav>
        <div
          className={s.sideLandscape}
          style={{ backgroundImage: `linear-gradient(0deg,#101d1c,#101d1c00),url(${landscape})` }}
        >
          <span>青 岚 初 境</span>
        </div>
        <button className={s.sideSettings} onClick={() => setDialog('settings')}>
          <Settings size={17} />
          修行设置<span>v0.1</span>
        </button>
        <div className={s.profile}>
          <div className={s.avatar} style={{ backgroundImage: `url(${battleImage})` }} />
          <div>
            <strong>{g.name}</strong>
            <span>{realmName(g)}</span>
          </div>
          <span className={s.profileSeal}>散修</span>
        </div>
      </aside>
      <div className={s.workspace}>
        <header className={s.topbar}>
          <div className={s.location}>
            <Mountain size={18} />
            <span>青岚山</span>
            <ChevronRight size={12} />
            <strong>无名洞府</strong>
          </div>
          <div className={s.resources}>
            <span title="灵石">
              <Gem size={17} />
              <small>灵石</small>
              <b>{number(g.spirit)}</b>
            </span>
            <span title="悟性">
              <Sparkles size={17} />
              <small>悟性</small>
              <b>{number(g.insight)}</b>
            </span>
            <i />
            <button
              className={s.iconButton}
              aria-label="修行通知"
              onClick={() => setDialog(g.flags.legacy ? 'journal' : 'event')}
            >
              <Bell size={18} />
              {!g.flags.legacy && <em />}
            </button>
            <button
              className={s.iconButton}
              aria-label="设置"
              onClick={() => setDialog('settings')}
            >
              <Settings size={18} />
            </button>
          </div>
        </header>
        {readonly && (
          <div className={s.readonly}>
            当前为只读预览。另一个页面正在修行，关闭它后刷新即可继续。
          </div>
        )}
        <main className={s.main}>
          <div className={s.pageHeading}>
            <div>
              <div className={s.eyebrow}>苍 梧 界 · 青 岚 山</div>
              <h1>{TITLES[page][0]}</h1>
              <p>{TITLES[page][1]}</p>
            </div>
            <div className={s.weather}>
              <span className={s.liveDot} />
              灵气充盈 <span className={s.weatherDivider}>/</span> 春日 · 晴
            </div>
          </div>
          {page === 'home' && <Home g={g} now={now} open={setDialog} />}
          {page === 'explore' && <Explore g={g} now={now} open={setDialog} />}
          {page === 'techniques' && <Techniques g={g} />}
          {page === 'companion' && <Companion g={g} />}
          {page === 'tower' && <Tower />}
          {page === 'inventory' && <Inventory g={g} open={setDialog} />}
          {page === 'battle' && <Battle g={g} />}
          <footer className={s.footer}>
            <span>修行无岁月，山海自长青。</span>
            <span>
              <span className={s.liveDot} />
              {readonly ? '只读预览' : '进度已自动保存'}
              <span className={s.footerVersion}>青岚初境 · 初版试玩</span>
            </span>
          </footer>
        </main>
      </div>
      {message && (
        <div className={s.toast} role="status">
          <Sparkles size={17} />
          {message}
          <button aria-label="关闭提示" onClick={dismiss}>
            <X size={15} />
          </button>
        </div>
      )}
      {dialog && (
        <Modal
          title={
            { settings: '修行设置', alchemy: '照尘丹炉', event: '炉中残念', journal: '修行纪事' }[
              dialog
            ]
          }
          close={() => setDialog(null)}
        >
          {dialog === 'settings' && <SettingsPanel g={g} close={() => setDialog(null)} />}
          {dialog === 'alchemy' && <Alchemy g={g} now={now} />}
          {dialog === 'event' && (
            <div className={s.event}>
              <span className={s.eventSeal}>缘</span>
              <p className={s.quote}>“炉中尚有一缕余温，似在等候有缘之人。”</p>
              <p>
                指尖触及炉壁，旧日丹师的残念缓缓苏醒。纷乱的阵纹中，你窥见了一段关于吐纳与凝气的古老心法。
              </p>
              <div className={s.rewards}>
                <span>
                  <Wind size={16} />
                  修为 +720
                </span>
                <span>
                  <Sparkles size={16} />
                  悟性 +5
                </span>
              </div>
              <Action
                disabled={g.flags.legacy}
                onClick={() =>
                  void dispatch({ type: 'legacy' }).then((ok) => {
                    if (ok) setDialog(null);
                  })
                }
              >
                {g.flags.legacy ? '已参悟这段残念' : '静心参悟'}
              </Action>
            </div>
          )}
          {dialog === 'journal' && <Journal g={g} now={now} all />}
        </Modal>
      )}
      {offline && (
        <Modal title="别来无恙，道友" close={dismissOffline}>
          <div className={s.offline}>
            <Wind size={44} />
            <h2>山中一梦，修为自长</h2>
            <p>
              你离开了 {Math.max(1, Math.floor(offline.elapsed / 60_000))}{' '}
              分钟。洞府中的吐纳与已安排的历练仍在继续。
            </p>
            <div className={s.offlineGrid}>
              <span>
                积累修为<strong>+{number(offline.exp)}</strong>
              </span>
              <span>
                获得灵石<strong>+{number(offline.coins)}</strong>
              </span>
            </div>
            <Action onClick={dismissOffline}>收心归来</Action>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Home({ g, now, open }: { g: GameState; now: number; open: (d: Dialog) => void }) {
  const navigate = useGameStore((x) => x.navigate),
    need = requiredExp(g),
    ready = g.exp >= need;
  const next = g.foundation
    ? '静待新的仙途'
    : g.level === 9
      ? '筑基初期'
      : `炼气${['一', '二', '三', '四', '五', '六', '七', '八', '九'][g.level]}层`;
  const location = LOCATIONS.find((l) => l.id === g.outing?.locationId),
    recipe = RECIPES.find((r) => r.id === g.craft?.recipeId);
  return (
    <>
      {!g.flags.legacy && (
        <button className={s.storyBanner} onClick={() => open('event')}>
          <span>
            <ScrollText size={16} />
            <b>炉中残念</b>
            <span>照尘炉微微发热，一段古老传承正等待回应。</span>
          </span>
          <span>
            查看机缘 <ArrowUpRight size={15} />
          </span>
        </button>
      )}
      <div className={s.homeGrid}>
        <section className={s.hero}>
          <div className={s.heroImage} style={{ backgroundImage: `url(${landscape})` }} />
          <div className={s.heroShade} />
          <span className={s.heroCorner}>青 岚 洞 天</span>
          <div className={s.heroContent}>
            <div className={s.heroKicker}>
              <Wind size={16} />吐 纳 天 地
            </div>
            <h2>{realmName(g)}</h2>
            <p className={s.heroPoem}>一念澄明，万籁入心。</p>
            <div className={s.cultivationStats}>
              <span>当前修为</span>
              <strong>
                {number(g.exp)}
                <small>/ {number(need)}</small>
              </strong>
            </div>
            <Progress value={(g.exp / need) * 100} />
            <div className={s.rate}>
              <span>
                <span className={s.liveDot} />
                {g.mode === 'secluded' ? '正在闭关' : '正在修炼'}
              </span>
              <strong>
                +{cultivationRate(g)}
                <small> 修为 / 分钟</small>
              </strong>
            </div>
            <Action onClick={() => act({ type: 'toggleCultivation' })}>
              <Wind size={17} />
              {g.mode === 'secluded' ? '结束闭关' : '开始闭关'}
              <ChevronRight size={16} />
            </Action>
            <button
              className={s.ponder}
              onClick={() => act({ type: 'ponder' })}
              title="消耗5悟性，获得当前阶段25%的修为"
            >
              参悟古卷 <span>悟性 5</span>
            </button>
          </div>
          <div className={s.heroBottom}>
            <span>
              灵脉 <b>{['一', '二', '三'][g.homeLevel - 1]}阶</b>
            </span>
            <span>
              洞府 <b>无名洞府</b>
            </span>
            <button onClick={() => act({ type: 'upgradeHome' })}>
              温养灵脉 <ArrowUpRight size={13} />
            </button>
          </div>
        </section>
        <aside className={s.rightStack}>
          <section className={`${s.panel} ${s.goalPanel}`}>
            <PanelTitle icon={<Sparkles size={16} />} title="下一重境界" />
            <div className={s.nextRealm}>
              <span className={s.realmGlyph}>{g.level === 9 ? '筑' : '气'}</span>
              <div>
                <small>凝气归元 · 更进一步</small>
                <h2>{next}</h2>
              </div>
            </div>
            <div className={s.requirements}>
              <Requirement
                label="修为圆满"
                value={`${number(Math.min(g.exp, need))} / ${number(need)}`}
                done={ready}
              />
              <Requirement
                label="灵石"
                value={`${number(g.spirit)} / ${g.level === 9 ? 300 : 100}`}
                done={g.spirit >= (g.level === 9 ? 300 : 100)}
              />
              {g.level === 9 && !g.foundation && (
                <>
                  <Requirement
                    label="筑基丹"
                    value={`${g.inventory.foundationPill} / 1`}
                    done={g.inventory.foundationPill > 0}
                  />
                  <Requirement
                    label="地脉印"
                    value={`${g.inventory.seal} / 1`}
                    done={g.inventory.seal > 0}
                  />
                </>
              )}
            </div>
            <Action
              disabled={
                !ready ||
                g.foundation ||
                (g.level === 9 && (!g.inventory.foundationPill || !g.inventory.seal))
              }
              onClick={() => act({ type: 'breakthrough' })}
            >
              突破境界 <ArrowUpRight size={16} />
            </Action>
            <p className={s.panelHint}>
              {g.foundation
                ? '新的境界与区域将在后续开放'
                : ready
                  ? '灵机已至，可尝试突破'
                  : '静心积累，待修为圆满'}
            </p>
          </section>
          <section className={s.panel}>
            <PanelTitle icon={<Compass size={16} />} title="当前历练">
              <button onClick={() => navigate('explore')}>
                前往
                <ChevronRight size={12} />
              </button>
            </PanelTitle>
            <div className={s.taskBody}>
              <div>
                <span className={s.taskTag}>{location?.tag ?? '山海待访'}</span>
                <h3>{location?.name ?? '尚未安排历练'}</h3>
              </div>
              <Compass size={35} className={s.taskArt} />
            </div>
            {location && g.outing ? (
              <>
                <div className={s.taskMeta}>
                  <span>
                    {ITEMS[location.item].name} ×{location.amount}
                  </span>
                  <b>{leftTime(g.outing.nextAt - now)}</b>
                </div>
                <Progress value={(1 - (g.outing.nextAt - now) / GAME.outingMs) * 100} />
              </>
            ) : (
              <p className={s.emptyHint}>选择一处去处，寻访山中灵材。</p>
            )}
          </section>
          <section className={s.panel}>
            <PanelTitle icon={<Flame size={16} />} title="炼丹队列">
              <button onClick={() => open('alchemy')}>
                {recipe ? '查看' : '开炉'}
                <ChevronRight size={12} />
              </button>
            </PanelTitle>
            <div className={s.taskBody}>
              <div>
                <span className={s.taskTag}>{recipe ? '丹火温养' : '照尘炉'}</span>
                <h3>{recipe?.name ?? '丹炉正待添薪'}</h3>
              </div>
              <Flame size={35} className={s.furnace} />
            </div>
            {recipe && g.craft ? (
              <>
                <div className={s.taskMeta}>
                  <span>预计获得 ×1</span>
                  <b>{leftTime(g.craft.finishAt - now)}</b>
                </div>
                <Progress value={(1 - (g.craft.finishAt - now) / recipe.duration) * 100} gold />
              </>
            ) : (
              <p className={s.emptyHint}>以草木灵韵，炼一炉仙家丹香。</p>
            )}
          </section>
        </aside>
      </div>
      <div className={s.bottomGrid}>
        <section className={s.panel}>
          <PanelTitle icon={<BookOpen size={16} />} title="当前功法">
            <button onClick={() => navigate('techniques')}>
              功法典籍 <ChevronRight size={12} />
            </button>
          </PanelTitle>
          <div className={s.techRow}>
            {SKILLS.filter((x) => x.build === g.build)
              .slice(0, 3)
              .map((t, i) => (
                <button
                  key={t.id}
                  className={`${s.miniTech} ${s[`techTone${i}`]}`}
                  onClick={() => navigate('techniques')}
                >
                  <span className={s.bookIcon}>
                    <span>{t.name.slice(0, 2)}</span>
                  </span>
                  <span>
                    <strong>{t.name}</strong>
                    <small>
                      {i === 0 ? '常用' : '法术'} · {g.abilityLevel}重
                    </small>
                  </span>
                </button>
              ))}
          </div>
        </section>
        <section className={s.panel}>
          <PanelTitle icon={<ScrollText size={16} />} title="修行纪事">
            <button onClick={() => open('journal')}>
              全部 <ChevronRight size={12} />
            </button>
          </PanelTitle>
          <Journal g={g} now={now} />
        </section>
      </div>
    </>
  );
}
function Requirement({ label, value, done }: { label: string; value: string; done: boolean }) {
  return (
    <div className={s.requirement}>
      <span>
        {done ? <Check size={14} /> : <span className={s.hollowDot} />} {label}
      </span>
      <b className={done ? s.fulfilled : ''}>{value}</b>
    </div>
  );
}
function Journal({ g, now, all = false }: { g: GameState; now: number; all?: boolean }) {
  return (
    <div className={`${s.journal} ${all ? s.journalAll : ''}`}>
      {g.logs.slice(0, all ? 40 : 3).map((l) => (
        <div key={l.id}>
          <time>{elapsed(l.time, now)}</time>
          <span className={l.kind === 'story' ? s.storyText : l.kind === 'good' ? s.goodText : ''}>
            {l.text}
          </span>
        </div>
      ))}
    </div>
  );
}

function Explore({ g, now, open }: { g: GameState; now: number; open: (d: Dialog) => void }) {
  const navigate = useGameStore((x) => x.navigate);
  return (
    <>
      <section
        className={s.exploreBanner}
        style={{ backgroundImage: `linear-gradient(90deg,#0d1d1cce,#0d1d1c33),url(${landscape})` }}
      >
        <div>
          <span className={s.eyebrow}>第一章 · 青岚求生</span>
          <h2>青岚山脉</h2>
          <p>药径、雾溪与旧山道之间，藏着散修的第一份机缘。</p>
        </div>
        <span className={s.chapterSeal}>岚</span>
      </section>
      <div className={s.sectionHeading}>
        <h2>寻访山海</h2>
        <span>每轮五分钟 · 可离线结算</span>
      </div>
      <div className={s.locationGrid}>
        {LOCATIONS.map((l, i) => {
          const locked = !g.foundation && g.level < l.level,
            active = g.outing?.locationId === l.id;
          return (
            <section key={l.id} className={`${s.locationCard} ${active ? s.selectedCard : ''}`}>
              <div className={s.locationArt}>
                <span>零{['一', '二', '三'][i]}</span>
                {i === 0 ? <Leaf size={48} /> : i === 1 ? <Wind size={48} /> : <Swords size={48} />}
              </div>
              <span className={s.taskTag}>
                {l.tag} · 炼气{l.level}层
              </span>
              <h3>{l.name}</h3>
              <p>{l.description}</p>
              <div className={s.locationRewards}>
                <span>
                  {ITEMS[l.item].name} ×{l.amount}
                </span>
                <span>
                  <Gem size={13} /> {l.coins}
                </span>
              </div>
              <Action
                secondary={!active}
                disabled={locked}
                onClick={() => act(active ? { type: 'stopOuting' } : { type: 'outing', id: l.id })}
              >
                {locked ? (
                  <>
                    <Lock size={14} />
                    境界尚未达到
                  </>
                ) : active ? (
                  <>
                    <Check size={15} />
                    历练中 · 点击结束
                  </>
                ) : (
                  <>
                    前往历练
                    <ArrowUpRight size={15} />
                  </>
                )}
              </Action>
            </section>
          );
        })}
      </div>
      <div className={s.bossCard}>
        <div className={s.bossImage} style={{ backgroundImage: `url(${battleImage})` }} />
        <div className={s.bossInfo}>
          <span className={s.taskTag}>章节妖兽 · 主动挑战</span>
          <h2>黑旗妖虎</h2>
          <p>黑旗岭的深处，妖虎已盘踞多时。运用所学功法，夺回地脉信物。</p>
          <div className={s.rewards}>
            <span>一阶妖丹 ×2</span>
            <span>灵石 150</span>
            <span>{g.flags.tiger ? '首通信物已获得' : '首通：青岚地脉印'}</span>
          </div>
        </div>
        <Action
          disabled={now < g.battleReadyAt}
          onClick={() =>
            void dispatch({ type: 'fight' }).then((ok) => {
              if (ok) navigate('battle');
            })
          }
        >
          {now < g.battleReadyAt ? (
            `调息 ${leftTime(g.battleReadyAt - now)}`
          ) : (
            <>
              挑战妖虎
              <Swords size={16} />
            </>
          )}
        </Action>
      </div>
      {!g.flags.legacy && (
        <button className={s.storyBanner} onClick={() => open('event')}>
          <span>
            <ScrollText size={17} />
            <b>山中奇遇 · 炉中残念</b>
          </span>
          <span>
            查看机缘
            <ArrowUpRight size={15} />
          </span>
        </button>
      )}
      {g.battle && (
        <button className={s.textButton} onClick={() => navigate('battle')}>
          回看最近一场战斗 <ChevronRight size={14} />
        </button>
      )}
    </>
  );
}

function Techniques({ g }: { g: GameState }) {
  return (
    <>
      <div className={s.infoStrip}>
        <span>
          <BookOpen size={18} />
          功法精研 <b>{g.abilityLevel}重</b>
        </span>
        <span>精研同时提高吐纳效率与战斗能力</span>
        <Action
          secondary
          onClick={() => act({ type: 'upgradeAbility' })}
          disabled={g.abilityLevel >= 10}
        >
          精研功法 · {number(g.abilityLevel * 120)} 灵石
        </Action>
      </div>
      <div className={s.buildGrid}>
        {(['sword', 'toxin', 'ward'] as BuildId[]).map((b, i) => (
          <section key={b} className={`${s.buildCard} ${g.build === b ? s.selectedCard : ''}`}>
            <span className={`${s.buildGlyph} ${s[`techTone${i}`]}`}>
              <span>{['剑', '焰', '岳'][i]}</span>
            </span>
            <span className={s.taskTag}>
              {['凝意破甲 · 一剑归元', '毒火交织 · 异常引爆', '水土相济 · 护身反震'][i]}
            </span>
            <h2>{BUILD_NAMES[b]}</h2>
            <p>
              {
                [
                  '叠加剑意，在破甲后打出强力一击。',
                  '以毒和灼烧持续消耗，在合适的时机引爆。',
                  '用护盾承接攻势，以反击换取稳定胜机。',
                ][i]
              }
            </p>
            <div className={s.skillList}>
              {SKILLS.filter((t) => t.build === b).map((t) => (
                <div key={t.id}>
                  <span>{t.name}</span>
                  <small>
                    灵力 {t.cost} · 冷却 {t.cooldown}轮
                  </small>
                </div>
              ))}
            </div>
            <div className={s.passiveList}>
              {PASSIVES.filter((t) => t.build === b).map((t) => (
                <span key={t.id} title={t.rule}>
                  {t.name}
                </span>
              ))}
            </div>
            <Action
              secondary={g.build !== b}
              disabled={g.build === b}
              onClick={() => act({ type: 'build', id: b })}
            >
              {g.build === b ? (
                <>
                  <Check size={15} />
                  当前构筑
                </>
              ) : (
                <>
                  研习此道
                  <ArrowUpRight size={15} />
                </>
              )}
            </Action>
          </section>
        ))}
      </div>
      <div className={s.note}>
        <Sparkles size={17} />
        <p>
          当前为预设构筑试玩。先尝试不同流派对妖虎的表现，后续再逐步开放独立功法装配与条件设置。
        </p>
      </div>
    </>
  );
}

function Companion({ g }: { g: GameState }) {
  const c = g.companion;
  return (
    <div className={s.companionLayout}>
      <div className={s.companionArt}>
        <div className={s.herbalRing}>
          <Leaf size={90} strokeWidth={0.6} />
          <span>
            青<br />禾
          </span>
        </div>
        <div className={s.companionPoem}>
          草木有灵
          <br />
          医者有心
        </div>
        <span className={s.companionSeal}>百草谷</span>
      </div>
      <section className={`${s.panel} ${s.companionInfo}`}>
        <span className={s.eyebrow}>百草谷医修</span>
        <h2>沈青禾</h2>
        <p className={s.quote}>
          “修行是为了走得更远，
          <br />
          也是为了来得及救下眼前的人。”
        </p>
        <p>
          为救治山中的伤者，她暂别师门，独自在青岚药径采集灵草。性情温和，却从不在救人这件事上退让。
        </p>
        <div className={s.relationship}>
          {['初识', '同行', '知己', '结契'].map((n, i) => (
            <span
              key={n}
              className={
                (i === 0 && c.met) || (i === 1 && c.bond >= 30) ? s.relationshipActive : ''
              }
            >
              {i > 1 && <Lock size={11} />} {n}
            </span>
          ))}
        </div>
        <Requirement label="信任" value={`${c.bond} / 100`} done={c.bond >= 30} />
        <Progress value={c.bond} />
        <div className={s.companionQuest}>
          <span className={s.taskTag}>人物委托 · 药庐将熄</span>
          <h3>{!c.met ? '药径初逢' : g.flags.friendQuest ? '共守药庐' : '一炉救急的灵草'}</h3>
          <p>
            {!c.met
              ? '送上三株青灵草，帮助她救治山中的伤者。'
              : g.flags.friendQuest
                ? '你们共同守过了一个漫长的雨夜。她愿意与你同行。'
                : '药庐还缺五株青灵草。为她送去材料，或许能赶上这一炉丹药。'}
          </p>
          <Action
            onClick={() =>
              act(
                !c.met
                  ? { type: 'meet' }
                  : !g.flags.friendQuest
                    ? { type: 'friendQuest' }
                    : { type: 'travel' },
              )
            }
          >
            {!c.met
              ? '结识青禾 · 青灵草 ×3'
              : !g.flags.friendQuest
                ? '送去灵草 · 青灵草 ×5'
                : c.travel
                  ? '暂别同行'
                  : '邀请同行'}
          </Action>
        </div>
        <div className={s.note}>
          <Heart size={17} />
          <p>同行后，战斗最大生命提高15%。知己与结契故事将在后续版本开放。</p>
        </div>
      </section>
    </div>
  );
}

function Tower() {
  return (
    <section
      className={s.towerScene}
      style={{ backgroundImage: `linear-gradient(90deg,#0c191bda,#10201eaa),url(${landscape})` }}
    >
      <div className={s.towerArt}>
        <div className={s.moon} />
        <svg viewBox="0 0 260 480" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((v) => (
            <g key={v} transform={`translate(0 ${v * 73})`}>
              <path
                d={`M${100 - v * 9} ${70}h${60 + v * 18}v55H${100 - v * 9}z`}
                fill="#102724"
                stroke="#8c7850"
              />
              <path
                d={`M${70 - v * 12} 74Q110 62 130 40Q150 62 ${190 + v * 12} 74L${200 + v * 12} 83H${60 - v * 12}Z`}
                fill="#1b3430"
                stroke="#ac9565"
              />
              <path d={`M${115} 94h30v28h-30z`} fill="#bda66e" opacity=".5" />
            </g>
          ))}
          <path d="M130 4v39m-9-25h18M46 454h168" stroke="#b89c62" strokeWidth="3" />
        </svg>
        <span>通 天 塔</span>
      </div>
      <div className={s.towerInfo}>
        <span className={s.taskTag}>后期挑战 · 尚未开放</span>
        <h2>
          塔门未开
          <br />
          <small>道途尚远</small>
        </h2>
        <p>云海尽头，一座古塔静立千年。每一层都是一场试炼，唯有准备周全，方能继续向上。</p>
        <div className={s.towerFeatures}>
          <span>
            <Swords size={20} />
            守关妖兽
          </span>
          <span>
            <Gem size={20} />
            首通珍宝
          </span>
          <span>
            <BookOpen size={20} />
            功法试炼
          </span>
        </div>
        <div className={s.lockedNotice}>
          <Lock size={17} />
          <span>先在青岚山磨砺道基。爬塔机制将在后续迭代加入。</span>
        </div>
      </div>
    </section>
  );
}

function Inventory({ g, open }: { g: GameState; open: (d: Dialog) => void }) {
  const [filter, setFilter] = useState('全部'),
    [selected, setSelected] = useState<ItemId>('pill');
  return (
    <>
      <div className={s.inventoryToolbar}>
        <div className={s.filters}>
          {['全部', '灵材', '丹药', '信物'].map((f) => (
            <button
              key={f}
              className={filter === f ? s.filterActive : ''}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <Action secondary onClick={() => open('alchemy')}>
          <Flame size={16} />
          开炉炼丹
        </Action>
      </div>
      <div className={s.inventoryLayout}>
        <div className={s.itemGrid}>
          {(Object.keys(ITEMS) as ItemId[])
            .filter((id) => filter === '全部' || ITEMS[id].category === filter)
            .map((id) => (
              <button
                key={id}
                className={`${s.item} ${selected === id ? s.itemSelected : ''} ${g.inventory[id] === 0 ? s.itemEmpty : ''}`}
                onClick={() => setSelected(id)}
              >
                <span className={s.itemGlyph}>{ITEMS[id].glyph}</span>
                <strong>{ITEMS[id].name}</strong>
                <small>{ITEMS[id].category}</small>
                <b>×{number(g.inventory[id])}</b>
              </button>
            ))}
        </div>
        <aside className={`${s.panel} ${s.itemDetail}`}>
          <span className={s.itemGlyph}>{ITEMS[selected].glyph}</span>
          <span className={s.taskTag}>{ITEMS[selected].category}</span>
          <h2>{ITEMS[selected].name}</h2>
          <p>{ITEMS[selected].description}</p>
          <div className={s.detailCount}>
            当前持有 <strong>{g.inventory[selected]}</strong>
          </div>
          {selected === 'pill' ? (
            <Action disabled={!g.inventory.pill} onClick={() => act({ type: 'usePill' })}>
              服用聚灵丹
            </Action>
          ) : (
            <Action secondary onClick={() => open('alchemy')}>
              查看相关丹方
            </Action>
          )}
        </aside>
      </div>
    </>
  );
}

function Battle({ g }: { g: GameState }) {
  const battle = g.battle,
    navigate = useGameStore((x) => x.navigate);
  const [index, setIndex] = useState(-1),
    [speed, setSpeed] = useState(1);
  useEffect(() => {
    setIndex(-1);
  }, [battle?.id]);
  useEffect(() => {
    if (!battle || index >= battle.frames.length - 1) return;
    const t = setTimeout(() => setIndex((n) => n + 1), 850 / speed);
    return () => clearTimeout(t);
  }, [battle, index, speed]);
  if (!battle) return <div className={s.note}>还没有战斗记录，请前往山海历练挑战妖虎。</div>;
  const frame = battle.frames[index],
    done = index >= battle.frames.length - 1,
    hp = frame?.hp ?? battle.playerMax,
    enemyHp = frame?.enemyHp ?? battle.enemyMax;
  return (
    <>
      <div className={s.battleLayout}>
        <section
          className={`${s.battleScene} ${frame?.action.includes('重击') ? s.battleImpact : ''}`}
          style={{
            backgroundImage: `linear-gradient(0deg,#0d181bc9,transparent 50%,#0d181b99),url(${battleImage})`,
          }}
        >
          <div className={s.fighters}>
            <div>
              <span>散修 · {realmName(g)}</span>
              <h3>
                {g.name}
                <small>{BUILD_NAMES[g.build]}</small>
              </h3>
              <Progress value={(hp / battle.playerMax) * 100} />
              <small>
                {number(hp)} / {number(battle.playerMax)}
              </small>
            </div>
            <div className={s.versus}>
              对<br />决
            </div>
            <div>
              <span>黑旗岭 · 章节妖兽</span>
              <h3>
                黑旗妖虎<small>妖兽</small>
              </h3>
              <Progress value={(enemyHp / battle.enemyMax) * 100} gold />
              <small>
                {number(enemyHp)} / {number(battle.enemyMax)}
              </small>
            </div>
          </div>
          <div className={s.battleRound}>{done ? '战斗结束' : `第 ${frame?.round ?? 1} 回合`}</div>
          {frame && !done && (
            <div key={index} className={s.combatMessage}>
              <span>{frame.actor}</span>
              <strong>{frame.action}</strong>
            </div>
          )}
          {done && (
            <div className={s.battleResult}>
              <span>{battle.won ? '胜' : '退'}</span>
              <h2>{battle.won ? '妖雾已散，道心更明' : '暂避锋芒，再整道法'}</h2>
              <p>
                {battle.won
                  ? '获得灵石150 · 一阶妖丹×2，已存入行囊'
                  : '本次未获战利品，可精研功法或调整流派后再战。'}
              </p>
              <Action onClick={() => navigate('explore')}>
                返回山海历练
                <ArrowUpRight size={16} />
              </Action>
            </div>
          )}
          <div className={s.battleControls}>
            <span>
              <span className={s.liveDot} />
              自动回合战斗
            </span>
            <div>
              {[1, 2, 4].map((v) => (
                <button
                  key={v}
                  className={speed === v ? s.speedActive : ''}
                  onClick={() => setSpeed(v)}
                >
                  {v}倍
                </button>
              ))}
              <button onClick={() => setIndex(battle.frames.length - 1)} disabled={done}>
                <FastForward size={14} />
                跳过演出
              </button>
            </div>
          </div>
        </section>
        <aside className={`${s.panel} ${s.battleJournal}`}>
          <PanelTitle icon={<ScrollText size={16} />} title="战况记录" />
          <div className={s.combatLog}>
            {battle.frames.slice(0, index + 1).map((f, i) => (
              <div key={i}>
                <small>
                  第{f.round}回合 · {f.actor}
                </small>
                <p>{f.action}</p>
              </div>
            ))}
            {index < 0 && <p className={s.emptyHint}>凝神静气，战斗即将开始。</p>}
          </div>
          <div className={s.note}>
            <Shield size={17} />
            <p>加速和跳过只改变演出速度，战斗结果与奖励仅结算一次。</p>
          </div>
        </aside>
      </div>
      <div className={s.infoStrip}>
        <span>
          <Swords size={17} />
          当前构筑：{BUILD_NAMES[g.build]}
        </span>
        <span>共 {battle.rounds} 回合 · 每回合自动选择可用功法</span>
        <button className={s.textButton} onClick={() => navigate('techniques')}>
          调整功法
          <ArrowUpRight size={15} />
        </button>
      </div>
    </>
  );
}

function Alchemy({ g, now }: { g: GameState; now: number }) {
  return (
    <div className={s.alchemy}>
      <div className={s.alchemyIntro}>
        <Flame size={36} />
        <div>
          <h3>丹理传承十重 · 当前可炼一品</h3>
          <p>以草木为引，静候丹成。</p>
        </div>
      </div>
      {RECIPES.map((r) => (
        <section key={r.id} className={s.recipe}>
          <div>
            <span className={s.taskTag}>一品丹药 · {r.duration / 60_000}分钟</span>
            <h3>{r.name}</h3>
            <p>{r.description}</p>
          </div>
          <div className={s.recipeMaterials}>
            {Object.entries(r.cost).map(([id, n]) => (
              <span key={id} className={g.inventory[id as ItemId] >= (n ?? 0) ? s.goodText : ''}>
                {ITEMS[id as ItemId].name} {g.inventory[id as ItemId]}/{n}
              </span>
            ))}
            <span>灵石 {r.coins}</span>
          </div>
          <Action secondary disabled={!!g.craft} onClick={() => act({ type: 'craft', id: r.id })}>
            {g.craft?.recipeId === r.id
              ? `正在温养 ${leftTime(g.craft.finishAt - now)}`
              : g.craft
                ? '丹炉正在使用'
                : '开始炼制'}
          </Action>
        </section>
      ))}
    </div>
  );
}

function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null),
    closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = ref.current;
    root?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
      if (e.key === 'Tab' && root) {
        const items = Array.from(
          root.querySelectorAll<HTMLElement>('button:not(:disabled),input,a[href],[tabindex="0"]'),
        );
        if (!items.length) return;
        const first = items[0],
          last = items.at(-1)!;
        if (e.shiftKey && (document.activeElement === first || document.activeElement === root)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handler);
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = old;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className={s.modalBackdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={ref}
        className={s.modal}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className={s.modalHeader}>
          <h2>{title}</h2>
          <button aria-label="关闭对话框" onClick={close}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function SettingsPanel({ g, close }: { g: GameState; close: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className={s.settingsPanel}>
      <div className={s.settingsIdentity}>
        <span className={s.seal}>问</span>
        <div>
          <h3>
            {g.name} · {realmName(g)}
          </h3>
          <p>青岚初境 · 本地单机存档</p>
        </div>
      </div>
      <div className={s.settingsActions}>
        <button className={s.secondary} onClick={() => void exportSave()}>
          <Download size={17} />
          导出修行存档
        </button>
        <Action secondary onClick={() => input.current?.click()}>
          <Upload size={17} />
          导入修行存档
        </Action>
        <input
          ref={input}
          hidden
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (
              file &&
              window.confirm('导入后将替换当前修行进度，旧进度会保留为上一份备份。是否继续？')
            )
              void importSave(file).then((ok) => {
                if (ok) close();
              });
            e.target.value = '';
          }}
        />
      </div>
      <div className={s.settingsText}>
        <h3>这段仙途，刚刚开始</h3>
        <p>
          从炼气六层起步，可参悟古卷、突破境界、安排历练、炼丹、结识青禾并挑战妖虎。通天塔与后续剧情将逐步加入。
        </p>
        <h3>关于保存</h3>
        <p>
          每十秒自动保存，重要操作即时保存。离线最多积累十二小时。更换浏览器、网址或清理站点数据前，请先导出存档。
        </p>
        <p className={s.panelHint}>游戏不需要账号或联网调用 AI，首次加载后即可开始修行。</p>
      </div>
    </div>
  );
}
