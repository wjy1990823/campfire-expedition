import { describe, expect, it } from 'vitest';
import { MAPS } from '../data/maps';
import { Battle, expToNext, mitigate } from './battle';

const party = [
  { classId: 'guardian', name: '布伦' },
  { classId: 'mage', name: '艾拉' },
  { classId: 'priest', name: '莉娜' },
];

function run(seconds: number, seed = 42) {
  const b = new Battle(MAPS[0], party, seed);
  const damageTaken = new Map<number, number>();
  let wipes = 0;
  for (let t = 0; t < seconds; t += 0.1) {
    b.tick();
    for (const e of b.drainEvents()) {
      if (e.type === 'damage' && b.unit(e.tgt)?.team === 'hero') damageTaken.set(e.tgt, (damageTaken.get(e.tgt) ?? 0) + e.amount);
      if (e.type === 'wipe') wipes++;
    }
  }
  return { b, damageTaken, wipes };
}

describe('Battle sim', () => {
  it('formulas', () => {
    expect(expToNext(1)).toBe(50);
    expect(mitigate(100, 100)).toBe(50);
  });

  it('party farms, levels up and has no invalid state', () => {
    const { b } = run(300);
    expect(b.kills).toBeGreaterThan(20);
    expect(b.gold).toBeGreaterThan(0);
    for (const h of b.heroes) {
      expect(h.level).toBeGreaterThan(1);
      expect(Number.isFinite(h.hp)).toBe(true);
      expect(h.hp).toBeLessThanOrEqual(h.stats.maxHp);
    }
  });

  it('tank holds most of the aggro', () => {
    const { b, damageTaken } = run(300);
    const tank = b.heroes.find((h) => h.role === 'tank')!;
    const total = [...damageTaken.values()].reduce((a, v) => a + v, 0);
    expect((damageTaken.get(tank.uid) ?? 0) / total).toBeGreaterThan(0.6);
  });

  it('boss gets defeated within 15 minutes for several seeds', () => {
    for (const seed of [1, 7, 99]) {
      const { b } = run(900, seed);
      expect(b.bossDefeated).toBe(true);
    }
  });
});
