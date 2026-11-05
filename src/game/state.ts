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
}

export interface MapProgress {
  kills: number;
  bossDefeated: boolean;
}

export interface GameState {
  version: 1;
  heroes: HeroRecord[];
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

export function newGame(now = Date.now()): GameState {
  return {
    version: 1,
    heroes: STARTING_HEROES.map(([classId, name]) => ({ classId, name, level: 1, exp: 0, gear: {} })),
    gold: 0,
    inventory: [],
    mapId: MAPS[0].id,
    maps: {},
    autoSalvageBelow: 1,
    speed: 1,
    nextItemId: 1,
    lastSeen: now,
  };
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
    return isGameState(v) ? v : null;
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
