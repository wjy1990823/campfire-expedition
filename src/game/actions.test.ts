import { describe, expect, it } from 'vitest';
import { rollItem } from '../sim/items';
import { Rng } from '../sim/rng';
import { autoEquip, equip, salvageBelow, unequip } from './actions';
import { newGame } from './state';

describe('gear actions', () => {
  it('equip swaps the old item back into the bag; unequip returns it', () => {
    const s = newGame(0);
    const rng = new Rng(5);
    const a = { ...rollItem(rng, 1, 3, 2), slot: 'weapon' as const };
    const b = { ...rollItem(rng, 2, 3, 3), slot: 'weapon' as const };
    s.inventory.push(a, b);
    equip(s, 0, a.id);
    equip(s, 0, b.id);
    expect(s.heroes[0].gear.weapon).toBe(b);
    expect(s.inventory).toEqual([a]);
    unequip(s, 0, 'weapon');
    expect(s.inventory.length).toBe(2);
  });

  it('autoEquip fills empty slots and salvageBelow clears junk', () => {
    const s = newGame(0);
    const rng = new Rng(9);
    for (let i = 0; i < 30; i++) s.inventory.push(rollItem(rng, i, 4, i % 4));
    expect(autoEquip(s)).toBeGreaterThan(0);
    expect(autoEquip(s)).toBe(0);
    const gold = salvageBelow(s, 2);
    expect(gold).toBeGreaterThan(0);
    expect(s.inventory.every((it) => it.rarity >= 2)).toBe(true);
  });
});
