import { CLASSES } from '../data/classes';
import { itemScore, salvageValue, type Item } from '../sim/items';
import type { GameState } from './state';

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
