import Dexie, { type Table } from 'dexie';
import { gameSchema, type GameState } from '../core/game';

interface SaveRecord {
  id: 'current' | 'backup';
  state: GameState;
}
class GameDatabase extends Dexie {
  saves!: Table<SaveRecord, string>;
  constructor() {
    super('path-of-ascension');
    this.version(1).stores({ saves: '&id' });
  }
}
const db = new GameDatabase();
export const saveRepository = {
  async load(): Promise<GameState | null> {
    const record = await db.saves.get('current');
    return record ? gameSchema.parse(record.state) : null;
  },
  async commit(state: GameState, expectedRevision: number): Promise<GameState> {
    return db.transaction('rw', db.saves, async () => {
      const current = await db.saves.get('current');
      if ((current?.state.revision ?? 0) !== expectedRevision)
        throw new Error('存档已被其他页面更新，请刷新后继续。');
      const saved = gameSchema.parse({ ...state, revision: expectedRevision + 1 });
      if (current) await db.saves.put({ id: 'backup', state: current.state });
      await db.saves.put({ id: 'current', state: saved });
      return saved;
    });
  },
  async raw() {
    return db.saves.toArray();
  },
};
export function downloadJson(value: unknown, name: string): void {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
