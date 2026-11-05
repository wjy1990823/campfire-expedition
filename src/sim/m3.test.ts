import { describe, expect, it } from 'vitest';
import { DUNGEONS } from '../data/dungeons';
import { MAPS } from '../data/maps';
import { MONSTERS } from '../data/monsters';
import { TALENTS } from '../data/talents';
import { autoEquip } from '../game/actions';
import { deserialize, dungeonLeft, DUNGEON_DAILY, mapProgress, mapUnlocked, newGame, serialize, type GameState } from '../game/state';
import { Battle, recordStats } from './battle';
import { rollItem } from './items';
import { Rng } from './rng';
import { autoAssign, heroSkills, learn, resetTalents, spent, talentPoints } from './talents';

function geared(level: number, rarity: number, seed = 1): GameState {
  const s = newGame(0);
  const rng = new Rng(seed);
  for (const h of s.heroes) h.level = level;
  for (let i = 0; i < 80; i++) s.inventory.push(rollItem(rng, s.nextItemId++, level, rarity));
  autoEquip(s);
  for (const h of s.heroes) autoAssign(h);
  return s;
}

function runUntil(b: Battle, seconds: number, done: () => boolean): number {
  let t = 0;
  for (; t < seconds && !done(); t += 0.1) {
    b.tick();
    b.drainEvents();
  }
  return t;
}

describe('M3 content', () => {
  it('all map and dungeon monsters exist', () => {
    for (const m of MAPS) for (const id of [...m.monsters, m.boss]) expect(MONSTERS[id], id).toBeDefined();
    for (const d of DUNGEONS) for (const st of d.stages) for (const id of [...(st.monsters ?? []), st.boss ?? 'slime']) expect(MONSTERS[id], id).toBeDefined();
    expect(MAPS.length).toBe(7);
  });

  it('maps unlock in order after each boss', () => {
    const s = newGame(0);
    expect(mapUnlocked(s, MAPS[0].id)).toBe(true);
    expect(mapUnlocked(s, MAPS[1].id)).toBe(false);
    mapProgress(s, MAPS[0].id).bossDefeated = true;
    expect(mapUnlocked(s, MAPS[1].id)).toBe(true);
    expect(mapUnlocked(s, MAPS[2].id)).toBe(false);
  });

  for (const [i, m] of MAPS.entries()) {
    it(`a geared party at the level cap beats ${m.name}'s boss`, () => {
      const s = geared(m.maxLevel, 2, i + 1);
      s.mapId = m.id;
      mapProgress(s).kills = m.killsForBoss;
      const b = new Battle(s, 100 + i);
      const t = runUntil(b, 900, () => b.bossDefeated);
      console.log(`${m.name}: boss in ${t.toFixed(0)}s`);
      expect(b.bossDefeated).toBe(true);
    });
  }
});

describe('talents', () => {
  it('points, prerequisites, reset and auto-assign', () => {
    const h = newGame(0).heroes[0];
    expect(talentPoints(4)).toBe(0);
    h.level = 10;
    expect(talentPoints(10)).toBe(4);
    const nodes = TALENTS[h.classId].nodes;
    expect(learn(h, nodes[2].id)).toBe(false);
    for (let i = 0; i < 3; i++) expect(learn(h, nodes[0].id)).toBe(true);
    expect(learn(h, nodes[0].id)).toBe(false);
    expect(learn(h, nodes[2].id)).toBe(true);
    const base = recordStats({ ...h, talents: {} }).maxHp;
    expect(recordStats(h).maxHp).toBeGreaterThan(base);
    resetTalents(h);
    expect(spent(h)).toBe(0);
    h.level = 30;
    autoAssign(h);
    expect(spent(h)).toBe(talentPoints(30));
    expect(heroSkills(h).some((sk) => sk.id === 'g_shock')).toBe(true);
  });

  it('tactics disable skills and override heal threshold', () => {
    const p = newGame(0).heroes.find((h) => h.classId === 'priest')!;
    p.tactics = { healThreshold: 0.5, disabled: ['p_aoeheal'] };
    const sk = heroSkills(p);
    expect(sk.find((x) => x.id === 'p_aoeheal')).toBeUndefined();
    expect(sk.find((x) => x.id === 'p_heal')!.healThreshold).toBe(0.5);
  });
});

describe('dungeon', () => {
  it('daily attempts reset on a new day', () => {
    const s = newGame(0);
    const day1 = new Date(2026, 0, 1, 12).getTime();
    expect(dungeonLeft(s, day1)).toBe(DUNGEON_DAILY);
    s.dungeon.used = DUNGEON_DAILY;
    expect(dungeonLeft(s, day1)).toBe(0);
    expect(dungeonLeft(s, day1 + 86400_000)).toBe(DUNGEON_DAILY);
  });

  it('a geared party clears all stages; an undergeared one fails', () => {
    const s = geared(14, 3, 7);
    const b = new Battle(s, 9, DUNGEONS[0]);
    const t = runUntil(b, 1200, () => b.result !== null);
    console.log(`dungeon: ${b.result} in ${t.toFixed(0)}s, stage ${b.stage}`);
    expect(b.result).toBe('cleared');
    expect(s.dungeon.clears).toBe(1);
    expect(s.inventory.some((it) => it.name.startsWith('幽影·') && it.rarity >= 4)).toBe(true);

    const weak = newGame(0);
    for (const h of weak.heroes) h.level = 8;
    const wb = new Battle(weak, 9, DUNGEONS[0]);
    runUntil(wb, 1200, () => wb.result !== null);
    expect(wb.result).toBe('failed');
  });

  it('old saves migrate', () => {
    const s = newGame(0) as unknown as Record<string, unknown>;
    delete s.bench;
    delete s.dungeon;
    for (const h of s.heroes as Record<string, unknown>[]) {
      delete h.talents;
      delete h.tactics;
    }
    const m = deserialize(serialize(s as unknown as GameState))!;
    expect(m.bench).toEqual([]);
    expect(m.heroes[0].tactics.disabled).toEqual([]);
  });
});
