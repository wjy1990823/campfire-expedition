import { MAPS } from '../data/maps';
import { mapProgress, OFFLINE_CAP_SECONDS, type GameState } from '../game/state';
import { addExp, Battle, expPenalty, pickupItem, TICK } from './battle';
import { rollItem, rollRarity, type Item } from './items';
import { Rng } from './rng';

export const OFFLINE_MIN_SECONDS = 60;
const SAMPLE_SECONDS = 600;
const MAX_OFFLINE_DROPS = 120;
const EXP_CHUNKS = 24;

export interface OfflineReport {
  seconds: number;
  kills: number;
  gold: number;
  exp: number;
  levelUps: { name: string; from: number; to: number }[];
  kept: Item[];
  salvaged: number;
  salvageGold: number;
}

/** Extrapolates rewards for `seconds` of idle time from a short headless sample and applies them to `state`. */
export function applyOfflineRewards(state: GameState, seconds: number, seed = Date.now()): OfflineReport | null {
  seconds = Math.min(seconds, OFFLINE_CAP_SECONDS);
  if (seconds < OFFLINE_MIN_SECONDS) return null;
  const sample = Math.min(seconds, SAMPLE_SECONDS);
  const clone: GameState = structuredClone(state);
  const b = new Battle(clone, seed);
  for (let t = 0; t < sample; t += TICK) {
    b.tick(TICK);
    b.drainEvents();
  }
  const f = seconds / sample;
  const report: OfflineReport = {
    seconds,
    kills: Math.round(b.totals.kills * f),
    gold: Math.round(b.totals.gold * f),
    exp: Math.round(b.totals.exp * f),
    levelUps: [],
    kept: [],
    salvaged: 0,
    salvageGold: 0,
  };
  state.gold += report.gold;
  mapProgress(state).kills += report.kills;
  const map = MAPS.find((m) => m.id === state.mapId) ?? MAPS[0];
  const monsterLevel = Math.round((map.minLevel + map.maxLevel) / 2);
  for (const h of state.heroes) {
    const from = h.level;
    for (let i = 0; i < EXP_CHUNKS; i++) addExp(h, Math.round((report.exp / EXP_CHUNKS) * expPenalty(h.level, monsterLevel)));
    if (h.level > from) report.levelUps.push({ name: h.name, from, to: h.level });
  }
  const avgLevel = Math.round(state.heroes.reduce((a, h) => a + h.level, 0) / state.heroes.length);
  const ilvl = Math.max(map.minLevel, Math.min(map.maxLevel, avgLevel));
  const rng = new Rng(seed ^ 0x5bd1e995);
  const drops = Math.min(MAX_OFFLINE_DROPS, Math.round(b.totals.drops * f));
  for (let i = 0; i < drops; i++) {
    const item = rollItem(rng, state.nextItemId++, ilvl, rollRarity(rng, false));
    const r = pickupItem(state, item);
    if (r.salvaged) {
      report.salvaged++;
      report.salvageGold += r.gold;
    } else report.kept.push(item);
  }
  return report;
}
