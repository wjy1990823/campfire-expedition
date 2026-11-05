import { describe, expect, it } from 'vitest';
import { newGame } from '../game/state';
import { pickupItem, recordStats } from './battle';
import { itemScore, rollItem, salvageValue } from './items';
import { Rng } from './rng';

describe('items', () => {
  it('higher rarity rolls stronger items', () => {
    const rng = new Rng(3);
    let lo = 0;
    let hi = 0;
    for (let i = 0; i < 200; i++) {
      lo += itemScore(rollItem(rng, i, 5, 1), 'dps');
      hi += itemScore(rollItem(rng, i, 5, 4), 'dps');
    }
    expect(hi).toBeGreaterThan(lo * 1.5);
  });

  it('gear adds to hero stats', () => {
    const s = newGame(0);
    const r = s.heroes[0];
    const before = recordStats(r);
    r.gear.weapon = { id: 1, slot: 'weapon', name: 'x', rarity: 2, ilvl: 5, stats: { atk: 10, maxHp: 20 } };
    const after = recordStats(r);
    expect(after.atk).toBeCloseTo(before.atk + 10);
    expect(after.maxHp).toBe(before.maxHp + 20);
  });

  it('auto-salvages low rarity items', () => {
    const s = newGame(0);
    s.autoSalvageBelow = 2;
    const junk = rollItem(new Rng(1), 1, 3, 1);
    const good = rollItem(new Rng(2), 2, 3, 3);
    expect(pickupItem(s, junk)).toEqual({ salvaged: true, gold: salvageValue(junk) });
    expect(pickupItem(s, good).salvaged).toBe(false);
    expect(s.inventory).toEqual([good]);
  });
});
