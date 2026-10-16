import { create } from 'zustand';
import {
  advanceGame,
  createGame,
  gameSchema,
  runCommand,
  type Command,
  type GameState,
} from '../core/game';
import { GAME } from '../content/game';
import { downloadJson, saveRepository } from '../platform/save-repository';

export type Page =
  | 'home'
  | 'explore'
  | 'techniques'
  | 'companion'
  | 'tower'
  | 'inventory'
  | 'battle';
interface State {
  status: 'loading' | 'ready' | 'error';
  snapshot: GameState | null;
  readonly: boolean;
  busy: boolean;
  error: string | null;
  message: string | null;
  page: Page;
  offline: { elapsed: number; exp: number; coins: number } | null;
  navigate: (page: Page) => void;
  dismiss: () => void;
  dismissOffline: () => void;
}
export const useGameStore = create<State>((set) => ({
  status: 'loading',
  snapshot: null,
  readonly: false,
  busy: false,
  error: null,
  message: null,
  page: 'home',
  offline: null,
  navigate: (page) => set({ page }),
  dismiss: () => set({ message: null }),
  dismissOffline: () => set({ offline: null }),
}));
let started = false;
let queue: Promise<unknown> = Promise.resolve();
let saveTimer: ReturnType<typeof setInterval> | undefined;

export function initializeGame(): void {
  if (started) return;
  started = true;
  if (!navigator.locks) {
    useGameStore.setState({
      status: 'error',
      error: '当前浏览器缺少存档锁支持，请使用新版 Chrome 或 Edge。',
    });
    return;
  }
  void navigator.locks
    .request('path-of-ascension-main', { mode: 'exclusive', ifAvailable: true }, async (lock) => {
      try {
        const before = await saveRepository.load();
        const now = Date.now();
        const base = before ?? createGame(now);
        const next = lock
          ? await saveRepository.commit(advanceGame(base, now), base.revision)
          : base;
        useGameStore.setState({
          status: 'ready',
          snapshot: next,
          readonly: !lock,
          offline:
            before && now - before.lastSettledAt > 60_000
              ? {
                  elapsed: Math.min(now - before.lastSettledAt, GAME.offlineMs),
                  exp: next.exp - before.exp,
                  coins: next.spirit - before.spirit,
                }
              : null,
        });
        if (lock) {
          saveTimer = setInterval(() => void dispatch({ type: 'tick' }), GAME.saveMs);
          document.addEventListener('visibilitychange', () => {
            if (document.hidden) void dispatch({ type: 'tick' });
          });
          // 文档销毁时浏览器会释放此锁；第二个标签页只读，避免双重结算。
          await new Promise<void>(() => {});
        }
      } catch (error) {
        if (saveTimer) clearInterval(saveTimer);
        useGameStore.setState({
          status: 'error',
          error: `存档读取失败，原文件未被覆盖。${error instanceof Error ? error.message : ''}`,
        });
      }
    })
    .catch((error) => useGameStore.setState({ status: 'error', error: String(error) }));
}

export function dispatch(command: Command): Promise<boolean> {
  const task = queue.then(async () => {
    const { snapshot, readonly, status } = useGameStore.getState();
    if (!snapshot || status !== 'ready') return false;
    if (readonly) {
      useGameStore.setState({ message: '另一个页面正在修行。关闭它后，刷新此页面即可继续。' });
      return false;
    }
    useGameStore.setState({ busy: true });
    try {
      const next = runCommand(snapshot, command, Date.now());
      const saved = await saveRepository.commit(next, snapshot.revision);
      useGameStore.setState({ snapshot: saved, busy: false });
      return true;
    } catch (error) {
      useGameStore.setState({
        busy: false,
        message: error instanceof Error ? error.message : '保存失败，请导出备份后重试。',
      });
      return false;
    }
  });
  queue = task;
  return task;
}
export async function exportSave(): Promise<void> {
  await dispatch({ type: 'tick' });
  const s = useGameStore.getState().snapshot;
  if (s) downloadJson(s, '问道余烬-修行存档.json');
}
export async function importSave(file: File): Promise<boolean> {
  if (file.size > 2 * 1024 * 1024) {
    useGameStore.setState({ message: '存档文件超过2MB，无法导入。' });
    return false;
  }
  const task = queue.then(async () => {
    const current = useGameStore.getState();
    if (!current.snapshot || current.readonly) return false;
    try {
      const parsed = gameSchema.parse(JSON.parse(await file.text()));
      const imported = advanceGame({ ...parsed, revision: current.snapshot.revision }, Date.now());
      const saved = await saveRepository.commit(imported, current.snapshot.revision);
      useGameStore.setState({ snapshot: saved, message: '修行存档已导入。', page: 'home' });
      return true;
    } catch {
      useGameStore.setState({ message: '存档格式不正确或保存失败，当前进度未改变。' });
      return false;
    }
  });
  queue = task;
  return task;
}
export async function exportRawSave() {
  downloadJson(await saveRepository.raw(), '问道余烬-原始存档备份.json');
}
