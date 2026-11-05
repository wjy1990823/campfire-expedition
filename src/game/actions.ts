import { CLASSES } from '../data/classes';
import { itemScore, salvageValue, type Item } from '../sim/items';
import { autoAssign } from '../sim/talents';
import { BENCH_CAP, newHero, type GameState, type HeroRecord } from './state';

function take(s: GameState, itemId: number): Item | undefined {
  const i = s.inventory.findIndex((it) => it.id === itemId);
  return i < 0 ? undefined : s.inventory.splice(i, 1)[0];
}

export function equip(s: GameState, heroIdx: number, itemId: number): boolean {
  const item = take(s, itemId);
  if (!item) return false;
  const h = s.heroes[heroIdx];
  const old = h.gear[item.slot];
  if (old) s.inventory.push(old);
  h.gear[item.slot] = item;
  return true;
}

export function unequip(s: GameState, heroIdx: number, slot: Item['slot']): boolean {
  const h = s.heroes[heroIdx];
  const it = h.gear[slot];
  if (!it) return false;
  delete h.gear[slot];
  s.inventory.push(it);
  return true;
}

export function upgradeDelta(s: GameState, heroIdx: number, item: Item): number {
  const h = s.heroes[heroIdx];
  const role = CLASSES[h.classId].role;
  return itemScore(item, role) - itemScore(h.gear[item.slot], role);
}

/** Greedily equips the biggest upgrades across the whole party. Returns the number of items equipped. */
export function autoEquip(s: GameState): number {
  let count = 0;
  for (;;) {
    let best: { hero: number; item: Item; delta: number } | null = null;
    for (const item of s.inventory)
      s.heroes.forEach((_, hi) => {
        const delta = upgradeDelta(s, hi, item);
        if (delta > 0.01 && (!best || delta > best.delta)) best = { hero: hi, item, delta };
      });
    if (!best) return count;
    const b = best as { hero: number; item: Item };
    equip(s, b.hero, b.item.id);
    count++;
  }
}

export function salvage(s: GameState, itemId: number): number {
  const it = take(s, itemId);
  if (!it) return 0;
  const g = salvageValue(it);
  s.gold += g;
  return g;
}

export function salvageBelow(s: GameState, rarity: number): number {
  return s.inventory.filter((it) => it.rarity < rarity).reduce((g, it) => g + salvage(s, it.id), 0);
}

const RECRUIT_NAMES = ['托尔', '米娅', '格雷', '赛琳', '奥斯', '露西', '巴克', '芙蕾', '卡恩', '诺娃', '雷诺', '艾薇', '多恩', '希尔', '凯拉', '班尼'];
export const RECRUIT_QUOTES = [
  '“篝火不灭，我就不会倒下。”',
  '“打怪？算我一个！”',
  '“安静点，我在瞄准。”',
  '“这把刀很久没见血了。”',
  '“受伤了别逞强，交给我。”',
  '“听说灯塔那边有宝藏？”',
  '“我只是路过……顺便帮个忙。”',
  '“黑雾？我见过更糟的。”',
];

export function recruitCost(s: GameState): number {
  return 100 * Math.max(1, avgLevel(s));
}

function avgLevel(s: GameState): number {
  return Math.round(s.heroes.reduce((a, h) => a + h.level, 0) / s.heroes.length);
}

/** Hires an AI adventurer of the given class onto the bench, a little below the party level. */
export function recruit(s: GameState, classId: string, rand = Math.random): HeroRecord | null {
  const cost = recruitCost(s);
  if (s.gold < cost || s.bench.length >= BENCH_CAP || !CLASSES[classId]) return null;
  s.gold -= cost;
  const used = new Set([...s.heroes, ...s.bench].map((h) => h.name));
  const pool = RECRUIT_NAMES.filter((n) => !used.has(n));
  const name = pool.length ? pool[Math.floor(rand() * pool.length)] : `冒险者${s.bench.length + 1}`;
  const h = newHero(classId, name, Math.max(1, avgLevel(s) - 2));
  h.quote = RECRUIT_QUOTES[Math.floor(rand() * RECRUIT_QUOTES.length)];
  autoAssign(h);
  s.bench.push(h);
  return h;
}

export function swapHero(s: GameState, partyIdx: number, benchIdx: number): boolean {
  const b = s.bench[benchIdx];
  if (!b || !s.heroes[partyIdx]) return false;
  s.bench[benchIdx] = s.heroes[partyIdx];
  s.heroes[partyIdx] = b;
  return true;
}

/** Dismisses a benched hero; their gear goes back to the bag. */
export function dismiss(s: GameState, benchIdx: number): boolean {
  const [h] = s.bench.splice(benchIdx, 1);
  if (!h) return false;
  s.inventory.push(...Object.values(h.gear).filter((x): x is Item => !!x));
  return true;
}
