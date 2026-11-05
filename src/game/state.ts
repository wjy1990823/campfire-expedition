import { MAPS } from '../data/maps';
import type { Item, Slot } from '../sim/items';

export const SAVE_KEY = 'campfire-expedition.save.v1';
export const INVENTORY_CAP = 60;
export const OFFLINE_CAP_SECONDS = 12 * 3600;

export interface HeroRecord {
  classId: string;
  name: string;
  level: number;
  exp: number;
  gear: Partial<Record<Slot, Item>>;
  talents: Record<string, number>;
  tactics: Tactics;
  /** Personality line of recruited AI adventurers. */
  quote?: string;
}

export interface Tactics {
  /** Healers: heal allies below this hp ratio (null = class default). */
  healThreshold: number | null;
  disabled: string[];
}

export interface DungeonProgress {
  day: string;
  used: number;
  clears: number;
}

export const DUNGEON_DAILY = 3;
export const BENCH_CAP = 10;

export interface MapProgress {
  kills: number;
  bossDefeated: boolean;
}

export interface GameState {
  version: 1;
  heroes: HeroRecord[];
  bench: HeroRecord[];
  dungeon: DungeonProgress;
  gold: number;
  inventory: Item[];
  mapId: string;
  maps: Record<string, MapProgress>;
  /** Items below this rarity are salvaged on pickup; -1 disables. */
  autoSalvageBelow: number;
  speed: number;
  nextItemId: number;
  lastSeen: number;
}

export const STARTING_HEROES: [string, string][] = [
  ['guardian', '布伦'],
  ['mage', '艾拉'],
  ['hunter', '洛克'],
  ['rogue', '薇丝'],
  ['priest', '莉娜'],
];

export function newHero(classId: string, name: string, level = 1): HeroRecord {
  return { classId, name, level, exp: 0, gear: {}, talents: {}, tactics: { healThreshold: null, disabled: [] } };
}

export function today(now = Date.now()): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** Daily dungeon attempts left, resetting the counter on a new local day. */
export function dungeonLeft(s: GameState, now = Date.now()): number {
  const d = today(now);
  if (s.dungeon.day !== d) s.dungeon = { day: d, used: 0, clears: s.dungeon.clears };
  return DUNGEON_DAILY - s.dungeon.used;
}

/** Fills fields added after a save was created. */
function migrate(s: GameState): GameState {
  s.bench ??= [];
  s.dungeon ??= { day: '', used: 0, clears: 0 };
  for (const h of [...s.heroes, ...s.bench]) {
    h.talents ??= {};
    h.tactics ??= { healThreshold: null, disabled: [] };
  }
  return s;
}

export function newGame(now = Date.now()): GameState {
  return {
    version: 1,
    heroes: STARTING_HEROES.map(([classId, name]) => newHero(classId, name)),
    bench: [],
    dungeon: { day: '', used: 0, clears: 0 },
    gold: 0,
    inventory: [],
    mapId: MAPS[0].id,
    maps: {},
    autoSalvageBelow: 2,
    speed: 1,
    nextItemId: 1,
    lastSeen: now,
  };
}

export function mapUnlocked(s: GameState, mapId: string): boolean {
  const i = MAPS.findIndex((m) => m.id === mapId);
  return i === 0 || (i > 0 && !!s.maps[MAPS[i - 1].id]?.bossDefeated);
}

export function mapProgress(s: GameState, mapId = s.mapId): MapProgress {
  return (s.maps[mapId] ??= { kills: 0, bossDefeated: false });
}

function isGameState(v: unknown): v is GameState {
  const s = v as GameState;
  return !!s && s.version === 1 && Array.isArray(s.heroes) && Array.isArray(s.inventory) && typeof s.gold === 'number';
}

export function serialize(s: GameState): string {
  return JSON.stringify(s);
}

export function deserialize(raw: string): GameState | null {
  try {
    const v = JSON.parse(raw);
    return isGameState(v) ? migrate(v) : null;
  } catch {
    return null;
  }
}

export function exportSave(s: GameState): string {
  const bytes = new TextEncoder().encode(serialize(s));
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

export function importSave(code: string): GameState | null {
  try {
    const bin = atob(code.trim());
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return deserialize(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

export function loadGame(storage: Storage = localStorage): GameState | null {
  const raw = storage.getItem(SAVE_KEY);
  return raw ? deserialize(raw) : null;
}

export function saveGame(s: GameState, storage: Storage = localStorage, now = Date.now()): void {
  s.lastSeen = now;
  storage.setItem(SAVE_KEY, serialize(s));
}
